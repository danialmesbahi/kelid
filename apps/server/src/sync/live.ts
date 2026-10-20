import type { FastifyBaseLogger } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import type { Queryable } from '../db';

/** یک کانال برای همهٔ دفترها؛ پیام فقط شناسه‌هاست، هیچ داده‌ای از دفتر در آن نیست. */
export const LIVE_CHANNEL = 'kelid_live';
/** پنل فروشنده: «دفتر X عوض شد» (تریگرهای migration 10) یا «kick:<شناسهٔ مدیر>». */
export const VENDOR_CHANNEL = 'kelid_vendor';
// سقف‌ها تا یک دستگاه یا دفتر نتواند با اتصال‌های باز، حافظهٔ سرور را پر کند.
export const LIVE_MAX = { total: 20_000, office: 200, device: 3, vendor: 100, admin: 6 } as const;
// چند تغییر پشت هم (مثلاً پرداخت + تمدید + یادداشت) یک خبر می‌شوند؛ کمتر از آن‌که چشم فرقش را ببیند.
const VENDOR_BATCH_MS = 50;

interface Message {
  o?: string; // دفتری که داده‌اش عوض شد
  d?: string; // دستگاهی که عوضش کرد (یا باید بیرون بیفتد)
  k?: 'kick' | 'billing' | 'support';
}

/**
 * «چیزی عوض شد» به همهٔ نمونه‌های سرور. NOTIFY داخل تراکنش فقط بعد از commit فرستاده می‌شود؛
 * پس دستگاه‌ها هیچ‌وقت برای تغییری که برگشت خورده سراغ سرور نمی‌آیند.
 */
export async function announce(db: Queryable, office: string, device: string): Promise<void> {
  await db.query('select pg_notify($1, $2)', [LIVE_CHANNEL, JSON.stringify({ o: office, d: device } satisfies Message)]);
}

/** تیم کلید به تیکتی از این دفتر پاسخ داد: دستگاه‌های دفتر نشان «پشتیبانی» را تازه می‌کنند. */
export async function announceSupport(db: Queryable, office: string): Promise<void> {
  await db.query('select pg_notify($1, $2)', [LIVE_CHANNEL, JSON.stringify({ o: office, k: 'support' } satisfies Message)]);
}

/** مدیر پنلی که غیرفعال شد، اتصال زنده‌اش همان لحظه بسته می‌شود. */
export async function kickVendor(db: Queryable, admin: string): Promise<void> {
  await db.query('select pg_notify($1, $2)', [VENDOR_CHANNEL, `kick:${admin}`]);
}

/** دستگاهی که بیرون شد، اتصال زنده‌اش هم همان لحظه بسته می‌شود. */
export async function kickDevice(db: Queryable, device: string): Promise<void> {
  await db.query('select pg_notify($1, $2)', [LIVE_CHANNEL, JSON.stringify({ k: 'kick', d: device } satisfies Message)]);
}

export interface LiveListener {
  office: string;
  device: string;
  /** «برو تازه‌ها را بگیر». */
  ping(): void;
  /** اشتراک دفتر عوض شد: مجوز تازه بگیر. */
  billing(): void;
  /** پاسخ تازه از پشتیبانی. */
  support(): void;
  close(): void;
}

export interface VendorListener {
  admin: string;
  /** شناسهٔ دفترهایی که عوض شدند. */
  changed(offices: string[]): void;
  close(): void;
}

/**
 * اتصال‌های زندهٔ همین نمونهٔ سرور. یک اتصال دیتابیس LISTEN می‌کند و پیام را به دستگاه‌های همان دفتر می‌رساند
 * (جز دستگاهی که خودش تغییر را فرستاده). با چند نمونهٔ سرور هم درست است، چون پیام از Postgres می‌آید.
 */
export class LiveHub {
  private offices = new Map<string, Set<LiveListener>>();
  private devices = new Map<string, Set<LiveListener>>();
  private count = 0;
  private vendors = new Set<VendorListener>();
  private vendorQueue = new Set<string>();
  private vendorTimer: ReturnType<typeof setTimeout> | undefined;
  private client: PoolClient | null = null;
  private connecting: Promise<void> | null = null;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private everConnected = false;
  private closed = false;

  constructor(
    private pool: Pool,
    private log: FastifyBaseLogger,
  ) {}

  /** آیا جای اتصال تازه هست؟ برای دستگاه، قدیمی‌ترین اتصالش جا باز می‌کند. */
  hasRoom(office: string): boolean {
    return !this.closed && this.count < LIVE_MAX.total && (this.offices.get(office)?.size ?? 0) < LIVE_MAX.office;
  }

  hasVendorRoom(admin: string): boolean {
    if (this.closed || this.vendors.size >= LIVE_MAX.vendor) return false;
    const mine = [...this.vendors].filter((v) => v.admin === admin);
    // پنجرهٔ ششم همان مدیر جای قدیمی‌ترین را می‌گیرد، نه این‌که رد شود.
    if (mine.length >= LIVE_MAX.admin) mine[0]!.close();
    return true;
  }

