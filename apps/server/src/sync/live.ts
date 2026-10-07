import type { FastifyBaseLogger } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import type { Queryable } from '../db';

/** یک کانال برای همهٔ دفترها؛ پیام فقط شناسه‌هاست، هیچ داده‌ای از دفتر در آن نیست. */
export const LIVE_CHANNEL = 'kelid_live';
// سقف‌ها تا یک دستگاه یا دفتر نتواند با اتصال‌های باز، حافظهٔ سرور را پر کند.
export const LIVE_MAX = { total: 20_000, office: 200, device: 3 } as const;

interface Message {
  o?: string; // دفتری که داده‌اش عوض شد
  d?: string; // دستگاهی که عوضش کرد (یا باید بیرون بیفتد)
  k?: 'kick';
}

/**
 * «چیزی عوض شد» به همهٔ نمونه‌های سرور. NOTIFY داخل تراکنش فقط بعد از commit فرستاده می‌شود؛
 * پس دستگاه‌ها هیچ‌وقت برای تغییری که برگشت خورده سراغ سرور نمی‌آیند.
 */
export async function announce(db: Queryable, office: string, device: string): Promise<void> {
  await db.query('select pg_notify($1, $2)', [LIVE_CHANNEL, JSON.stringify({ o: office, d: device } satisfies Message)]);
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
    for (const set of [...this.offices.values()]) for (const l of [...set]) l.close();
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
      client.on('notification', (n) => n.channel === LIVE_CHANNEL && this.dispatch(n.payload));
      // اتصال افتاد ⇒ دوباره وصل می‌شود؛ برنامهٔ سرور هرگز به‌خاطر آن نمی‌خوابد.
      client.on('error', (e) => this.lost(client, e));
      client.on('end', () => this.lost(client));
      await client.query(`listen ${LIVE_CHANNEL}`);
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
    if (this.closed || !this.count) return;
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
    for (const l of this.offices.get(m.o) ?? []) if (l.device !== m.d) l.ping();
  }

  private pingAll() {
    for (const set of this.offices.values()) for (const l of set) l.ping();
  }
}
