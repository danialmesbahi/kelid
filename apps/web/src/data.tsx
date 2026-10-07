import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { CachedStore, MemoryStore, SqlStore, seed, type KelidStore, type Syncable } from '@kelid/core';
import { API_URL } from './auth/api';
import { openDriver } from './db/drivers';
import { Splash } from './layout/Splash';

export type StorageInfo = { persistent: boolean; where: 'desktop' | 'browser' | 'memory' | 'locked' };

export interface SyncTarget {
  store: Syncable;
  /** فقط نوشتن‌های واقعی؛ اعمال آرام همگام‌سازی خبری نمی‌دهد. */
  subscribe(fn: () => void): () => void;
  /** حافظهٔ خواندن‌ها دور ریخته و صفحه‌ها تازه می‌شوند. */
  refresh(): void;
}

// SqlStore هم مثل درایور فقط یک بار ساخته می‌شود.
let opening: Promise<{ store: KelidStore; storage: StorageInfo }> | null = null;
let syncTarget: SyncTarget | null = null;

/** دیتابیس ماندگار برای همگام‌سازی؛ حافظهٔ موقت (تب قفل، مرورگر بی‌حافظه) هیچ‌وقت چیزی نمی‌فرستد. */
export function getSyncTarget(): SyncTarget | null {
  return syncTarget;
}

/**
 * دیتابیس را باز می‌کند. main.tsx آن را پیش از اولین رندر صدا می‌زند تا Worker و wasm
 * هم‌زمان با بالا آمدن React آماده شوند، نه بعد از آن.
 */
export function openStore(): Promise<{ store: KelidStore; storage: StorageInfo }> {
  opening ??= (async () => {
    try {
      const { driver, persistent, where } = await openDriver();
      // با حساب کلید فقط دادهٔ واقعی دفتر؛ نمونه‌ها مال حالت بی‌سرور (فقط همین دستگاه) است.
      const sql = await SqlStore.open(driver, API_URL ? undefined : seed);
      const cached = new CachedStore(sql);
      // حافظهٔ موقت (مرورگر بی‌OPFS، یا تب دوم) هم همگام می‌شود: داده از سرور دفتر می‌آید و تغییرها همان لحظه می‌روند.
      // وگرنه کاربرِ واردشده دفتری خالی می‌دید و هر چه ثبت می‌کرد با بستن صفحه گم می‌شد.
      syncTarget = {
        store: sql,
        subscribe: (fn) => sql.subscribe(fn),
        refresh: () => {
          cached.dropAll();
          sql.notifyChanged();
        },
      };
      return { store: cached, storage: { persistent, where } };
    } catch (err) {
      console.error(err);
      // آخرین راه: برنامه با دادهٔ موقت باز شود تا کاربر قفل نشود.
      return { store: new CachedStore(new MemoryStore(API_URL ? { listings: [], clients: [], visits: [], todos: [], deals: [] } : seed)), storage: { persistent: false, where: 'memory' as const } };
    }
  })();
  return opening;
}

const StoreContext = createContext<{ store: KelidStore; storage: StorageInfo } | null>(null);

/**
 * دیتابیس را یک بار باز می‌کند؛ تا آماده شود صفحهٔ شروع کلید نمایش داده می‌شود.
 * ویندوز: SQLite رمزگذاری‌شده. وب: SQLite روی حافظهٔ ماندگار مرورگر.
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ store: KelidStore; storage: StorageInfo } | { error: string }>();

  useEffect(() => {
    let cancelled = false;
    void openStore().then((s) => {
      if (!cancelled) setState(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state) return <Splash />;
  if ('error' in state) return <Splash error={state.error} />;
  return <StoreContext.Provider value={state}>{children}</StoreContext.Provider>;
}

export function useStore(): KelidStore {
  const s = useContext(StoreContext);
  if (!s) throw new Error('StoreProvider missing');
  return s.store;
}

export function useStorageInfo(): StorageInfo {
  const s = useContext(StoreContext);
  if (!s) throw new Error('StoreProvider missing');
  return s.storage;
}

/**
 * حافظهٔ نتیجهٔ کوئری‌ها: وقتی به صفحه‌ای برمی‌گردید، آخرین داده فوراً نمایش داده می‌شود
 * و در پس‌زمینه تازه می‌شود. پس برگشتن هیچ‌وقت لودینگ ندارد.
 * صفحه‌های اصلی از قبل «گرم» می‌شوند (prefetchQuery) تا اولین باز شدنشان هم بی‌مکث باشد.
 */
