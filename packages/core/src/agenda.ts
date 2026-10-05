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

export interface Span {
  id: string;
  start: number;
  end: number;
}

/**
 * قرارهای هم‌پوشان یک روز کنار هم می‌نشینند: هر گروه به هم چسبیده چند ستون می‌گیرد
 * و هر قرار اولین ستونی را که آزاد است. خروجی: شمارهٔ ستون و تعداد ستون‌های گروهش.
 */
export function layoutDay(spans: Span[]): Map<string, { col: number; cols: number }> {
  const out = new Map<string, { col: number; cols: number }>();
  const sorted = [...spans].sort((a, b) => a.start - b.start || b.end - a.end || a.id.localeCompare(b.id));
  let group: Array<{ id: string; col: number }> = [];
  let colEnds: number[] = [];
  let groupEnd = -Infinity;
  const flush = () => {
    for (const g of group) out.set(g.id, { col: g.col, cols: colEnds.length });
    group = [];
    colEnds = [];
  };
  for (const s of sorted) {
    // قرار کوتاه‌تر از ۱۵ دقیقه هم دست‌کم به اندازهٔ ۱۵ دقیقه جا می‌گیرد تا نوشته‌اش دیده شود.
    const end = Math.max(s.end, s.start + 15);
    if (s.start >= groupEnd) flush();
    let col = colEnds.findIndex((e) => e <= s.start);
    if (col < 0) col = colEnds.push(end) - 1;
    else colEnds[col] = end;
    group.push({ id: s.id, col });
    groupEnd = Math.max(groupEnd, end);
  }
  flush();
  return out;
}
