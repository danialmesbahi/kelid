import { useEffect, useSyncExternalStore } from 'react';
import { useAuth } from '../auth/AuthContext';
import { onDemoTicket } from '../auth/api';
import { onLiveSupport } from '../sync/state';

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

/** «چیزی در پشتیبانی عوض شد»: خبر زندهٔ سرور، یا پاسخ خیالی در پیش‌نمایش. */
export function onSupportChange(fn: () => void): () => void {
  const a = onLiveSupport(fn);
  const b = onDemoTicket(fn);
  return () => (a(), b());
}

/** نشان پشتیبانی را تازه نگه می‌دارد: با باز شدن برنامه، برگشتن به آن، وصل شدن اینترنت و هر پاسخ تازه. */
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
    const off = onSupportChange(load);
    addEventListener('online', load);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      off();
      removeEventListener('online', load);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [on, api, withToken]);
}
