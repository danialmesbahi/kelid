import { useEffect, useSyncExternalStore } from 'react';
import { useAuth } from '../auth/AuthContext';

// تعداد تیکت‌هایی که پاسخ دیده‌نشده دارند؛ بیرون از React تا نوار کناری و برگهٔ «بیشتر» یکی را بخوانند.
let unread = 0;
const listeners = new Set<() => void>();

export function setSupportUnread(n: number) {
  if (n === unread) return;
  unread = n;
  listeners.forEach((l) => l());
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};

export function useSupportUnread(): number {
  return useSyncExternalStore(
    subscribe,
    () => unread,
    () => unread,
  );
}

/** نشان پشتیبانی را تازه نگه می‌دارد: با باز شدن برنامه، برگشتن به آن و وصل شدن اینترنت (تیکت چت زنده نیست). */
export function useSupportUnreadSync() {
  const { status, api, withToken } = useAuth();
  const on = status === 'signedIn' && !!api;
  useEffect(() => {
    if (!on || !api) {
      setSupportUnread(0);
      return;
    }
    const load = () => void withToken((t) => api.unreadTickets(t)).then(setSupportUnread, () => {});
    const onVisible = () => document.visibilityState === 'visible' && load();
    load();
    addEventListener('online', load);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      removeEventListener('online', load);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [on, api, withToken]);
}
