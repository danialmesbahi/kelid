import type { Session } from './api';

/** آنچه از ورود روی دستگاه می‌ماند؛ توکن کوتاه‌عمر دسترسی فقط در حافظه است. */
export type SavedSession = Pick<Session, 'refreshToken' | 'deviceId' | 'user' | 'office' | 'invite'>;

const KEY = 'kelid.session';

// توکن‌های تمدیدِ دستگاه‌هایی که خروجشان هنوز به سرور نرسیده؛ کنار خود نشست (روی ویندوز رمزشده) می‌مانند.
let current: SavedSession | null = null;
let out: string[] = [];

// ویندوز: فایل رمزشده با DPAPI در پروسهٔ اصلی (apps/desktop/src/session.ts). وب: حافظهٔ مرورگر، مثل خود داده‌ها.
export async function loadSession(): Promise<SavedSession | null> {
  try {
    const raw = window.kelid?.session ? await window.kelid.session.get() : localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as Partial<SavedSession> & { out?: unknown }) : {};
    out = Array.isArray(v.out) ? v.out.filter((t): t is string => typeof t === 'string') : [];
    current = parse(v);
  } catch {
    current = null;
  }
  return current;
}

export async function saveSession(s: SavedSession): Promise<void> {
  current = { refreshToken: s.refreshToken, deviceId: s.deviceId, user: s.user, office: s.office, invite: s.invite ?? null };
  await write();
}

export async function clearSession(): Promise<void> {
  current = null;
  try {
    await write();
  } catch {
    /* چیزی برای پاک کردن نبود */
  }
}

/** خروجی که سرور نشنید؛ دفعهٔ بعد که اینترنت بود فرستاده می‌شود. */
export function pendingLogouts(): string[] {
  return out.slice();
}

export async function setPendingLogouts(tokens: string[]): Promise<void> {
  // سقف کوچک: بیشتر از این یعنی سرور مدت‌هاست در دسترس نیست و دستگاه‌های قدیمی خودشان کهنه می‌شوند.
  out = tokens.slice(-5);
  await write();
}

async function write(): Promise<void> {
  const raw = current || out.length ? JSON.stringify({ ...current, ...(out.length ? { out } : {}) }) : null;
  if (window.kelid?.session) await (raw ? window.kelid.session.set(raw) : window.kelid.session.clear());
  else if (raw) localStorage.setItem(KEY, raw);
  else localStorage.removeItem(KEY);
}

function parse(v: Partial<SavedSession>): SavedSession | null {
  const ok = typeof v.refreshToken === 'string' && typeof v.deviceId === 'string' && typeof v.user?.id === 'string' && typeof v.office?.id === 'string';
  const s = v as SavedSession;
  return ok ? { refreshToken: s.refreshToken, deviceId: s.deviceId, user: s.user, office: s.office, invite: s.invite ?? null } : null;
}

// پیوستن به دفتر دیگر از تنظیمات: کاربر همان‌جا پذیرفت که اطلاعات دفتر قبلی از این دستگاه برود.
// پس اگر چیزی در صف ارسال نمانده باشد، پرسش «این دستگاه اطلاعات دفتر دیگری را دارد» لازم نیست.
const JOINING = 'kelid.joining';

export function markJoining(officeId: string): void {
  try {
    sessionStorage.setItem(JOINING, officeId);
  } catch {
    /* بدون حافظهٔ موقت همان پرسش معمول می‌آید */
  }
}

export function takeJoining(officeId: string): boolean {
  try {
    const hit = sessionStorage.getItem(JOINING) === officeId;
    sessionStorage.removeItem(JOINING);
    return hit;
  } catch {
    return false;
  }
}
