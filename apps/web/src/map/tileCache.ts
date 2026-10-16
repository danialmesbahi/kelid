/**
 * نقشهٔ آفلاین: هر کاشی، استایل و فونتی که نقشه از سرور نقشه می‌گیرد روی همین دستگاه (IndexedDB) هم می‌ماند.
 * بی‌اینترنت، جاهایی که قبلاً دیده شده‌اند باز هم دیده می‌شوند. این کار جدا از دادهٔ دفتر است و همگام نمی‌شود.
 *
 * چرا fetch و نه Service Worker: نسخهٔ ویندوز از file:// باز می‌شود و Service Worker ندارد؛ این راه هر دو را می‌پوشاند.
 * فقط نشانی‌های سرور نقشه دست می‌خورند؛ بقیهٔ درخواست‌های برنامه همان fetch اصلی‌اند.
 */
const TILE_HOST = /^https:\/\/(?!api\.)([a-z0-9-]+\.)*neshan\.org\//i;
const DB_NAME = 'kelid-map';
const STORE = 'files';
/** حدود ۱۵۰ مگابایت؛ بیشتر از آن قدیمی‌ترها پاک می‌شوند. */
const MAX_ITEMS = 5000;
/** کاشی‌ها کم عوض می‌شوند؛ بعد از دو هفته در پس‌زمینه تازه می‌شوند. */
const FRESH_MS = 14 * 24 * 3600_000;

type Item = { url: string; body: ArrayBuffer; type: string; t: number };

let dbp: Promise<IDBDatabase | null> | undefined;
function db(): Promise<IDBDatabase | null> {
  dbp ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'url' }).createIndex('t', 't');
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

/** کلید API در نشانی است؛ بدون آن ذخیره می‌شود تا با عوض شدن کلید، نقشهٔ ذخیره‌شده از دست نرود. */
export function cacheKey(url: string): string {
  const u = new URL(url);
  u.searchParams.delete('key');
  return u.href;
}

let writes = 0;
async function save(url: string, res: Response) {
  const body = await res.arrayBuffer();
  await tx('readwrite', (s) => s.put({ url, body, type: res.headers.get('content-type') ?? '', t: Date.now() } satisfies Item));
  if (++writes % 200 === 0) void prune();
}

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

const fromItem = (it: Item) => new Response(it.body.slice(0), { status: 200, headers: it.type ? { 'content-type': it.type } : {} });

async function cachedFetch(net: typeof fetch, input: RequestInfo | URL, init: RequestInit | undefined, url: string): Promise<Response> {
  const key = cacheKey(url);
  const hit = await tx<Item | undefined>('readonly', (s) => s.get(key));
  // استایل کوچک است و ممکن است عوض شود: اول از شبکه. کاشی‌ها اول از دستگاه، که نقشه فوری بیاید.
  const styleLike = /\.json(\?|$)/.test(url);
  if (hit && (!styleLike || !navigator.onLine)) {
    if (navigator.onLine && Date.now() - hit.t > FRESH_MS) {
      void net(url).then((r) => (r.ok ? save(key, r) : undefined)).catch(() => undefined);
    }
    return fromItem(hit);
  }
  try {
    const res = await net(input, init);
    if (res.ok && res.status === 200) void save(key, res.clone());
    return res;
  } catch (err) {
    if (hit) return fromItem(hit);
    throw err;
  }
}

let installed = false;
/** یک بار، پیش از ساختن اولین نقشه. */
export function installTileCache() {
  if (installed || typeof indexedDB === 'undefined') return;
  installed = true;
  const net = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    return TILE_HOST.test(url) ? cachedFetch(net, input, init, url) : net(input, init);
  };
}
