import { newId } from '@kelid/core';
import { ApiError, type AuthApi } from '../auth/api';
import { ReadOnlyError } from '../billing/readOnly';

// ابزار بتا: خطاهای برنامه و نظر کاربر. هر دو اول روی همین دستگاه صف می‌شوند (بی‌اینترنت هم گم نمی‌شوند)
// و وقتی وارد حساب‌اید به سرور خود کلید می‌روند؛ هیچ سرویس بیرونی در کار نیست.

declare const __KELID_VERSION__: string;
export const APP_VERSION = typeof __KELID_VERSION__ === 'string' ? __KELID_VERSION__ : '';

export type FeedbackKind = 'problem' | 'idea' | 'praise';
export type Platform = 'web' | 'pwa' | 'desktop';

export interface PendingError {
  message: string;
  stack: string;
  page: string;
  count: number;
}

export interface PendingFeedback {
  id: string;
  kind: FeedbackKind;
  body: string;
  page: string;
  tries?: number;
}

const ERRORS = 'kelid.beta.errors';
const FEEDBACK = 'kelid.beta.feedback';
const MAX_ERRORS = 20;
const MAX_FEEDBACK = 20;

function read<T>(key: string): T[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown;
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

function write(key: string, list: unknown[]) {
  try {
    if (list.length) localStorage.setItem(key, JSON.stringify(list));
    else localStorage.removeItem(key);
  } catch {
    // حافظهٔ مرورگر بسته یا پر است؛ گزارش از دست می‌رود، برنامه نه.
  }
}

export function platform(): Platform {
  if (typeof window !== 'undefined' && window.kelid?.platform === 'desktop') return 'desktop';
  return typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches ? 'pwa' : 'web';
}

/** مسیر صفحه بی شناسه‌ها (شناسهٔ فایل و مشتری به گزارش نمی‌رود). */
export function currentPage(hash = typeof location === 'undefined' ? '' : location.hash): string {
  return (hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/(?=[^/]*\d|[^/]{20,})[^/]+/g, '/:id').slice(0, 200);
}

const changed = new Set<() => void>();
/** صف عوض شد (برای فرستادن زودتر). */
export function onQueued(fn: () => void): () => void {
  changed.add(fn);
  return () => void changed.delete(fn);
}

// خطاهایی که باگ ما نیستند: افزونه‌های مرورگر، قطع شبکه، حالت فقط‌خواندنی و هشدار بی‌خطر ResizeObserver.
function ignored(e: unknown, message: string, stack: string): boolean {
  if (e instanceof ApiError || e instanceof ReadOnlyError) return true;
  if (e instanceof DOMException && e.name === 'AbortError') return true;
  if (/^(Script error\.?|ResizeObserver loop)/.test(message)) return true;
  if (/^(Failed to fetch|NetworkError|Load failed)/.test(message)) return true;
  return /(chrome|moz|safari)-extension:\/\//.test(stack);
}

/** یک خطا در صف؛ همان خطای تکراری فقط شمارش می‌شود. */
export function captureError(e: unknown) {
  const err = e instanceof Error ? e : null;
  const message = (err ? `${err.name}: ${err.message}` : String(e)).slice(0, 1000).trim();
  const stack = (err?.stack ?? '').slice(0, 8000);
  if (!message || ignored(e, err?.message ?? message, stack)) return;
  const list = read<PendingError>(ERRORS);
  const top = stack.split('\n')[1] ?? '';
  const same = list.find((x) => x.message === message && (x.stack.split('\n')[1] ?? '') === top);
  if (same) same.count = Math.min(same.count + 1, 1000);
  else if (list.length < MAX_ERRORS) list.push({ message, stack, page: currentPage(), count: 1 });
  else return;
  write(ERRORS, list);
  changed.forEach((f) => f());
}

let installed = false;
/** گوش دادن به خطاهای پیش‌بینی‌نشده؛ یک بار در main.tsx. */
export function installErrorCapture() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  addEventListener('error', (ev) => captureError(ev.error ?? ev.message));
  addEventListener('unhandledrejection', (ev) => captureError(ev.reason));
}

export function pendingFeedback(): PendingFeedback[] {
  return read<PendingFeedback>(FEEDBACK);
}

export function queueFeedback(kind: FeedbackKind, body: string): PendingFeedback {
  const f: PendingFeedback = { id: newId(), kind, body: body.trim().slice(0, 2000), page: currentPage() };
  write(FEEDBACK, [...pendingFeedback(), f].slice(-MAX_FEEDBACK));
  changed.forEach((fn) => fn());
  return f;
}

let flushing: Promise<void> | null = null;

/**
 * صف‌ها را می‌فرستد. هر نظر شناسهٔ خودش را دارد، پس پاسخِ گم‌شده و دوباره فرستادن تکراری نمی‌سازد.
 * خطاها فقط بعد از تأیید سرور از صف پاک می‌شوند؛ خطایی که وسط ارسال آمد در صف می‌ماند.
 */
export function flushBeta(api: AuthApi, withToken: <T>(fn: (t: string) => Promise<T>) => Promise<T>): Promise<void> {
  flushing ??= (async () => {
    const where = { appVersion: APP_VERSION, platform: platform() };
    for (const f of pendingFeedback()) {
      try {
        await withToken((t) => api.sendFeedback(t, { id: f.id, kind: f.kind, body: f.body, page: f.page, ...where }));
      } catch (e) {
        // نبود اینترنت یعنی دفعهٔ بعد؛ نظری که سرور پنج بار پس زد صف را برای همیشه نمی‌بندد.
        if (e instanceof ApiError && e.code === 'server' && (f.tries ?? 0) < 4) {
          write(
            FEEDBACK,
            pendingFeedback().map((x) => (x.id === f.id ? { ...x, tries: (x.tries ?? 0) + 1 } : x)),
          );
        }
        if (!(e instanceof ApiError && e.code === 'server' && (f.tries ?? 0) >= 4)) return;
      }
      write(
        FEEDBACK,
        pendingFeedback().filter((x) => x.id !== f.id),
      );
    }
    const sent = read<PendingError>(ERRORS).slice(0, 10);
    if (!sent.length) return;
    try {
      await withToken((t) =>
        api.reportErrors(
          t,
          sent.map((e) => ({ ...e, ...where })),
        ),
      );
    } catch {
      return;
    }
    const left = read<PendingError>(ERRORS);
    write(
      ERRORS,
      left
        .map((x) => {
          const s = sent.find((y) => y.message === x.message && y.stack === x.stack);
          return s ? { ...x, count: x.count - s.count } : x;
        })
        .filter((x) => x.count > 0),
    );
  })().finally(() => (flushing = null));
  return flushing;
}

/** خروج با پاک کردن دستگاه: گزارش‌های این حساب هم می‌روند. */
export function clearBetaQueues() {
  write(ERRORS, []);
  write(FEEDBACK, []);
}
