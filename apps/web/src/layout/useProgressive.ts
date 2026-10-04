import { startTransition, useEffect, useState } from 'react';

/**
 * فهرست‌های بلند (صدها فایل) یک‌جا ساخته نمی‌شوند: چند ردیف اول فوراً دیده می‌شوند و بقیه
 * تکه‌تکه در وقت آزاد اضافه می‌شوند، تا باز شدن صفحه و کلیک‌ها هیچ‌وقت منتظر ردیف‌های پایین صفحه نمانند.
 */
export function useProgressive(total: number, first = 30, step = 100): number {
  const [n, setN] = useState(first);
  useEffect(() => {
    if (n >= total) return;
    const grow = () => startTransition(() => setN((c) => c + step));
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(grow, { timeout: 200 });
      return () => cancelIdleCallback(id);
    }
    const t = setTimeout(grow, 16);
    return () => clearTimeout(t);
  }, [n, total, step]);
  return Math.min(n, total);
}
