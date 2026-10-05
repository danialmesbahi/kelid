import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useSearchParams } from 'react-router';
import { Icon, Segmented } from '@kelid/ui';
import {
  JALALI_MONTHS, addDays, addJalaliMonths, formatJalaliDay, jalaliMonthDays, jalaliOf, minutesToHhmm, tehranAt, tehranDayKey,
  toFaDigits, weekStart, weekdayIndex, type Listing, type Visit, type VisitKind,
} from '@kelid/core';
import { useQuery, useSlow, useStore } from '../data';
import { calendarQuery } from '../queries';
import { PageSkeleton } from '../layout/PageSkeleton';
import { useToast } from '../layout/Toasts';
import { usePhone } from '../layout/usePhone';
import { VisitDialog, type VisitPreset } from '../visits/VisitDialog';
import { MonthGrid } from './MonthGrid';
import { TimeGrid, place, type Placed } from './TimeGrid';
import { KIND, dayName, faTime, useNow, validDay } from './time';
import './calendar.css';

type View = 'day' | 'week' | 'month';
const WEEK_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

/** بازهٔ داده و خانه‌های جدول برای هر نما. نمای روز هم کل هفته را می‌خواند تا نوار هفته نقطه‌هایش را داشته باشد. */
function rangeOf(view: View, anchor: string): { from: string; days: number } {
  if (view !== 'month') return { from: weekStart(anchor), days: 7 };
  const month = jalaliMonthDays(anchor);
  const from = weekStart(month[0]!);
  const to = addDays(weekStart(month.at(-1)!), 7);
  return { from, days: Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) };
}

function title(view: View, anchor: string, today: string): { eyebrow: string; head: string } {
  const j = jalaliOf(anchor);
  if (view === 'month') return { eyebrow: 'تقویم', head: `${JALALI_MONTHS[j.m - 1]} ${toFaDigits(j.y)}` };
  if (view === 'day') return { eyebrow: dayName(anchor, today) === formatJalaliDay(anchor) ? `${JALALI_MONTHS[j.m - 1]} ${toFaDigits(j.y)}` : dayName(anchor, today), head: formatJalaliDay(anchor) };
  const a = jalaliOf(weekStart(anchor));
  const b = jalaliOf(addDays(weekStart(anchor), 6));
  const head = a.m === b.m
    ? `${toFaDigits(a.d)} تا ${toFaDigits(b.d)} ${JALALI_MONTHS[a.m - 1]}`
    : `${toFaDigits(a.d)} ${JALALI_MONTHS[a.m - 1]} تا ${toFaDigits(b.d)} ${JALALI_MONTHS[b.m - 1]}`;
  return { eyebrow: `تقویم · ${toFaDigits(b.y)}`, head };
}

