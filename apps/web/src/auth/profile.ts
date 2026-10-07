import type { AuthApi } from './api';

// نام شما و نام دفتر روی سرور هم هست تا دستگاه‌های دیگر دفتر ببینند. ویرایش بی‌اینترنت در صف می‌ماند و بعداً می‌رود.
const KEY = 'kelid.profile.pending';
export type ProfilePatch = { name?: string; officeName?: string };

export function pendingProfile(): ProfilePatch | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ProfilePatch) : null;
  } catch {
    return null;
  }
}

export function queueProfile(p: ProfilePatch) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...pendingProfile(), ...p }));
  } catch {
    // حافظهٔ مرورگر بسته است؛ نام فقط روی همین دستگاه عوض می‌شود.
  }
}

let flushing: Promise<void> | null = null;

/** صف را می‌فرستد؛ نبود اینترنت یعنی دفعهٔ بعد. */
export function flushProfile(api: AuthApi, withToken: <T>(fn: (t: string) => Promise<T>) => Promise<T>, done: (r: { name: string; officeName: string }) => void): Promise<void> {
  flushing ??= (async () => {
    const p = pendingProfile();
    if (!p) return;
    try {
      const r = await withToken((t) => api.updateProfile(t, p));
      // اگر وسط ارسال دوباره ویرایش شد، همان ویرایش تازه در صف می‌ماند.
      if (JSON.stringify(pendingProfile()) === JSON.stringify(p)) localStorage.removeItem(KEY);
      done(r);
    } catch {
      /* دفعهٔ بعد */
    }
  })().finally(() => (flushing = null));
  return flushing;
}

export function clearProfileQueue() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* چیزی نبود */
  }
}
