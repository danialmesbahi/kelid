/**
 * تقویم جلالی برای انتخاب تاریخ، فقط با Intl (بدون کتابخانه).
 * هر روز با کلید «yyyy-mm-dd» میلادیِ وقت تهران نگه داشته می‌شود و برای محاسبه ظهرِ UTC همان روز
 * در نظر گرفته می‌شود تا جابه‌جایی ساعت هیچ‌وقت روز را عوض نکند. ایران از ۱۴۰۱ ساعت تابستانی ندارد.
 */

export interface JalaliDate {
  y: number;
  m: number;
  d: number;
}

export const JALALI_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
/** شنبه اول هفته است. */
export const WEEKDAYS_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

const partsFmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' });

function noon(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 12));
}

function keyOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** کلید روز امروز (یا هر لحظه) به وقت تهران. */
export function tehranDayKey(at = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(at);
}

export function addDays(key: string, n: number): string {
  const d = noon(key);
  d.setUTCDate(d.getUTCDate() + n);
  return keyOf(d);
}

export function jalaliOf(key: string): JalaliDate {
  // ترتیب اجزا بین موتورها فرق دارد؛ فقط با formatToParts و نوع هر جزء کار می‌کنیم.
  const parts = partsFmt.formatToParts(noon(key));
  const get = (t: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get('year'), m: get('month'), d: get('day') };
}

/** ۰ = شنبه … ۶ = جمعه */
export function weekdayIndex(key: string): number {
  return (noon(key).getUTCDay() + 1) % 7;
}

export function startOfJalaliMonth(key: string): string {
  return addDays(key, -(jalaliOf(key).d - 1));
}

/** همهٔ روزهای ماه جلالیِ شامل این روز، به ترتیب. */
export function jalaliMonthDays(key: string): string[] {
  const first = startOfJalaliMonth(key);
  const { m } = jalaliOf(first);
  const days: string[] = [];
  for (let k = first; jalaliOf(k).m === m; k = addDays(k, 1)) days.push(k);
  return days;
}

export function addJalaliMonths(key: string, n: number): string {
  let k = startOfJalaliMonth(key);
  for (let i = 0; i < Math.abs(n); i++) k = n > 0 ? addDays(jalaliMonthDays(k).at(-1)!, 1) : startOfJalaliMonth(addDays(k, -1));
  return k;
}

/** لحظهٔ «این روز، این ساعت» به وقت تهران، به‌صورت ISO. */
export function tehranIso(key: string, hhmm: string): string {
  return new Date(`${key}T${hhmm}:00+03:30`).toISOString();
}

/** ساعت «HH:MM» (ارقام لاتین) به وقت تهران، برای فیلدهای ویرایش. */
export function tehranTimeOf(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tehran' }).format(new Date(iso));
}

/** «یکشنبه ۱۲ مهر» */
export function formatJalaliDay(key: string): string {
  const parts = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).formatToParts(noon(key));
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('weekday')} ${get('day')} ${get('month')}`;
}
