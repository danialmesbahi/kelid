import { ApiError } from '../auth/api';
import type { SyncTarget } from '../data';
import type { SyncApi } from './api';

export type SyncPhase = 'idle' | 'syncing' | 'offline' | 'error' | 'blocked' | 'held';
export interface SyncStatus {
  phase: SyncPhase;
  pending: number;
  lastSync: number | null;
}

const PUSH_BATCH = 200;
const PHOTO_BATCH = 8;
const PULL_BATCH = 500;
// عکس کامل سنگین است: هر دور چند تا، تا ارسال تغییرهای تازه پشت صف عکس‌ها نماند؛ بقیه در دورهای بعد.
const FULL_PER_CYCLE = 12;
const FULL_PAUSE_MS = 400;
// کوتاه تا تغییر تقریباً همان لحظه روی بقیهٔ دستگاه‌ها باشد، ولی چند ذخیرهٔ پشت هم یک‌جا بروند.
const DEBOUNCE_MS = 300;
// خبر زنده از سرور ⇒ کمی صبر تا چند خبر پشت هم یک pull شوند.
const LIVE_MS = 120;
// اتصال زنده هست؛ این فقط تور ایمنی است اگر جایی خبری گم شود.
const PERIODIC_MS = 60_000;
const RETRY_MS = [5_000, 15_000, 60_000, 180_000];
const LIVE_RETRY_MS = [1_000, 3_000, 10_000, 30_000];

/**
 * همگام‌سازی پشت صحنه: اول صف تغییرهای این دستگاه فرستاده می‌شود، بعد تغییرهای بقیه گرفته می‌شود.
 * هیچ‌وقت جلوی کار کاربر را نمی‌گیرد: نوشتن‌ها همیشه محلی‌اند و این فقط وقتی اینترنت هست کارش را می‌کند.
 * هر قدم قابل تکرار است؛ اگر برنامه وسط کار بسته شود، دفعهٔ بعد از همان‌جا ادامه می‌دهد و چیزی گم نمی‌شود.
 */
export class SyncEngine {
  private status: SyncStatus = { phase: 'idle', pending: 0, lastSync: null };
  private listeners = new Set<() => void>();
  private billingListeners = new Set<() => void>();
  private supportListeners = new Set<() => void>();
  private running: Promise<void> | null = null;
  private again = false;
  private applying = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private retry = 0;
  private stopped = false;
  private cleanup: Array<() => void> = [];
  private live = new AbortController();
  private fulls = new Map<string, Promise<boolean>>();
  // عکس کاملی که سرور ندارد، تا خاموش شدن موتور دوباره پرسیده نمی‌شود.
  private missing = new Set<string>();
  // سرور تغییر تازه نمی‌پذیرد (اشتراک تمام شده): صف روی دستگاه می‌ماند و گرفتن تغییرهای بقیه ادامه دارد.
  private held = false;

  private store: SyncTarget['store'];

  constructor(
    private target: SyncTarget,
    private api: SyncApi,
    private withToken: <T>(fn: (token: string) => Promise<T>) => Promise<T>,
    private officeId: string,
  ) {
    this.store = target.store;
    // توکن همیشه مال یک دفتر است. اگر کاربر دفترش را عوض کرد (پیوستن به دفتر دیگر)، تمدید توکن دفتر تازه را می‌دهد؛
    // هیچ داده‌ای از این دیتابیس نباید با آن توکن برود، حتی در فاصلهٔ کوتاه تا خاموش شدن این موتور.
    this.withToken = (fn) =>
      withToken((t) => {
        const office = tokenOffice(t);
        if (office && office !== officeId) throw new ApiError('office_changed');
        return fn(t);
      });
  }

