import { addDays, tehranIso, tehranTimeOf, weekdayIndex } from './jalali';

/** شنبهٔ همان هفته (هفتهٔ ایرانی از شنبه شروع می‌شود). */
export function weekStart(key: string): string {
  return addDays(key, -weekdayIndex(key));
}

/** دقیقه از نیمه‌شب به وقت تهران؛ برای جای قرار روی جدول ساعت‌ها. */
export function tehranMinutes(iso: string): number {
  const [h = 0, m = 0] = tehranTimeOf(iso).split(':').map(Number);
  return h * 60 + m;
}

/** «HH:MM» از دقیقه؛ دقیقه‌های بیرون از شبانه‌روز به همان روز محدود می‌شوند. */
export function minutesToHhmm(min: number): string {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** لحظهٔ «این روز، این دقیقه» به وقت تهران. */
export function tehranAt(key: string, minutes: number): string {
  return tehranIso(key, minutesToHhmm(minutes));
}
