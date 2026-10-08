import type { Session } from './api';

/** آنچه از ورود روی دستگاه می‌ماند؛ توکن کوتاه‌عمر دسترسی فقط در حافظه است. */
export type SavedSession = Pick<Session, 'refreshToken' | 'deviceId' | 'user' | 'office'>;

const KEY = 'kelid.session';

// ویندوز: فایل رمزشده با DPAPI در پروسهٔ اصلی (apps/desktop/src/session.ts). وب: حافظهٔ مرورگر، مثل خود داده‌ها.
export async function loadSession(): Promise<SavedSession | null> {
  try {
    const raw = window.kelid?.session ? await window.kelid.session.get() : localStorage.getItem(KEY);
    return raw ? parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveSession(s: SavedSession): Promise<void> {
  const raw = JSON.stringify({ refreshToken: s.refreshToken, deviceId: s.deviceId, user: s.user, office: s.office });
  if (window.kelid?.session) await window.kelid.session.set(raw);
  else localStorage.setItem(KEY, raw);
}

export async function clearSession(): Promise<void> {
  try {
    if (window.kelid?.session) await window.kelid.session.clear();
    else localStorage.removeItem(KEY);
  } catch {
    /* چیزی برای پاک کردن نبود */
  }
}

function parse(raw: string): SavedSession | null {
  const v = JSON.parse(raw) as Partial<SavedSession>;
  const ok = typeof v.refreshToken === 'string' && typeof v.deviceId === 'string' && typeof v.user?.id === 'string' && typeof v.office?.id === 'string';
  return ok ? (v as SavedSession) : null;
}
