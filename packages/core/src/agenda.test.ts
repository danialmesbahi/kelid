import { describe, expect, it } from 'vitest';
import { minutesToHhmm, tehranAt, tehranMinutes, weekStart } from './agenda';
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
});
