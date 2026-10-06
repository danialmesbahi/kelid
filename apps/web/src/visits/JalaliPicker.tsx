import { memo, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from '@kelid/ui';
import { JALALI_MONTHS, WEEKDAYS_SHORT, addDays, addJalaliMonths, formatJalaliDay, jalaliMonthDays, jalaliOf, tehranDayKey, toFaDigits, weekdayIndex } from '@kelid/core';

/**
 * انتخاب تاریخ جلالی. با صفحه‌کلید: ←/→ روز (راست‌به‌چپ)، ↑/↓ هفته، PageUp/PageDown ماه، Enter انتخاب.
 * فقط روزِ زیر فوکوس در ترتیب Tab است تا کاربر مجبور نباشد از تک‌تک روزها رد شود.
 */
export const JalaliPicker = memo(function JalaliPicker({ value, onChange, label }: { value: string; onChange: (key: string) => void; label: string }) {
  const [month, setMonth] = useState(value);
  // روزِ زیر فوکوس جدا از مقدار است: پیمایش با کلیدها تا Enter چیزی را عوض نمی‌کند.
  const [cursor, setCursor] = useState(value);
  const wantFocus = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const today = tehranDayKey();
  const days = jalaliMonthDays(month);
  const first = days[0]!;
  const { y, m } = jalaliOf(first);

  // اگر تاریخ از بیرون (مثلاً دکمهٔ «فردا») به ماه دیگری رفت، همان ماه نمایش داده شود.
  useEffect(() => {
    if (!jalaliMonthDays(month).includes(value)) setMonth(value);
    setCursor(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (!wantFocus.current) return;
    wantFocus.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${cursor}"]`)?.focus();
  }, [cursor]);

  const showMonth = (key: string) => {
    setMonth(key);
    setCursor(jalaliMonthDays(key).includes(value) ? value : key);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const step: Record<string, () => string> = {
      ArrowLeft: () => addDays(cursor, 1),
      ArrowRight: () => addDays(cursor, -1),
      ArrowDown: () => addDays(cursor, 7),
      ArrowUp: () => addDays(cursor, -7),
      PageDown: () => addJalaliMonths(cursor, 1),
      PageUp: () => addJalaliMonths(cursor, -1),
    };
    const next = step[e.key];
    if (!next) return;
    e.preventDefault();
    const key = next();
    wantFocus.current = true;
    setCursor(key);
    setMonth(key);
  };

  return (
    <div className="col" style={{ gap: 8, padding: 12, border: '1px solid var(--line)', borderRadius: 14 }}>
      <div className="rw" style={{ gap: 6 }}>
        <button type="button" className="ib ghost" aria-label="ماه قبل" onClick={() => showMonth(addJalaliMonths(month, -1))} style={{ width: 36, height: 36 }}><Icon name="chr" size="s" /></button>
        <span className="sp b" style={{ textAlign: 'center' }} aria-live="polite">{JALALI_MONTHS[m - 1]} {toFaDigits(y)}</span>
        <button type="button" className="ib ghost" aria-label="ماه بعد" onClick={() => showMonth(addJalaliMonths(month, 1))} style={{ width: 36, height: 36 }}><Icon name="chl" size="s" /></button>
      </div>
      <div ref={gridRef} role="group" aria-label={label} onKeyDown={onKeyDown} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 2 }}>
        {WEEKDAYS_SHORT.map((w) => <span key={w} className="xs faint" style={{ textAlign: 'center', padding: '2px 0' }} aria-hidden="true">{w}</span>)}
        {Array.from({ length: weekdayIndex(first) }, (_, i) => <span key={`e${i}`} />)}
        {days.map((k) => {
          const on = k === value;
          return (
            <button
              key={k}
              type="button"
              aria-pressed={on}
              aria-label={formatJalaliDay(k)}
              data-day={k}
              tabIndex={k === cursor || (!days.includes(cursor) && k === first) ? 0 : -1}
              onClick={() => { setCursor(k); onChange(k); }}
              className="num"
              style={{
                height: 36, borderRadius: 10, border: 0, fontSize: 14,
                background: on ? 'var(--pri)' : 'transparent', color: on ? 'var(--pri-ink)' : k < today ? 'var(--faint)' : 'var(--ink)',
                fontWeight: k === today || on ? 700 : 500, boxShadow: k === today && !on ? 'inset 0 0 0 1.5px var(--pri-text)' : 'none',
              }}
            >
              {toFaDigits(jalaliOf(k).d)}
            </button>
          );
        })}
      </div>
    </div>
  );
});
