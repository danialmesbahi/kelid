import type { KelidStore } from '@kelid/core';
import { isReadOnly } from './license';

/** نوشتنی که به خاطر پایان اشتراک انجام نشد؛ صفحه‌ها لازم نیست کاری بکنند، پیامش را ReadOnlyToast می‌دهد. */
export class ReadOnlyError extends Error {
  constructor() {
    super('read-only');
  }
}

// هر متد تازهٔ نوشتن در KelidStore باید این‌جا هم بیاید. پاک کردن دادهٔ نمونه نیست: فقط روی همین دستگاه است.
const WRITES: ReadonlySet<PropertyKey> = new Set<keyof KelidStore>([
  'addListing',
  'updateListing',
  'archiveListing',
  'restoreListing',
  'addClient',
  'updateClient',
  'archiveClient',
  'restoreClient',
  'addVisit',
  'updateVisit',
  'addTodo',
  'setTodoDone',
  'deleteTodo',
  'restoreTodo',
  'addPhotos',
  'reorderPhotos',
  'deletePhoto',
  'restorePhoto',
  'addDeal',
  'updateDeal',
  'archiveDeal',
  'restoreDeal',
]);

let blocked: (() => void) | null = null;

/** کسی که به کاربر می‌گوید چرا ذخیره نشد (یک اعلان با «تمدید»). */
export function onBlockedWrite(fn: (() => void) | null): void {
  blocked = fn;
}

if (typeof addEventListener === 'function') {
  // نوشتنِ بسته‌شده خطای برنامه نیست؛ در کنسول هم خطا حساب نمی‌شود.
  addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    if (e.reason instanceof ReadOnlyError) e.preventDefault();
  });
}

/**
 * لایهٔ داده بعد از پایان اشتراک فقط می‌خواند. خواندن‌ها دست نمی‌خورند و همگام‌سازی (که مستقیم با SqlStore کار می‌کند)
 * دادهٔ همکاران را همچنان می‌آورد.
 */
export function guardWrites<T extends KelidStore>(store: T): T {
  // هر متد یک بار ساخته می‌شود تا شناسه‌اش ثابت بماند (وابستگی hookها).
  const made = new Map<PropertyKey, unknown>();
  return new Proxy(store, {
    get(target, key) {
      const v = Reflect.get(target, key, target) as unknown;
      if (typeof v !== 'function') return v;
      let out = made.get(key);
      if (!out) {
        const fn = v as (...a: unknown[]) => unknown;
        out = WRITES.has(key)
          ? (...args: unknown[]) => {
              if (!isReadOnly()) return fn.apply(target, args);
              blocked?.();
              return Promise.reject(new ReadOnlyError());
            }
          : fn.bind(target);
        made.set(key, out);
      }
      return out;
    },
  });
}
