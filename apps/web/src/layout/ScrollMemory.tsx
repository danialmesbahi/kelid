import { useEffect, useLayoutEffect } from 'react';
import { Outlet, useLocation, useNavigationType, type Location } from 'react-router';

// جای اسکرول هر صفحه در تاریخچه، با کلید همان ورودی تاریخچه
const positions = new Map<string, number>();
// چند مکان آخری که باز شده‌اند، برای فهمیدن «برگشت از جزئیات به فهرست»
const trail: Location[] = [];
let currentKey = '';
let pending = 0; // هر جابه‌جایی تازه، تلاش‌های برگرداندن قبلی را بی‌اثر می‌کند

function scrollToY(y: number) {
  window.scrollTo({ top: y, behavior: 'instant' });
}

/** فهرست‌ها کمی بعد کامل ساخته می‌شوند؛ چند فریم صبر می‌کنیم تا صفحه آن‌قدر بلند شود. */
function restore(y: number) {
  const id = pending;
  let tries = 0;
  const step = () => {
    if (id !== pending) return;
    scrollToY(y);
    if (Math.abs(window.scrollY - y) > 1 && ++tries < 30) requestAnimationFrame(step);
  };
  step();
}

/**
 * با رفتن به صفحهٔ دیگر، صفحهٔ تازه از بالا شروع می‌شود.
 * برگشت (دکمهٔ برگشت مرورگر/گوشی، یا از جزئیات فایل به فهرست فایل‌ها) جای قبلی فهرست را نگه می‌دارد.
 * عوض شدن فقط پارامترهای آدرس (مثل انتخاب مشتری در کنار فهرست) اسکرول را دست نمی‌زند.
 */
export function ScrollMemory() {
  const location = useLocation();
  const type = useNavigationType();

  useEffect(() => {
    // مرورگر خودش جای اسکرول را برنگرداند؛ این کار با ماست
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    const onScroll = () => positions.set(currentKey, window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useLayoutEffect(() => {
    const prev = trail.at(-1);
    const before = trail.at(-2);
    if (prev?.key === location.key) return; // StrictMode اثر را دوبار اجرا می‌کند
    currentKey = location.key;
    pending++;
    trail.push(location);
    if (trail.length > 3) trail.shift();
    if (!prev) return;

    if (type === 'POP') return restore(positions.get(location.key) ?? 0);
    if (prev.pathname === location.pathname) {
      // زدن دوباره روی تبی که باز است = برگشت به بالای همان صفحه
      if (prev.search === location.search) window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    // از جزئیات (مثل ‎/files/12) به همان فهرستی که از آن آمده بودیم
    const backToList = location.pathname !== '/' && prev.pathname.startsWith(`${location.pathname}/`) && before?.pathname === location.pathname;
    if (backToList) restore(positions.get(before.key) ?? 0);
    else scrollToY(0);
  }, [location, type]);

  return <Outlet />;
}
