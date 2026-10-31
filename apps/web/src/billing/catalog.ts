import { useSyncExternalStore } from 'react';
import { DEFAULT_CATALOG, type Catalog } from '@kelid/core';

// پلن‌ها و مدت‌های خرید از سرور (پنل کلید عوضشان می‌کند). روی دستگاه می‌ماند تا بی‌اینترنت هم نام پلن درست دیده شود؛
// پیش از اولین بار، فهرست پیش‌فرض.
const KEY = 'kelid.catalog';
const subs = new Set<() => void>();
let current: Catalog = read() ?? DEFAULT_CATALOG;

function read(): Catalog | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Catalog | null;
    return c && Array.isArray(c.plans) && Array.isArray(c.terms) && c.plans.length && c.terms.length ? c : null;
  } catch {
    return null;
  }
}

/** فهرست تازه از پاسخ /billing؛ سرور قدیمی مدت‌ها را نمی‌فرستد و همان قبلی می‌ماند. */
export function keepCatalog(c: { plans: Catalog['plans']; terms?: Catalog['terms'] }) {
  const next: Catalog = { plans: c.plans, terms: c.terms?.length ? c.terms : current.terms };
  if (!next.plans.length || JSON.stringify(next) === JSON.stringify(current)) return;
  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* بی حافظه، فقط تا بسته شدن برنامه */
  }
  subs.forEach((f) => f());
}

export function getCatalog(): Catalog {
  return current;
}

export function useCatalog(): Catalog {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => void subs.delete(f);
    },
    () => current,
  );
}
