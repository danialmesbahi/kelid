import { useRef, useState, type PointerEvent } from 'react';
import { JALALI_MONTHS, jalaliOf, toFaDigits, weekdayIndex, type Listing, type Visit } from '@kelid/core';
import { faTime } from './time';
import type { Placed } from './TimeGrid';

const WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

type Gesture = { v: Placed; x0: number; y0: number; cells: Array<{ day: string; r: DOMRect }>; moved: boolean };

/**
 * نمای ماه: هر روز چند قرار اول را نشان می‌دهد. قرار را می‌شود به روز دیگری کشید (ساعتش همان می‌ماند).
 * روی گوشی به‌جای عنوان‌ها نقطه‌های رنگی هست و لمس هر روز، برنامهٔ همان روز را باز می‌کند.
 */
export function MonthGrid({
  cells, month, visits, listings, today, compact, onOpen, onCreate, onMove, onDay,
}: {
  cells: string[];
  month: number;
  visits: Placed[];
  listings: Map<string, Listing>;
  today: string;
  compact: boolean;
  onOpen: (v: Visit) => void;
  onCreate: (day: string) => void;
  onMove: (v: Visit, day: string, start: number, end: number) => void;
  onDay: (day: string) => void;
}) {
  const gesture = useRef<Gesture | null>(null);
  const swallow = useRef(false);
  const [drag, setDrag] = useState<{ id: string; day: string; dx: number; dy: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const max = compact ? 4 : 3;

  const down = (e: PointerEvent<HTMLButtonElement>, p: Placed) => {
    if (e.button !== 0 || e.pointerType === 'touch') return;
    const cellsR = [...(gridRef.current?.querySelectorAll<HTMLElement>('[data-cell]') ?? [])].map((c) => ({ day: c.dataset.cell!, r: c.getBoundingClientRect() }));
    gesture.current = { v: p, x0: e.clientX, y0: e.clientY, cells: cellsR, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current;
    if (!g) return;
    if (!g.moved && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < 5) return;
    g.moved = true;
    const hit = g.cells.find((c) => e.clientX >= c.r.left && e.clientX <= c.r.right && e.clientY >= c.r.top && e.clientY <= c.r.bottom);
    setDrag({ id: g.v.v.id, day: hit?.day ?? g.v.day, dx: e.clientX - g.x0, dy: e.clientY - g.y0 });
  };
  const up = () => {
    const g = gesture.current;
    gesture.current = null;
    if (!g?.moved) return;
    swallow.current = true;
    if (drag && drag.day !== g.v.day) onMove(g.v.v, drag.day, g.v.start, g.v.end);
    setDrag(null);
  };

  return (
    <div className={`cal-month${compact ? ' compact' : ''}`} ref={gridRef}>
      {WEEKDAYS.map((w, i) => <span key={w} className={`cal-mw${i === 6 ? ' fri' : ''}`} aria-hidden="true">{compact ? w.slice(0, 1) : w}</span>)}
      {cells.map((d) => {
        const j = jalaliOf(d);
        const mine = visits.filter((p) => p.day === d).sort((a, b) => a.start - b.start);
        const out = j.m !== month;
        return (
          <div
            key={d}
            data-cell={d}
            className={`cal-cell${out ? ' out' : ''}${d === today ? ' today' : ''}${weekdayIndex(d) === 6 ? ' fri' : ''}${drag?.day === d ? ' drop' : ''}`}
            onClick={() => (compact ? onDay(d) : onCreate(d))}
          >
            <button
              type="button"
              className="cal-dn num"
              aria-label={`برنامهٔ ${toFaDigits(j.d)} ${JALALI_MONTHS[j.m - 1]}${mine.length ? `، ${toFaDigits(mine.length)} قرار` : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onDay(d);
              }}
            >
              {toFaDigits(j.d)}
              {j.d === 1 && !compact && <small>{JALALI_MONTHS[j.m - 1]}</small>}
            </button>
            {compact ? (
              <span className="cal-dots" aria-hidden="true">
                {mine.slice(0, max).map((p) => <i key={p.v.id} className={`d-${(p.v.listingId && listings.get(p.v.listingId)?.deal) || 'none'}`} />)}
              </span>
            ) : (
              <>
                {mine.slice(0, max).map((p) => {
                  const listing = p.v.listingId ? listings.get(p.v.listingId) : undefined;
                  const live = drag?.id === p.v.id ? drag : undefined;
                  return (
                    <button
                      key={p.v.id}
                      type="button"
                      className={`cal-chip d-${listing?.deal ?? 'none'}${p.v.done ? ' done' : ''}${live ? ' dragging' : ''}`}
                      style={live ? { transform: `translate(${live.dx}px, ${live.dy}px)` } : undefined}
                      onPointerDown={(e) => down(e, p)}
                      onPointerMove={move}
                      onPointerUp={up}
                      onPointerCancel={up}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (swallow.current) {
                          swallow.current = false;
                          return;
                        }
                        onOpen(p.v);
                      }}
                    >
                      <span className="num">{faTime(p.start)}</span>
                      <span className="cal-chip-t">{p.v.title}</span>
                    </button>
                  );
                })}
                {mine.length > max && (
                  <button type="button" className="cal-more" onClick={(e) => { e.stopPropagation(); onDay(d); }}>
                    {toFaDigits(mine.length - max)} قرار دیگر
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
