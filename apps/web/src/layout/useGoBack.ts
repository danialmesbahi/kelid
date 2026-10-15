import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';

/** آیا داخل خود برنامه صفحهٔ قبلی‌ای هست؟ (روتر شمارهٔ هر ورودی تاریخچه را در history.state نگه می‌دارد) */
export function canGoBack(): boolean {
  return ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;
}

/**
 * «برگشت» یعنی دقیقاً صفحهٔ قبلی، نه یک صفحهٔ ثابت؛ وگرنه تاریخچه دور خودش می‌چرخد.
 * اگر صفحه مستقیم باز شده و قبلی ندارد، `fallback` جای همین صفحه می‌نشیند.
 */
export function useGoBack() {
  const navigate = useNavigate();
  return useCallback(
    (fallback: string) => {
      if (canGoBack()) void navigate(-1);
      else void navigate(fallback, { replace: true, viewTransition: true });
    },
    [navigate],
  );
}

/** ویندوز: دکمه‌های کناری ماوس و Alt+←/→ مثل مرورگر جابه‌جا کنند؛ Electron خودش این کار را نمی‌کند. */
export function useDesktopHistoryKeys() {
  useEffect(() => {
    if (!window.kelid) return;
    const onMouse = (e: MouseEvent) => {
      if (e.button === 3) history.back();
      else if (e.button === 4) history.forward();
      else return;
      e.preventDefault();
    };
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key === 'ArrowLeft') history.back();
      else if (e.key === 'ArrowRight') history.forward();
      else return;
      e.preventDefault();
    };
    window.addEventListener('mouseup', onMouse);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mouseup', onMouse);
      window.removeEventListener('keydown', onKey);
    };
  }, []);
}
