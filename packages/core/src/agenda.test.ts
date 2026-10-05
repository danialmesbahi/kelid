import { describe, expect, it } from 'vitest';
import { layoutDay, minutesToHhmm, tehranAt, tehranMinutes, weekStart } from './agenda';
import { weekdayIndex } from './jalali';

describe('agenda', () => {
  it('finds the Saturday that starts the week', () => {
    // ۱۲ مهر ۱۴۰۵ = یکشنبه ۴ اکتبر ۲۰۲۶
    expect(weekStart('2026-10-04')).toBe('2026-10-03');
    expect(weekStart('2026-10-03')).toBe('2026-10-03');
    expect(weekStart('2026-10-09')).toBe('2026-10-03');
    expect(weekdayIndex(weekStart('2026-10-10'))).toBe(0);
  });

  it('round-trips Tehran minutes', () => {
    const iso = tehranAt('2026-10-04', 10 * 60 + 30);
    expect(iso).toBe('2026-10-04T07:00:00.000Z');
    expect(tehranMinutes(iso)).toBe(630);
    expect(minutesToHhmm(-20)).toBe('00:00');
    expect(minutesToHhmm(24 * 60 + 5)).toBe('23:59');
  });

  it('puts overlapping visits side by side and keeps separate ones full width', () => {
    const l = layoutDay([
      { id: 'a', start: 600, end: 660 },
      { id: 'b', start: 630, end: 690 },
      { id: 'c', start: 670, end: 700 },
      { id: 'd', start: 800, end: 860 },
    ]);
    expect(l.get('a')).toEqual({ col: 0, cols: 2 });
    expect(l.get('b')).toEqual({ col: 1, cols: 2 });
    // c بعد از تمام شدن a شروع می‌شود و ستون آزاد a را می‌گیرد
    expect(l.get('c')).toEqual({ col: 0, cols: 2 });
    expect(l.get('d')).toEqual({ col: 0, cols: 1 });
  });
});