type Entry = { data: unknown; has: boolean; fn: (s: KelidStore) => Promise<unknown>; seq: number; warm: boolean; stale: boolean; listeners: Set<() => void> };
const entries = new Map<string, Entry>();
const watched = new WeakSet<KelidStore>();

/** اگر همهٔ بخش‌های نتیجه همان قبلی باشند، صفحه دوباره رندر نمی‌شود. */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) || Array.isArray(b)) return false;
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => (a as Record<string, unknown>)[k] === (b as Record<string, unknown>)[k]);
}

function entryFor(key: string, fn: Entry['fn']): Entry {
  let e = entries.get(key);
  if (!e) {
    e = { data: undefined, has: false, fn, seq: 0, warm: false, stale: true, listeners: new Set() };
    entries.set(key, e);
  }
  return e;
}

function refresh(store: KelidStore, key: string, e: Entry) {
  const my = ++e.seq;
  e.stale = false;
  e.fn(store).then(
    (d) => {
      // جواب کهنه‌تر از درخواست بعدی دور ریخته می‌شود
      if (my !== e.seq || (e.has && same(e.data, d))) return;
      e.data = d;
      e.has = true;
      for (const l of e.listeners) l();
    },
    (err) => console.error(key, err),
  );
}

/** با هر تغییر داده، کوئری‌های روی صفحه و صفحه‌های گرم تازه می‌شوند؛ بقیه فقط کهنه علامت می‌خورند. */
function watch(store: KelidStore) {
  if (watched.has(store)) return;
  watched.add(store);
  store.subscribe(() => {
    for (const [key, e] of entries) {
      if (e.listeners.size || e.warm) refresh(store, key, e);
      else e.stale = true;
    }
  });
}

/** دادهٔ یک صفحه را از قبل می‌خواند و همیشه تازه نگه می‌دارد. */
export function prefetchQuery(store: KelidStore, q: { key: string; fn: Entry['fn'] }) {
  watch(store);
  const e = entryFor(q.key, q.fn);
  e.warm = true;
  if (!e.has && e.seq === 0) refresh(store, q.key, e);
}

/** نتیجهٔ ذخیره‌شدهٔ یک کوئری، بدون خواندن دیتابیس؛ برای ساختن جانشین فوری (placeholder). */
export function peekQuery<T>(key: string): T | undefined {
  return entries.get(key)?.data as T | undefined;
}

/**
 * `placeholder` اگر باشد و هنوز نتیجه‌ای نیامده، همان لحظه از دادهٔ موجود ساخته می‌شود؛ مثلاً پرونده از
 * فهرست فایل‌ها. اولین رندر صفحه کامل است و انتقال عکس (view transition) مقصدش را پیدا می‌کند.
 */
export function useQuery<T>(key: string, fn: (s: KelidStore) => Promise<T>, placeholder?: () => T | undefined): T | undefined {
  const store = useStore();
  const e = entryFor(key, fn);
  e.fn = fn;
  // has دست نمی‌خورد تا جواب واقعی دیتابیس حتماً جایگزینش شود
  if (e.data === undefined && placeholder) e.data = placeholder();
  const subscribe = useCallback(
    (cb: () => void) => {
      watch(store);
      // ورودی در همین رندر ساخته شده است
      const cur = entries.get(key)!;
      cur.listeners.add(cb);
      if (cur.stale) refresh(store, key, cur);
      return () => {
        cur.listeners.delete(cb);
      };
    },
    [store, key],
  );
  const get = () => entries.get(key)?.data as T | undefined;
  return useSyncExternalStore(subscribe, get, get);
}

/** true فقط اگر `pending` بیشتر از `ms` طول بکشد؛ تا اسکلت لودینگ برای کارهای سریع چشمک نزند. */
export function useSlow(pending: boolean, ms = 120): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!pending) {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), ms);
    return () => clearTimeout(t);
  }, [pending, ms]);
  return slow;
}
