import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { Icon } from '@kelid/ui';
import { JALALI_MONTHS, addDays, jalaliOf, layoutDay, tehranDayKey, tehranMinutes, toFaDigits, weekdayIndex, type Listing, type Visit } from '@kelid/core';
import { KIND, faTime } from './time';

const WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
const SNAP = 15;

export interface Placed {
  v: Visit;
  day: string;
  start: number;
  end: number;
}

/** هر قرار به روز و دقیقهٔ شروع و پایانش (وقت تهران). قرار چندروزه در روز شروعش تا نیمه‌شب کشیده می‌شود. */
export function place(v: Visit): Placed {
  const day = tehranDayKey(new Date(v.startsAt));
  const start = tehranMinutes(v.startsAt);
  const sameDay = tehranDayKey(new Date(v.endsAt)) === day;
  const end = sameDay ? Math.max(start + 15, tehranMinutes(v.endsAt)) : 24 * 60;
  return { v, day, start, end };
}

type Drag = { id: string; mode: 'move' | 'resize'; day: string; start: number; end: number };
type Gesture = {
  id: string;
  mode: 'move' | 'resize';
  x0: number;
  y0: number;
  m0: number;
  orig: Placed;
  cols: Array<{ day: string; left: number; right: number }>;
  moved: boolean;
};

/**
 * جدول ساعت‌ها برای یک یا چند روز. قرار را با موس می‌شود کشید (روز و ساعت) یا از لبهٔ پایین بلندتر کرد؛
 * با صفحه‌کلید: Alt و جهت‌ها. کلیک روی جای خالی قرار تازه در همان ساعت می‌سازد.
 */