  addVendor(l: VendorListener): () => void {
    this.vendors.add(l);
    return () => void this.vendors.delete(l);
  }

  /** فقط با اولین اتصال زنده LISTEN می‌شود؛ سروری که کسی به آن وصل نیست اتصال دیتابیس اضافه نگه نمی‌دارد. */
  ready(): Promise<void> {
    if (this.client || this.closed) return Promise.resolve();
    return (this.connecting ??= this.connect().finally(() => (this.connecting = null)));
  }

  add(l: LiveListener): () => void {
    const mine = this.devices.get(l.device);
    if (mine && mine.size >= LIVE_MAX.device) mine.values().next().value?.close();
    this.put(this.offices, l.office, l);
    this.put(this.devices, l.device, l);
    this.count++;
    let removed = false;
    return () => {
      if (removed) return;
      removed = true;
      this.take(this.offices, l.office, l);
      this.take(this.devices, l.device, l);
      this.count--;
    };
  }

  close() {
    this.closed = true;
    clearTimeout(this.retry);
    clearTimeout(this.vendorTimer);
    for (const set of [...this.offices.values()]) for (const l of [...set]) l.close();
    for (const v of [...this.vendors]) v.close();
    const c = this.client;
    this.client = null;
    c?.release(true);
  }

  private put(map: Map<string, Set<LiveListener>>, key: string, l: LiveListener) {
    let set = map.get(key);
    if (!set) map.set(key, (set = new Set()));
    set.add(l);
  }

  private take(map: Map<string, Set<LiveListener>>, key: string, l: LiveListener) {
    const set = map.get(key);
    if (!set) return;
    set.delete(l);
    if (!set.size) map.delete(key);
  }

  private async connect() {
    let c: PoolClient | undefined;
    try {
      c = await this.pool.connect();
      const client = c;
      client.on('notification', (n) => (n.channel === LIVE_CHANNEL ? this.dispatch(n.payload) : n.channel === VENDOR_CHANNEL && this.vendor(n.payload)));
      // اتصال افتاد ⇒ دوباره وصل می‌شود؛ برنامهٔ سرور هرگز به‌خاطر آن نمی‌خوابد.
      client.on('error', (e) => this.lost(client, e));
      client.on('end', () => this.lost(client));
      await client.query(`listen ${LIVE_CHANNEL}; listen ${VENDOR_CHANNEL}`);
      if (this.closed) return void client.release(true);
      this.client = client;
      // پیام‌هایی که بین قطع و وصل جا ماندند: همه یک بار سر می‌زنند.
      if (this.everConnected) this.pingAll();
      this.everConnected = true;
    } catch (e) {
      c?.release(true);
      this.log.warn({ err: e }, 'live: listen failed; retrying');
      this.later();
    }
  }

  private lost(c: PoolClient, err?: Error) {
    if (this.client !== c) return;
    this.client = null;
    if (err) this.log.warn({ err }, 'live: listen connection lost');
    c.release(true);
    this.later();
  }

  private later() {
    if (this.closed || (!this.count && !this.vendors.size)) return;
    clearTimeout(this.retry);
    this.retry = setTimeout(() => void this.ready(), 2_000);
  }

  private dispatch(payload: string | undefined) {
    let m: Message;
    try {
      m = JSON.parse(payload ?? '') as Message;
    } catch {
      return;
    }
    if (m.k === 'kick') {
      if (typeof m.d === 'string') for (const l of [...(this.devices.get(m.d) ?? [])]) l.close();
      return;
    }
    if (typeof m.o !== 'string') return;
    if (m.k === 'billing') {
      for (const l of this.offices.get(m.o) ?? []) l.billing();
      return;
    }
    if (m.k === 'support') {
      for (const l of this.offices.get(m.o) ?? []) l.support();
      return;
    }
    for (const l of this.offices.get(m.o) ?? []) if (l.device !== m.d) l.ping();
  }

  private vendor(payload: string | undefined) {
    if (!payload || !this.vendors.size) return;
    if (payload.startsWith('kick:')) {
      const admin = payload.slice(5);
      for (const v of [...this.vendors]) if (v.admin === admin) v.close();
      return;
    }
    this.vendorQueue.add(payload);
    this.vendorTimer ??= setTimeout(() => {
      this.vendorTimer = undefined;
      const ids = [...this.vendorQueue];
      this.vendorQueue.clear();
      for (const v of this.vendors) v.changed(ids);
    }, VENDOR_BATCH_MS);
  }

  private pingAll() {
    for (const set of this.offices.values()) for (const l of set) l.ping();
    // پنل هم بعد از قطع و وصل یک بار همه‌چیز را تازه می‌کند (فهرست خالی = همه).
    for (const v of this.vendors) v.changed([]);
  }
}
