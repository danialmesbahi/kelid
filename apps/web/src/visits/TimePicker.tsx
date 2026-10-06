import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@kelid/ui';
import { toFaDigits } from '@kelid/core';
import { usePopoverPlace } from '../layout/Select';
import '../layout/picker.css';

const ROWS: Array<{ label: string; hours: number[] }> = [
  { label: 'صبح', hours: [7, 8, 9, 10, 11, 12] },
  { label: 'بعدازظهر', hours: [13, 14, 15, 16, 17, 18] },
  { label: 'شب', hours: [19, 20, 21, 22, 23, 6] },
];
const MINUTES = ['00', '15', '30', '45'];
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * انتخاب ساعت با دکمه‌های درشت به جای فیلد ساعت مرورگر (که بسته به ویندوز «PM» و ارقام لاتین نشان می‌دهد).
 * اول ساعت، بعد دقیقه؛ با زدن دقیقه بسته می‌شود. ساعت‌های کم‌کاربرد شب (۰ تا ۵) با «ساعت‌های دیگر» می‌آیند.
 */
export function TimePicker({ value, onChange, label = 'ساعت' }: { value: string; onChange: (hhmm: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const [late, setLate] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const place = usePopoverPlace(open, btn, 340, 420);
  const h = Number(value.slice(0, 2));
  const m = value.slice(3, 5);
  const minutes = MINUTES.includes(m) ? MINUTES : [...MINUTES, m].sort();
  const rows = late || h < 6 ? [...ROWS, { label: 'نیمه‌شب', hours: [0, 1, 2, 3, 4, 5] }] : ROWS;

  const close = (focus = true) => {
    setOpen(false);
    if (focus) btn.current?.focus();
  };

  const ready = !!place;
  useEffect(() => {
    if (!ready) return;
    pop.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!pop.current?.contains(t) && !btn.current?.contains(t)) close(false);
    };
    addEventListener('pointerdown', away, true);
    return () => removeEventListener('pointerdown', away, true);
  }, [ready]);

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    e.preventDefault();
    close();
  };

  return (
    <>
      <button ref={btn} type="button" className="fld kp-trigger kp-time" aria-haspopup="dialog" aria-expanded={open} aria-label={`${label}: ${toFaDigits(value)}`} onClick={() => (open ? close() : setOpen(true))} onKeyDown={open ? onKey : undefined}>
        <span className="kp-val num">{toFaDigits(value)}</span>
        <span className={`kp-chev${open ? ' up' : ''}`} aria-hidden="true"><Icon name="down" size="s" /></span>
      </button>
      {place && createPortal(
        <div ref={pop} role="dialog" aria-label={`انتخاب ${label}`} className={`kp-pop kp-tp${place.up ? ' up' : ''}`} style={{ top: place.top, left: place.left, width: place.width, maxHeight: place.max }} onKeyDown={onKey}>
          <div className="kp-tp-sec">ساعت</div>
          {rows.map((r) => (
            <div key={r.label} className="kp-tp-row">
              <span className="kp-tp-l">{r.label}</span>
              <div className="kp-tp-grid">
                {r.hours.map((x) => (
                  <button key={x} type="button" className="kp-chip num" aria-pressed={x === h} onClick={() => onChange(`${pad(x)}:${m}`)}>{toFaDigits(x)}</button>
                ))}
              </div>
            </div>
          ))}
          {!late && h >= 6 && <button type="button" className="lnk xs kp-more" onClick={() => setLate(true)}>ساعت‌های دیگر</button>}
          <div className="kp-tp-sec">دقیقه</div>
          <div className="kp-tp-min">
            {minutes.map((x) => (
              <button key={x} type="button" className="kp-chip num" aria-pressed={x === m} onClick={() => { onChange(`${pad(h)}:${x}`); close(); }}>
                {toFaDigits(`${pad(h)}:${x}`)}
              </button>
            ))}
          </div>
        </div>,
        document.getElementById('root') ?? document.body,
      )}
    </>
  );
}