export function TimeGrid({
  days, visits, listings, today, now, hourPx, showHead, onOpen, onCreate, onMove, onDay,
}: {
  days: string[];
  visits: Placed[];
  listings: Map<string, Listing>;
  today: string;
  now: number;
  hourPx: number;
  showHead: boolean;
  onOpen: (v: Visit) => void;
  onCreate: (day: string, minutes: number) => void;
  onMove: (v: Visit, day: string, start: number, end: number) => void;
  onDay: (day: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const swallowClick = useRef(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hover, setHover] = useState<{ day: string; min: number } | null>(null);

  // ساعت‌های پیش‌فرض ۷ صبح تا ۱۰ شب؛ اگر قراری بیرون از این بازه باشد، جدول بازتر می‌شود.
  const first = Math.min(7, ...visits.map((p) => Math.floor(p.start / 60)));
  const last = Math.max(22, ...visits.map((p) => Math.ceil(p.end / 60)));
  const hours = last - first;
  const nowMin = tehranMinutes(new Date(now).toISOString());
  const top = (min: number) => ((min - first * 60) / 60) * hourPx;

  // هر بار که هفته یا روز عوض می‌شود، جدول به ساعت مهم می‌رود: اکنون، یا اولین قرار، یا ۹ صبح.
  const daysKey = days.join();
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const inView = days.includes(today);
    const firstVisit = Math.min(...visits.filter((p) => days.includes(p.day)).map((p) => p.start));
    const focus = inView ? nowMin - 60 : Number.isFinite(firstVisit) ? firstVisit - 30 : 9 * 60;
    el.scrollTop = Math.max(0, top(focus));
    // فقط با عوض شدن روزها؛ نه با هر دقیقه یا هر تغییر داده.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysKey]);

  // Esc وسط کشیدن، قرار را سر جایش برمی‌گرداند.
  useEffect(() => {
    if (!drag) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      gesture.current = null;
      swallowClick.current = true;
      setDrag(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drag]);

  const minuteAt = (clientY: number, day: string): number => {
    const col = scrollRef.current?.querySelector<HTMLElement>(`[data-col="${day}"]`);
    if (!col) return 0;
    const r = col.getBoundingClientRect();
    return first * 60 + ((clientY - r.top) / r.height) * hours * 60;
  };

  const startGesture = (e: PointerEvent<HTMLElement>, p: Placed, mode: 'move' | 'resize') => {
    // روی لمس، کشیدن با اسکرول قاطی می‌شود؛ لمس فقط قرار را باز می‌کند.
    if (e.button !== 0 || e.pointerType === 'touch') return;
    e.stopPropagation();
    const cols = [...(scrollRef.current?.querySelectorAll<HTMLElement>('[data-col]') ?? [])].map((c) => {
      const r = c.getBoundingClientRect();
      return { day: c.dataset.col!, left: r.left, right: r.right };
    });
    gesture.current = { id: p.v.id, mode, x0: e.clientX, y0: e.clientY, m0: minuteAt(e.clientY, p.day), orig: p, cols, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const moveGesture = (e: PointerEvent<HTMLElement>) => {
    const g = gesture.current;
    if (!g) return;
    if (!g.moved && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < 5) return;
    g.moved = true;
    const delta = Math.round((minuteAt(e.clientY, g.orig.day) - g.m0) / SNAP) * SNAP;
    const len = g.orig.end - g.orig.start;
    // نزدیک لبهٔ بالا و پایین، جدول خودش اسکرول می‌خورد.
    const box = scrollRef.current?.getBoundingClientRect();
    if (box && scrollRef.current) {
      if (e.clientY < box.top + 70) scrollRef.current.scrollTop -= 12;
      else if (e.clientY > box.bottom - 40) scrollRef.current.scrollTop += 12;
    }
    if (g.mode === 'resize') {
      const end = Math.min(24 * 60, Math.max(g.orig.start + SNAP, g.orig.end + delta));
      setDrag({ id: g.id, mode: 'resize', day: g.orig.day, start: g.orig.start, end });
      return;
    }
    const col = g.cols.find((c) => e.clientX >= c.left && e.clientX <= c.right);
    const start = Math.min(24 * 60 - len, Math.max(0, g.orig.start + delta));
    setDrag({ id: g.id, mode: 'move', day: col?.day ?? drag?.day ?? g.orig.day, start, end: start + len });
  };

  const endGesture = () => {
    const g = gesture.current;
    gesture.current = null;
    if (!g?.moved) return;
    swallowClick.current = true;
    if (drag && (drag.day !== g.orig.day || drag.start !== g.orig.start || drag.end !== g.orig.end)) onMove(g.orig.v, drag.day, drag.start, drag.end);
    setDrag(null);
  };

  const onEventKey = (e: KeyboardEvent, p: Placed) => {
    if (!e.altKey) return;
    // راست‌به‌چپ: جهت چپ یعنی روز بعد
    const step: Record<string, [number, number]> = { ArrowUp: [0, -SNAP], ArrowDown: [0, SNAP], ArrowLeft: [1, 0], ArrowRight: [-1, 0] };
    const s = step[e.key];
    if (!s) return;
    e.preventDefault();
    const len = p.end - p.start;
    const start = Math.min(24 * 60 - len, Math.max(0, p.start + s[1]));
    onMove(p.v, addDays(p.day, s[0]), start, start + len);
  };

  const onColMove = (e: PointerEvent<HTMLDivElement>, day: string) => {
    if (gesture.current || e.pointerType !== 'mouse') return;
    if ((e.target as HTMLElement).closest('.cal-ev')) {
      if (hover) setHover(null);
      return;
    }
    const min = Math.floor(minuteAt(e.clientY, day) / 30) * 30;
    if (hover?.day !== day || hover.min !== min) setHover({ day, min });
  };

  const onColClick = (e: MouseEvent<HTMLDivElement>, day: string) => {
    if ((e.target as HTMLElement).closest('.cal-ev')) return;
    onCreate(day, Math.floor(minuteAt(e.clientY, day) / 30) * 30);
  };

  const style = { '--n': days.length, '--hour': `${hourPx}px` } as CSSProperties;

  return (
    <div className="cal-scroll" ref={scrollRef}>
      <div className="cal-grid" style={style}>
        {showHead && (
          <div className="cal-head" aria-hidden="true">
            <span />
            {days.map((d) => {
              const j = jalaliOf(d);
              const count = visits.filter((p) => p.day === d).length;
              return (
                <button key={d} type="button" tabIndex={-1} className={`cal-dh${d === today ? ' today' : ''}${weekdayIndex(d) === 6 ? ' fri' : ''}`} onClick={() => onDay(d)}>
                  <span className="cal-dh-w">{WEEKDAYS[weekdayIndex(d)]}</span>
                  <span className="cal-dh-n num">{toFaDigits(j.d)}</span>
                  {j.d === 1 ? <span className="cal-dh-m">{JALALI_MONTHS[j.m - 1]}</span> : count > 0 && <span className="cal-dh-m num">{toFaDigits(count)} قرار</span>}
                </button>
              );
            })}
          </div>
        )}
        <div className="cal-body" style={{ height: hours * hourPx }}>
          <div className="cal-gutter" aria-hidden="true">
            {Array.from({ length: hours - 1 }, (_, i) => (first + i + 1) * 60)
              // ساعتی که زیر برچسب «اکنون» می‌افتد نوشته نمی‌شود تا روی هم نیفتند.
              .filter((m) => !days.includes(today) || Math.abs(m - nowMin) > 14)
              .map((m) => <span key={m} className="num" style={{ top: top(m) }}>{toFaDigits(`${m / 60}:۰۰`)}</span>)}
            {days.includes(today) && nowMin >= first * 60 && nowMin <= last * 60 && (
              <span className="cal-now-t num" style={{ top: top(nowMin) }}>{faTime(nowMin)}</span>
            )}
          </div>
          {days.map((d) => {
            const mine = visits.filter((p) => (drag && p.v.id === drag.id ? drag.day : p.day) === d);
            const lay = layoutDay(mine.map((p) => (drag?.id === p.v.id ? { id: p.v.id, start: drag.start, end: drag.end } : { id: p.v.id, start: p.start, end: p.end })));
            return (
              <div
                key={d}
                data-col={d}
                className={`cal-col${d === today ? ' today' : ''}${weekdayIndex(d) === 6 ? ' fri' : ''}${drag?.day === d ? ' drop' : ''}`}
                onPointerMove={(e) => onColMove(e, d)}
                onPointerLeave={() => setHover(null)}
                onClick={(e) => onColClick(e, d)}
              >
                {hover?.day === d && !drag && (
                  <span className="cal-ghost" style={{ top: top(hover.min), height: hourPx / 2 }} aria-hidden="true">
                    <Icon name="plus" size="s" />
                    {faTime(hover.min)}
                  </span>
                )}
                {(() => {
                  // جای قبلی قرارِ در حال کشیدن، با خط‌چین؛ تا معلوم باشد از کجا آمده
                  const o = drag && visits.find((p) => p.v.id === drag.id);
                  return o && o.day === d ? <span className="cal-origin" style={{ top: top(o.start), height: ((o.end - o.start) / 60) * hourPx - 2 }} aria-hidden="true" /> : null;
                })()}
                {mine.map((p) => {
                  const live = drag?.id === p.v.id ? drag : undefined;
                  const start = live?.start ?? p.start;
                  const end = live?.end ?? p.end;
                  const l = lay.get(p.v.id) ?? { col: 0, cols: 1 };
                  const listing = p.v.listingId ? listings.get(p.v.listingId) : undefined;
                  const h = ((end - start) / 60) * hourPx;
                  return (
                    <button
                      key={p.v.id}
                      type="button"
                      className={`cal-ev d-${listing?.deal ?? 'none'}${p.v.done ? ' done' : ''}${live ? ' dragging' : ''}${h < 44 ? ' short' : ''}`}
                      style={{ top: top(start), height: Math.max(h, 22) - 2, insetInlineStart: `calc(${(l.col / l.cols) * 100}% + 3px)`, width: `calc(${100 / l.cols}% - 6px)` }}
                      aria-label={`${KIND[p.v.kind].label}: ${p.v.title}، ساعت ${faTime(start)} تا ${faTime(end)}. برای جابه‌جایی Alt و جهت‌ها.`}
                      onPointerDown={(e) => startGesture(e, p, 'move')}
                      onPointerMove={moveGesture}
                      onPointerUp={endGesture}
                      onPointerCancel={endGesture}
                      onKeyDown={(e) => onEventKey(e, p)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (swallowClick.current) {
                          swallowClick.current = false;
                          return;
                        }
                        onOpen(p.v);
                      }}
                    >
                      <span className="cal-ev-hd">
                        <Icon name={KIND[p.v.kind].icon} size="s" />
                        <span className="num">{faTime(start)}</span>
                        {live && <span className="num"> تا {faTime(end)}</span>}
                      </span>
                      <span className="cal-ev-t">{p.v.title}</span>
                      {listing && h >= 64 && (
                        <span className="cal-ev-l">
                          {listing.neighborhood}
                        </span>
                      )}
                      <span
                        className="cal-ev-rs"
                        aria-hidden="true"
                        onPointerDown={(e) => startGesture(e, p, 'resize')}
                      />
                    </button>
                  );
                })}
                {d === today && nowMin >= first * 60 && nowMin <= last * 60 && <span className="cal-now" style={{ top: top(nowMin) }} aria-hidden="true" />}
              </div>
            );
          })}
          {days.length > 1 && days.includes(today) && nowMin >= first * 60 && nowMin <= last * 60 && (
            <span className="cal-now-all" style={{ top: top(nowMin) }} aria-hidden="true" />
          )}
        </div>
      </div>
    </div>
  );
}