/** «۵ بازدید، ۲ تماس و ۱ قرارداد» */
function summary(list: Placed[]): string {
  const order: VisitKind[] = ['visit', 'call', 'signing', 'task'];
  const parts = order.map((k) => [k, list.filter((p) => p.v.kind === k).length] as const).filter(([, c]) => c > 0).map(([k, c]) => `${toFaDigits(c)} ${KIND[k].label}`);
  if (parts.length === 0) return '';
  return parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join('، ')} و ${parts.at(-1)}`;
}

export function CalendarPage() {
  const phone = usePhone();
  const store = useStore();
  const toast = useToast();
  const now = useNow();
  const today = tehranDayKey(new Date(now));
  const [params, setParams] = useSearchParams();
  const raw = params.get('v');
  // روی گوشی جدول هفت‌ستونه جا نمی‌شود؛ «هفته» همان روز با نوار هفته است.
  const view: View = raw === 'month' ? 'month' : phone || raw === 'day' ? 'day' : 'week';
  const anchor = validDay(params.get('d')) ?? today;
  const [dir, setDir] = useState(0);
  const [dialog, setDialog] = useState<{ visit?: Visit; preset?: VisitPreset } | null>(null);

  const range = rangeOf(view, anchor);
  const q = calendarQuery(range.from, range.days);
  const data = useQuery(q.key, q.fn);
  // هنگام رفتن به هفتهٔ دیگر، تا دادهٔ تازه برسد همان قبلی می‌ماند؛ صفحه خالی نمی‌شود.
  const [shown, setShown] = useState(data);
  if (data && data !== shown) setShown(data);
  const view0 = data ?? shown;
  const slow = useSlow(!view0);

  const go = (key: string, v: View = view, d = 0) => {
    setDir(d);
    setParams((p) => {
      const n = new URLSearchParams(p);
      n.set('d', key);
      n.set('v', v);
      return n;
    }, { replace: true });
  };
  const step = (n: number) => {
    const next = view === 'month' ? addJalaliMonths(anchor, n) : addDays(anchor, view === 'week' ? 7 * n : n);
    go(next, view, n);
  };

  // ←/→ دوره‌ی بعد و قبل (راست‌به‌چپ: چپ یعنی بعد)، T یا «ت» برگشت به امروز.
  const stepRef = useRef(step);
  const goRef = useRef(go);
  useEffect(() => {
    stepRef.current = step;
    goRef.current = go;
  });
  useEffect(() => {
    if (dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      const t = e.target as HTMLElement;
      if (t.closest('input, select, textarea, [role="dialog"]')) return;
      if (e.key === 'ArrowLeft') stepRef.current(1);
      else if (e.key === 'ArrowRight') stepRef.current(-1);
      else if (e.key === 't' || e.key === 'T' || e.key === 'ف') goRef.current(tehranDayKey());
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog]);

  if (!view0) return slow ? <PageSkeleton /> : null;

  const listings = new Map<string, Listing>(view0.listings.map((l) => [l.id, l]));
  const placed = view0.visits.map(place);
  const { eyebrow, head } = title(view, anchor, today);
  const visible = view === 'day' ? placed.filter((p) => p.day === anchor) : view === 'week' ? placed : placed.filter((p) => jalaliOf(p.day).m === jalaliOf(anchor).m);
  const sum = summary(visible);
  const periodWord = view === 'day' ? (anchor === today ? 'امروز' : 'این روز') : view === 'week' ? 'این هفته' : 'این ماه';

  const onMove = async (v: Visit, day: string, start: number, end: number) => {
    const startsAt = tehranAt(day, start);
    const endsAt = end >= 24 * 60 ? new Date(Date.parse(tehranAt(day, 0)) + 86_400_000).toISOString() : tehranAt(day, end);
    const before = { startsAt: v.startsAt, endsAt: v.endsAt };
    try {
      await store.updateVisit(v.id, { startsAt, endsAt });
    } catch {
      toast('جابه‌جا نشد؛ دوباره تلاش کنید.');
      return;
    }
    toast(`${v.title} · ${dayName(day, today)} ساعت ${faTime(start)} تا ${faTime(end)}`, { label: 'برگرداندن', run: () => void store.updateVisit(v.id, before) });
  };
  const open = (visit: Visit) => setDialog({ visit });
  const create = (day: string, minutes?: number) => setDialog({ preset: { day, time: minutes === undefined ? undefined : minutesToHhmm(minutes) } });

  const views: Array<{ value: View; label: string }> = phone
    ? [{ value: 'day', label: 'روز' }, { value: 'month', label: 'ماه' }]
    : [{ value: 'day', label: 'روز' }, { value: 'week', label: 'هفته' }, { value: 'month', label: 'ماه' }];
  const isNow = view === 'month' ? jalaliOf(anchor).m === jalaliOf(today).m && jalaliOf(anchor).y === jalaliOf(today).y : view === 'week' ? weekStart(anchor) === weekStart(today) : anchor === today;
  const stepLabel = view === 'month' ? 'ماه' : view === 'week' ? 'هفته' : 'روز';
  const anim = dir > 0 ? 'cal-in-next' : dir < 0 ? 'cal-in-prev' : '';
  const monthCells = view === 'month' ? Array.from({ length: range.days }, (_, i) => addDays(range.from, i)) : [];

  return (
    <div className="calpage">
      <div className="hd cal-hd">
        <div className="col" style={{ gap: 4, minWidth: 0 }}>
          <span className="eb">{eyebrow}</span>
          <h1 className="t1" aria-live="polite">{head}</h1>
          <span className="mute sm">{sum ? <>{periodWord} <b style={{ color: 'var(--ink)' }}>{sum}</b> دارید.</> : `${periodWord} قراری ثبت نشده.`}</span>
        </div>
        <span className="sp" />
        <div className="cal-ctl">
          <Segmented<View> label="نمای تقویم" value={view} onChange={(v) => go(anchor, v)} options={views} />
          <div className="cal-step" role="group" aria-label="جابه‌جایی در تقویم">
            <button type="button" className="ib ghost" aria-label={`${stepLabel} قبل`} onClick={() => step(-1)}><Icon name="chr" /></button>
            <button type="button" className="cal-today" aria-pressed={isNow} onClick={() => go(today, view, Date.parse(today) > Date.parse(anchor) ? 1 : -1)}>امروز</button>
            <button type="button" className="ib ghost" aria-label={`${stepLabel} بعد`} onClick={() => step(1)}><Icon name="chl" /></button>
          </div>
          <button type="button" className="btn btn-p cal-new" onClick={() => create(view === 'month' || anchor !== today ? anchor : today)}>
            <Icon name="plus" size="s" thick />
            قرار تازه
          </button>
        </div>
      </div>

      {view === 'day' && <WeekStrip anchor={anchor} today={today} visits={placed} listings={listings} onPick={(d) => go(d, 'day', Math.sign(Date.parse(d) - Date.parse(anchor)))} onWeek={(n) => go(addDays(anchor, 7 * n), 'day', n)} />}

      <div key={`${view}:${view === 'month' ? range.from : view === 'week' ? weekStart(anchor) : anchor}`} className={`cal-stage ${anim}`}>
        {view === 'month' ? (
          <MonthGrid cells={monthCells} month={jalaliOf(anchor).m} visits={placed} listings={listings} today={today} compact={phone} onOpen={open} onCreate={(d) => create(d)} onMove={onMove} onDay={(d) => go(d, 'day')} />
        ) : (
          <TimeGrid
            days={view === 'week' ? Array.from({ length: 7 }, (_, i) => addDays(weekStart(anchor), i)) : [anchor]}
            visits={placed}
            listings={listings}
            today={today}
            now={now}
            hourPx={phone ? 64 : 58}
            showHead={view === 'week'}
            onOpen={open}
            onCreate={create}
            onMove={onMove}
            onDay={(d) => go(d, 'day')}
          />
        )}
        {view !== 'month' && visible.length === 0 && (
          <div className="cal-empty" aria-hidden="true">
            <Icon name="cal" />
            <span className="sb">{view === 'week' ? 'هفتهٔ آرامی است' : 'روز آزادی است'}</span>
            <span className="xs mute">{phone ? 'روی هر ساعت بزنید تا قرار تازه ثبت شود.' : 'روی هر ساعت کلیک کنید تا قرار تازه ثبت شود.'}</span>
          </div>
        )}
      </div>

      {!phone && view !== 'month' && (
        <p className="cal-tip xs faint">
          قرارها را با موس به روز و ساعت دیگر بکشید، یا از لبهٔ پایینشان بلندتر کنید. <span className="kbd">←</span> <span className="kbd">→</span> هفتهٔ بعد و قبل، <span className="kbd">T</span> امروز.
        </p>
      )}

      {dialog && <VisitDialog visit={dialog.visit} preset={dialog.preset} onClose={() => setDialog(null)} />}
    </div>
  );
}

/** نوار هفت‌روزهٔ بالای نمای روز؛ با کشیدن انگشت به چپ و راست هفته عوض می‌شود. */
function WeekStrip({ anchor, today, visits, listings, onPick, onWeek }: { anchor: string; today: string; visits: Placed[]; listings: Map<string, Listing>; onPick: (d: string) => void; onWeek: (n: number) => void }) {
  const start = weekStart(anchor);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const down = (e: PointerEvent) => {
    swipe.current = { x: e.clientX, y: e.clientY };
  };
  const up = (e: PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    // راست‌به‌چپ: هفتهٔ بعد سمت چپ است و با کشیدن به راست می‌آید
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - s.y) * 1.5) onWeek(dx > 0 ? 1 : -1);
  };
  return (
    <div className="cal-strip" onPointerDown={down} onPointerUp={up} onPointerCancel={() => (swipe.current = null)}>
      {Array.from({ length: 7 }, (_, i) => {
        const d = addDays(start, i);
        const mine = visits.filter((p) => p.day === d);
        return (
          <button key={d} type="button" className={`cal-sd${d === today ? ' today' : ''}${weekdayIndex(d) === 6 ? ' fri' : ''}`} aria-pressed={d === anchor} aria-label={`${formatJalaliDay(d)}${mine.length ? `، ${toFaDigits(mine.length)} قرار` : ''}`} onClick={() => onPick(d)}>
            <span className="cal-sd-w">{WEEK_SHORT[i]}</span>
            <span className="cal-sd-n num">{toFaDigits(jalaliOf(d).d)}</span>
            <span className="cal-dots">
              {mine.slice(0, 3).map((p) => <i key={p.v.id} className={`d-${(p.v.listingId && listings.get(p.v.listingId)?.deal) || 'none'}`} />)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