  start() {
    // نوشتن محلی ⇒ کمی صبر تا چند تغییر پشت هم یک‌جا بروند.
    this.cleanup.push(this.target.subscribe(() => !this.applying && this.schedule(DEBOUNCE_MS)));
    const now = () => this.schedule(0);
    const visible = () => document.visibilityState === 'visible' && this.schedule(0);
    addEventListener('online', now);
    document.addEventListener('visibilitychange', visible);
    // هر دقیقه یک سر زدن کوچک، فقط وقتی برنامه جلوی چشم است؛ پس‌زمینه هیچ پردازشی ندارد.
    const id = setInterval(() => document.visibilityState === 'visible' && navigator.onLine !== false && this.schedule(0), PERIODIC_MS);
    this.cleanup.push(() => removeEventListener('online', now), () => document.removeEventListener('visibilitychange', visible), () => clearInterval(id));
    this.schedule(0);
    void this.listen();
  }

  stop() {
    this.stopped = true;
    this.live.abort();
    clearTimeout(this.timer);
    for (const c of this.cleanup.splice(0)) c();
    this.listeners.clear();
    this.billingListeners.clear();
    this.supportListeners.clear();
  }

  /** خبر زندهٔ «اشتراک دفتر عوض شد». */
  onBilling = (fn: () => void) => {
    this.billingListeners.add(fn);
    return () => void this.billingListeners.delete(fn);
  };

  /** خبر زندهٔ «پشتیبانی پاسخ داد». */
  onSupport = (fn: () => void) => {
    this.supportListeners.add(fn);
    return () => void this.supportListeners.delete(fn);
  };

