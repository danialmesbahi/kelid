import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { MemoryStore, SqlStore, seed, type KelidStore } from '@kelid/core';
import { openDriver } from './db/drivers';
import { Splash } from './layout/Splash';

export type StorageInfo = { persistent: boolean; where: 'desktop' | 'browser' | 'memory' | 'locked' };

// SqlStore هم مثل درایور فقط یک بار ساخته می‌شود.
const stores = new WeakMap<object, Promise<KelidStore>>();
function storeFor(driver: Parameters<typeof SqlStore.open>[0]): Promise<KelidStore> {
  let p = stores.get(driver);
  if (!p) {
    p = SqlStore.open(driver, seed);
    stores.set(driver, p);
  }
  return p;
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
    (async () => {
      try {
        const { driver, persistent, where } = await openDriver();
        const store = await storeFor(driver);
        if (!cancelled) setState({ store, storage: { persistent, where } });
      } catch (err) {
        console.error(err);
        // آخرین راه: برنامه با دادهٔ موقت باز شود تا کاربر قفل نشود.
        if (!cancelled) setState({ store: new MemoryStore(seed), storage: { persistent: false, where: 'memory' } });
      }
    })();
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
 */
const cache = new Map<string, unknown>();

export function useQuery<T>(key: string, fn: (s: KelidStore) => Promise<T>): T | undefined {
  const store = useStore();
  const [data, setData] = useState<T | undefined>(() => cache.get(key) as T | undefined);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let alive = true;
    if (cache.has(key)) setData(cache.get(key) as T);
    const run = () => {
      fnRef.current(store).then(
        (d) => {
          cache.set(key, d);
          if (alive) setData(d);
        },
        (err) => console.error(key, err),
      );
    };
    run();
    const off = store.subscribe(run);
    return () => {
      alive = false;
      off();
    };
  }, [store, key]);

  return data;
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
