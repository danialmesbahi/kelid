import { FetchSource, PMTiles, type RangeResponse, type Source } from 'pmtiles';
import { tilesUrl } from './provider';

/**
 * نقشهٔ آفلاین: هر تکه‌ای از فایل نقشه که یک بار خوانده شد روی همین دستگاه (IndexedDB) می‌ماند،
 * پس بی‌اینترنت جاهایی که قبلاً دیده شده‌اند باز هم کامل دیده می‌شوند. جدا از دادهٔ دفتر است و همگام نمی‌شود.
 * سرصفحهٔ فایل (اولین تکه) با اینترنت همیشه از سرور تازه می‌شود؛ اگر فایل نقشه روی سرور عوض شده باشد، کش قدیمی پاک می‌شود.
 */
const DB_NAME = 'kelid-map';
const STORE = 'bytes';
/** حدود ۲۰۰ مگابایت؛ بیشتر از آن قدیمی‌ترها پاک می‌شوند. */
const MAX_ITEMS = 6000;

type Item = { k: string; data: ArrayBuffer; t: number };

let dbp: Promise<IDBDatabase | null> | undefined;
function db(): Promise<IDBDatabase | null> {
  dbp ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 2);
      req.onupgradeneeded = () => {
        const d = req.result;
        for (const n of [...d.objectStoreNames]) d.deleteObjectStore(n);
        d.createObjectStore(STORE, { keyPath: 'k' }).createIndex('t', 't');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbp;
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return db().then(
    (d) =>
      new Promise<T | undefined>((resolve) => {
        if (!d) return resolve(undefined);
        try {
          const t = d.transaction(STORE, mode);
          const req = run(t.objectStore(STORE));
          t.oncomplete = () => resolve(req ? req.result : undefined);
          t.onerror = t.onabort = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      }),
  );
}

let writes = 0;
async function prune() {
  const count = await tx<number>('readonly', (s) => s.count());
  if (!count || count <= MAX_ITEMS) return;
  let extra = count - Math.floor(MAX_ITEMS * 0.9);
  await tx('readwrite', (s) => {
    const cur = s.index('t').openCursor();
    cur.onsuccess = () => {
      const c = cur.result;
      if (!c || extra-- <= 0) return;
      c.delete();
      c.continue();
    };
  });
}

const same = (a: ArrayBuffer, b: ArrayBuffer) => {
  if (a.byteLength !== b.byteLength) return false;
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  return x.every((v, i) => v === y[i]);
};

/** همان FetchSource خود pmtiles، با یک لایهٔ کش روی دستگاه. */
export class CachedSource implements Source {
  private net: FetchSource;
  constructor(private url: string) {
    this.net = new FetchSource(url);
  }

  getKey() {
    return this.url;
  }

  async getBytes(offset: number, length: number, signal?: AbortSignal, etag?: string): Promise<RangeResponse> {
    const k = `${this.url}|${offset}|${length}`;
    const header = offset === 0;
    const hit = await tx<Item | undefined>('readonly', (s) => s.get(k));
    // تکه‌های داخل فایل هرگز عوض نمی‌شوند مگر کل فایل عوض شود؛ آن را سرصفحه می‌فهماند.
    if (hit && (!header || !navigator.onLine)) return { data: hit.data };
    try {
      const r = await this.net.getBytes(offset, length, signal, etag);
      if (header && hit && !same(hit.data, r.data)) await this.clear();
      await tx('readwrite', (s) => s.put({ k, data: r.data, t: Date.now() } satisfies Item));
      if (++writes % 200 === 0) void prune();
      return r;
    } catch (err) {
      if (hit) return { data: hit.data };
      throw err;
    }
  }

  private async clear() {
    const prefix = `${this.url}|`;
    await tx('readwrite', (s) => {
      const cur = s.openCursor(IDBKeyRange.bound(prefix, `${prefix}￿`));
      cur.onsuccess = () => {
        const c = cur.result;
        if (!c) return;
        c.delete();
        c.continue();
      };
    });
  }
}

let archive: PMTiles | undefined;
/** یک فایل نقشه برای همهٔ نقشه‌های برنامه. */
export function mapArchive(): PMTiles {
  archive ??= new PMTiles(new CachedSource(tilesUrl()));
  return archive;
}

let ready: Promise<boolean> | undefined;
/** فایل نقشه هست و خوانده می‌شود (از سرور یا از کش دستگاه)؟ بی آن، فرم‌ها همان فرم ساده‌اند. */
export function mapAvailable(): Promise<boolean> {
  ready ??= mapArchive()
    .getHeader()
    .then(() => true)
    .catch(() => {
      // بار بعد (مثلاً وقتی اینترنت برگشت) دوباره امتحان شود
      ready = undefined;
      return false;
    });
  return ready;
}