  /**
   * اتصال زنده به سرور تا وقتی موتور روشن است: هر خبر یعنی یک pull کوتاه. قطع شد ⇒ با فاصلهٔ کم دوباره وصل
   * می‌شود و بعد از وصل شدن یک بار سر می‌زند تا چیزی که وسط قطعی آمده جا نماند.
   */
  async listen() {
    const listen = this.api.listen;
    if (!listen) return;
    let fails = 0;
    let first = true;
    while (!this.stopped) {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        await this.until('online');
        continue;
      }
      const began = Date.now();
      try {
        await this.withToken((t) =>
          listen(
            t,
            {
              open: () => {
                if (!first) this.schedule(0);
                first = false;
              },
              change: () => this.schedule(LIVE_MS),
              billing: () => {
                for (const l of this.billingListeners) l();
                // تمدید شد ⇒ صفی که منتظر مانده بود همین حالا می‌رود.
                this.schedule(LIVE_MS);
              },
              support: () => {
                for (const l of this.supportListeners) l();
              },
            },
            this.live.signal,
          ),
        );
        if (this.stopped) return;
        // اتصالی که زود بسته شد هم شکست حساب می‌شود؛ وگرنه حلقه‌ای بی‌وقفه به سرور فشار می‌آورد.
        fails = Date.now() - began < 5_000 ? fails + 1 : 0;
      } catch (e) {
        // بیرون شده یا سرور قدیمی: همگام‌سازی معمول ادامه دارد.
        if (e instanceof ApiError && (e.code === 'unauthorized' || e.code === 'not_found')) return;
        fails++;
      }
      if (fails) await this.until('online', LIVE_RETRY_MS[Math.min(fails - 1, LIVE_RETRY_MS.length - 1)]!);
    }
  }

  /** صبر تا رویداد یا زمان، یا خاموش شدن موتور. */
  private until(event: 'online', ms?: number): Promise<void> {
    return new Promise((done) => {
      if (this.live.signal.aborted) return done();
      const finish = () => {
        clearTimeout(t);
        if (typeof removeEventListener === 'function') removeEventListener(event, finish);
        this.live.signal.removeEventListener('abort', finish);
        done();
      };
      const t = ms === undefined ? undefined : setTimeout(finish, ms);
      // برگشت اینترنت ⇒ همان لحظه دوباره وصل شو، نه بعد از پایان فاصله.
      if (typeof addEventListener === 'function') addEventListener(event, finish);
      this.live.signal.addEventListener('abort', finish);
    });
  }

  getStatus = () => this.status;
  onStatus = (fn: () => void) => {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  };

  private set(patch: Partial<SyncStatus>) {
    const next = { ...this.status, ...patch };
    if (next.phase === this.status.phase && next.pending === this.status.pending && next.lastSync === this.status.lastSync) return;
    this.status = next;
    for (const l of this.listeners) l();
  }

  private schedule(ms: number) {
    if (this.stopped) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.run(), ms);
  }

  /** یک دور کامل؛ اگر وسطش تغییر تازه‌ای آمد، بلافاصله یک دور دیگر. */
  run(): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    // بعد از خاموش شدن (خروج، تعویض دفتر) خطای دوری که هنوز در راه بود دیگر مهم نیست.
    this.running = this.cycle()
      .catch((e: unknown) => {
        if (!this.stopped) throw e;
      })
      .finally(() => {
        this.running = null;
        if (this.again && !this.stopped) {
          this.again = false;
          this.schedule(0);
        }
      });
    return this.running;
  }

  private async cycle() {
    if (this.stopped) return;
    const info = await this.store.syncInfo();
    this.set({ pending: info.pending });
    if (info.office && info.office !== this.officeId) return this.set({ phase: 'blocked' });
    if (navigator.onLine === false) return this.set({ phase: 'offline' });
    this.set({ phase: 'syncing' });
    try {
      await this.store.bindOffice(this.officeId);
      this.held = false;
      await this.pushAll();
      await this.pullAll();
      // عکس‌ها بعد از مشخصاتشان؛ سنگین‌ترند و نباید جلوی رسیدن فایل‌ها و مشتری‌ها را بگیرند.
      await this.photosUp();
      await this.thumbsDown();
      const more = await this.fullsDown();
      this.retry = 0;
      const pending = (await this.store.syncInfo()).pending;
      this.set({ phase: this.held && pending ? 'held' : 'idle', pending, lastSync: Date.now() });
      if (more) this.schedule(FULL_PAUSE_MS);
    } catch (e) {
      const offline = e instanceof ApiError && e.code === 'offline';
      this.set({ phase: offline ? 'offline' : 'error', pending: (await this.store.syncInfo()).pending });
      if (e instanceof ApiError && e.code === 'unauthorized') return; // صفحهٔ ورود برمی‌گردد
      if (e instanceof ApiError && e.code === 'office_changed') return this.set({ phase: 'blocked' });
      this.schedule(RETRY_MS[Math.min(this.retry++, RETRY_MS.length - 1)]!);
    }
  }

  private async pushAll() {
    for (;;) {
      if (this.stopped) return;
      const { changes, lastSeq } = await this.store.pendingChanges(PUSH_BATCH);
      if (!lastSeq) return;
      if (changes.length) {
        try {
          await this.withToken((t) => this.api.push(t, changes));
        } catch (e) {
          if (!(e instanceof ApiError && e.code === 'subscription')) throw e;
          this.held = true;
          return;
        }
      }
      // فقط بعد از تأیید سرور پاک می‌شود؛ پاسخ گم‌شده یعنی ارسال دوباره، که سرور بی‌اثر می‌پذیرد.
      await this.store.ackChanges(lastSeq);
      this.set({ pending: Math.max(0, this.status.pending - changes.length) });
    }
  }

  private async pullAll() {
    let pages = 0;
    let got = false;
    for (;;) {
      if (this.stopped) break;
      const { cursor } = await this.store.syncInfo();
      const page = await this.withToken((t) => this.api.pull(t, cursor, PULL_BATCH));
      // موتور وسط دریافت خاموش شد (خروج، تعویض دفتر): این صفحه دیگر نباید روی دیتابیس بنشیند.
      if (this.stopped) break;
      if (page.ownerPhones !== undefined) {
        this.applying = true;
        let again: boolean;
        try {
          again = await this.store.setOwnerPhoneAccess(page.ownerPhones);
        } finally {
          this.applying = false;
        }
        if (again) {
          got = true;
          continue;
        }
      }
      if (page.entities.length) {
        this.applying = true;
        try {
          await this.store.applyRemote(page.entities, page.cursor, page.hlc, { quiet: true });
        } finally {
          this.applying = false;
        }
        got = true;
        // اولین همگام‌سازی با هزاران فایل: صفحه‌ها هر چند دسته یک بار تازه می‌شوند و بین دسته‌ها نفس می‌کشند.
        if (++pages % 6 === 0) this.notify();
        await new Promise((r) => setTimeout(r, 0));
      } else if (page.cursor !== cursor) {
        await this.store.applyRemote([], page.cursor, page.hlc, { quiet: true });
      }
      if (!page.more) break;
    }
    if (got) this.notify();
  }

  private async photosUp() {
    for (;;) {
      if (this.stopped) return;
      const batch = await this.store.photosToUpload(PHOTO_BATCH);
      if (!batch.length) return;
      const done: string[] = [];
      for (const p of batch) {
        if (this.held) return;
        try {
          await this.withToken((t) => this.api.uploadPhoto(t, p));
        } catch (e) {
          if (e instanceof ApiError && e.code === 'subscription') {
            this.held = true;
            break;
          }
          // عکسی که سرور نمی‌پذیرد (خراب یا بیش از اندازه) هر دور دوباره فرستاده نمی‌شود؛ روی همین دستگاه می‌ماند.
          if (!(e instanceof ApiError && e.code === 'bad_photo')) throw e;
        }
        done.push(p.id);
      }
      await this.store.markPhotosUploaded(done);
    }
  }

  /** اول بندانگشتی همهٔ عکس‌ها: سبک است و فهرست‌ها و کارت‌ها را زود پر می‌کند. */
  private async thumbsDown() {
    // عکسی که هنوز روی سرور نیست (دستگاه صاحبش آفلاین است) در همین دور دوباره پرسیده نمی‌شود.
    const tried = new Set<string>();
    let got = 0;
    for (;;) {
      if (this.stopped) break;
      const ids = (await this.store.photosToDownload(tried.size + PHOTO_BATCH)).filter((id) => !tried.has(id));
      if (!ids.length) break;
      for (const id of ids) {
        tried.add(id);
        const thumb = await this.withToken((t) => this.api.downloadPhoto(t, id, 'thumb'));
        if (!thumb) continue;
        await this.store.savePhotoThumb(id, thumb.bytes);
        // هر چند عکس یک بار صفحه تازه شود، نه با هر عکس.
        if (++got % PHOTO_BATCH === 0) this.notify();
      }
    }
    if (got % PHOTO_BATCH) this.notify();
  }

  /** چند عکس کامل در پس‌زمینه تا دستگاه بی‌اینترنت هم همه را داشته باشد. true = هنوز مانده. */
  private async fullsDown(): Promise<boolean> {
    const ids = (await this.store.fullPhotosToDownload(this.missing.size + FULL_PER_CYCLE)).filter((id) => !this.missing.has(id)).slice(0, FULL_PER_CYCLE);
    for (const id of ids) {
      if (this.stopped) return false;
      await this.full(id);
    }
    return ids.length === FULL_PER_CYCLE;
  }

  /** یک عکس کامل؛ درخواست هم‌زمان برای همان عکس (پس‌زمینه و نمایشگر) یکی می‌شود. true = حالا روی دستگاه است. */
  private full(id: string): Promise<boolean> {
    let p = this.fulls.get(id);
    if (!p) {
      p = this.withToken((t) => this.api.downloadPhoto(t, id, 'full'))
        .then(async (r) => {
          if (!r) {
            this.missing.add(id);
            return false;
          }
          await this.store.savePhotoFull(id, r.mime, r.bytes);
          return true;
        })
        .finally(() => this.fulls.delete(id));
      this.fulls.set(id, p);
    }
    return p;
  }

  /** کسی همین حالا عکسی را باز کرد که عکس کاملش هنوز نرسیده؛ تا آن وقت بندانگشتی مات دیده می‌شود. */
  fetchFull(id: string): Promise<boolean> {
    if (this.stopped) return Promise.resolve(false);
    return this.full(id).catch(() => false);
  }

  private notify() {
    this.applying = true;
    try {
      this.target.refresh();
    } finally {
      this.applying = false;
    }
  }
}

/** دفتر توکن دسترسی (ادعای off در JWT). برای توکنی که JWT نیست (پیش‌نمایش) null. امضا را سرور بررسی می‌کند. */
export function tokenOffice(token: string): string | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const off = (JSON.parse(json) as { off?: unknown }).off;
    return typeof off === 'string' ? off : null;
  } catch {
    return null;
  }
}
