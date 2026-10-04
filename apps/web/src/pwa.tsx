import { useEffect } from 'react';
import { useToast } from './layout/Toasts';

// به‌روزرسانی خودکار وسط کار صفحه را تازه می‌کرد و فرم نیمه‌کاره را پاک می‌کرد؛ حالا کاربر خودش زمانش را انتخاب می‌کند.
let apply: (() => void) | null = null;
const listeners = new Set<() => void>();

/** Service Worker فقط در وب؛ نسخهٔ ویندوز همه‌چیز را از فایل‌های خود برنامه می‌خواند. */
export function registerPwa() {
  if (!import.meta.env.PROD || window.kelid || !('serviceWorker' in navigator)) return;
  void import('virtual:pwa-register').then(({ registerSW }) => {
    const update = registerSW({
      immediate: true,
      onNeedRefresh: () => {
        apply = () => void update(true);
        listeners.forEach((f) => f());
      },
    });
  });
}

/** اعلان «نسخهٔ تازه»؛ اگر کاربر رد شود، نسخهٔ تازه دفعهٔ بعد که برنامه باز شود می‌آید. */
export function UpdateNotice() {
  const toast = useToast();
  useEffect(() => {
    const show = () => {
      if (apply) toast('نسخهٔ تازهٔ کلید آماده است', { label: 'به‌روزرسانی', run: apply });
    };
    show();
    listeners.add(show);
    return () => {
      listeners.delete(show);
    };
  }, [toast]);
  return null;
}
