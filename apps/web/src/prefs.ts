import { useEffect, useState } from 'react';

export type ThemePref = 'light' | 'dark' | 'auto';
export type TextSize = 0 | 1 | 2;

/** بزرگ‌نمایی کل رابط؛ برای کاربرانی که نوشتهٔ درشت‌تر می‌خواهند. */
const ZOOM = [1, 1.12, 1.25] as const;

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* حالت خصوصی مرورگر؛ تنظیم فقط برای همین بار می‌ماند */
  }
}

function systemDark(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
}

/** پوسته و اندازهٔ نوشته؛ روی <html> اعمال می‌شود تا همه‌جا یکسان باشد. */
export function usePrefs() {
  const [theme, setTheme] = useState<ThemePref>(() => read('kelid.theme', 'light'));
  const [textSize, setTextSize] = useState<TextSize>(() => read('kelid.textSize', 0));
  // نام کاربر و دفتر فقط روی همین دستگاه؛ با ورود و همگام‌سازی (فاز ۲) از سرور می‌آیند.
  const [userName, setUserName] = useState<string>(() => read('kelid.userName', ''));
  const [officeName, setOfficeName] = useState<string>(() => read('kelid.officeName', ''));
  const [welcomed, setWelcomed] = useState<boolean>(() => read('kelid.welcomed', false));

  useEffect(() => {
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'auto' && systemDark());
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    write('kelid.theme', theme);
    if (theme !== 'auto') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--zoom', String(ZOOM[textSize]));
    write('kelid.textSize', textSize);
  }, [textSize]);

  useEffect(() => write('kelid.userName', userName), [userName]);
  useEffect(() => write('kelid.officeName', officeName), [officeName]);
  useEffect(() => write('kelid.welcomed', welcomed), [welcomed]);

  return { theme, setTheme, textSize, setTextSize, userName, setUserName, officeName, setOfficeName, welcomed, setWelcomed };
}

/** «علی» از «علی رضایی»؛ «آقای رضایی» و «خانم احمدی» همان‌طور می‌مانند. */
export function callName(userName: string): string {
  const w = userName.trim().split(/\s+/).filter(Boolean);
  if (w.length === 0) return '';
  return ['آقای', 'خانم', 'دکتر', 'مهندس'].includes(w[0]!) ? w.slice(0, 2).join(' ') : w[0]!;
}

/** سلام متناسب با ساعت تهران. */
export function greetingNow(): string {
  const h = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Tehran' }).format(new Date()));
  return h < 12 ? 'صبح بخیر' : h < 17 ? 'روز بخیر' : 'عصر بخیر';
}
