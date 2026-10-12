import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Icon, Plaque } from '@kelid/ui';
import {
  JALALI_MONTHS, addDays, addJalaliMonths, formatJalaliDay, formatTime, jalaliMonthDays, jalaliOf, tehranDayKey,
  toFaDigits, weekStart, weekdayIndex, type Client, type Listing, type Visit, type VisitKind,
  listingPlace,
} from '@kelid/core';
import { useQuery, useSlow } from '../data';
import { calendarQuery } from '../queries';
import { PageSkeleton } from '../layout/PageSkeleton';
import { CallLink } from '../layout/CallLink';
import { VisitDialog, type VisitPreset } from '../visits/VisitDialog';
import { KIND, dayName, useNow, validDay } from './time';
import './calendar.css';

const WEEK_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

/** خانه‌های جدول ماه: از شنبهٔ هفتهٔ اول تا جمعهٔ هفتهٔ آخر. */
function monthCells(key: string): string[] {
  const days = jalaliMonthDays(key);
  const from = weekStart(days[0]!);
  const to = addDays(weekStart(days.at(-1)!), 7);
  const n = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
  return Array.from({ length: n }, (_, i) => addDays(from, i));
}

type CalData = { visits: Visit[]; listings: Listing[]; clients: Client[] };
const indexes = new WeakMap<CalData, { listings: Map<string, Listing>; clients: Map<string, Client>; byDay: Map<string, Visit[]> }>();

/** نقشه‌های جست‌وجو برای هر جواب دیتابیس یک بار ساخته می‌شوند، نه در هر کلیک روی روز. */
function index(data: CalData) {
  let ix = indexes.get(data);
  if (ix) return ix;
  const byDay = new Map<string, Visit[]>();
  for (const v of [...data.visits].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    const k = tehranDayKey(new Date(v.startsAt));
    const list = byDay.get(k);
    if (list) list.push(v);
    else byDay.set(k, [v]);
  }
  ix = { listings: new Map(data.listings.map((l) => [l.id, l])), clients: new Map(data.clients.map((c) => [c.id, c])), byDay };
  indexes.set(data, ix);
  return ix;
}

/** «۳ بازدید و ۱ تماس» */
function summary(list: Visit[]): string {
  const order: VisitKind[] = ['visit', 'call', 'signing', 'task'];
  const parts = order.map((k) => [k, list.filter((v) => v.kind === k).length] as const).filter(([, c]) => c > 0).map(([k, c]) => `${toFaDigits(c)} ${KIND[k].label}`);
  if (parts.length === 0) return '';
  return parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join('، ')} و ${parts.at(-1)}`;
}

/**
 * تقویم ساده: یک ماه در یک نگاه و برنامهٔ روزِ انتخاب‌شده کنارش، به ترتیب ساعت.
 * جدول ساعت و کشیدن و رها کردن عمداً نیست؛ برای جابه‌جایی، روی قرار بزنید و روز یا ساعتش را عوض کنید.
 */
export function CalendarPage() {
  const now = useNow();
  const today = tehranDayKey(new Date(now));
  const [params] = useSearchParams();
  // روز انتخاب‌شده فقط state همین صفحه است؛ عوض کردن نشانی کل مسیرها و منو را دوباره رندر می‌کرد.
  const [picked, setPicked] = useState(() => validDay(params.get('d')));
  const day = picked ?? today;
  const [dialog, setDialog] = useState<{ visit?: Visit; preset?: VisitPreset } | null>(null);

  const cells = monthCells(day);
  const q = calendarQuery(cells[0]!, cells.length);
  const data = useQuery(q.key, q.fn);
  // هنگام رفتن به ماه دیگر، تا دادهٔ تازه برسد همان قبلی می‌ماند؛ صفحه خالی نمی‌شود.
  const [shown, setShown] = useState(data);
  if (data && data !== shown) setShown(data);
  const view = data ?? shown;
  const slow = useSlow(!view);

  const pick = useCallback((key: string) => setPicked(key === tehranDayKey() ? undefined : key), []);

  // ←/→ روز بعد و قبل (راست‌به‌چپ: چپ یعنی بعد)
  const dayRef = useRef(day);
  useEffect(() => {
    dayRef.current = day;
  });
  useEffect(() => {
    if (dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      if ((e.target as HTMLElement).closest('input, select, textarea, [role="dialog"]')) return;
      if (e.key === 'ArrowLeft') setPicked(addDays(dayRef.current, 1));
      else if (e.key === 'ArrowRight') setPicked(addDays(dayRef.current, -1));
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog]);

  if (!view) return slow ? <PageSkeleton /> : null;

  const { listings, clients, byDay } = index(view);
  const list = byDay.get(day) ?? [];
  const sum = summary(list);
  const next = list.length === 0 ? cells.find((c) => c > day && (byDay.get(c)?.length ?? 0) > 0) : undefined;
  const j = jalaliOf(day);
  const nowIso = new Date(now).toISOString();
  // خط «اکنون» پیش از اولین قراری که هنوز نرسیده
  const nowAt = day === today ? list.findIndex((v) => v.startsAt > nowIso) : -1;
  const label = dayName(day, today);

  return (
    <div className="calpage">
      <div className="hd cal-hd">
        <div className="col" style={{ gap: 4, minWidth: 0 }}>
          <span className="eb">تقویم</span>
          <h1 className="t1" aria-live="polite">{label === formatJalaliDay(day) ? label : `${label}، ${formatJalaliDay(day)}`}</h1>
          <span className="mute sm">{sum ? <>{day === today ? 'امروز' : 'این روز'} <b style={{ color: 'var(--ink)' }}>{sum}</b> دارید.</> : 'قراری ثبت نشده.'}</span>
        </div>
        <span className="sp" />
        <button type="button" className="btn btn-p cal-new" onClick={() => setDialog({ preset: { day } })}>
          <Icon name="plus" size="s" thick />
          قرار تازه
        </button>
      </div>

      <div className="bd"><div className="cal-body">
        <section className="card cal-month" aria-label={`${JALALI_MONTHS[j.m - 1]} ${toFaDigits(j.y)}`}>
          <div className="cal-mhd">
            <button type="button" className="ib ghost" aria-label="ماه قبل" onClick={() => pick(addJalaliMonths(day, -1))}><Icon name="chr" /></button>
            <b className="cal-mname">{JALALI_MONTHS[j.m - 1]} <span className="num">{toFaDigits(j.y)}</span></b>
            <button type="button" className="ib ghost" aria-label="ماه بعد" onClick={() => pick(addJalaliMonths(day, 1))}><Icon name="chl" /></button>
          </div>
          <div className="cal-wk" aria-hidden="true">
            {WEEK_SHORT.map((w, i) => <span key={w} className={i === 6 ? 'fri' : ''}>{w}</span>)}
          </div>
          <div key={cells[0]} className="cal-days">
            {cells.map((c) => (
              <DayCell key={c} k={c} n={byDay.get(c)?.length ?? 0} out={jalaliOf(c).m !== j.m} today={c === today} on={c === day} onPick={pick} />
            ))}
          </div>
          {day !== today && (
            <button type="button" className="lnk sm cal-back" onClick={() => pick(today)}>برگشت به امروز</button>
          )}
        </section>

        <section key={day} className="card cal-list enter" aria-label={`برنامهٔ ${formatJalaliDay(day)}`}>
          {list.length === 0 ? (
            <div className="cal-empty">
              <span className="cal-empty-i"><Icon name="cal" size="l" /></span>
              <b>{day === today ? 'امروز قراری ندارید' : 'برای این روز قراری ندارید'}</b>
              <button type="button" className="btn btn-s" onClick={() => setDialog({ preset: { day } })}>
                <Icon name="plus" size="s" />
                ثبت قرار برای این روز
              </button>
              {next && (
                <button type="button" className="lnk sm" onClick={() => pick(next)}>
                  قرار بعدی: {dayName(next, today)}
                </button>
              )}
            </div>
          ) : (
            list.map((v, i) => {
              const l = v.listingId ? listings.get(v.listingId) : undefined;
              const c = v.clientId ? clients.get(v.clientId) : undefined;
              const past = v.done || v.endsAt < nowIso;
              return (
                <div key={v.id}>
                  {i === nowAt && <NowLine />}
                  <div className={`cal-row${past ? ' past' : ''}`}>
                    <span className="cal-time num">{formatTime(v.startsAt)}</span>
                    <button type="button" className="cal-main" onClick={() => setDialog({ visit: v })} aria-label={`${KIND[v.kind].label}: ${v.title}، ساعت ${formatTime(v.startsAt)}. برای ویرایش بزنید`}>
                      <b className="cal-title">{v.title}</b>
                      <span className="xs mute rw" style={{ gap: 8, flexWrap: 'wrap' }}>
                        <span className="cal-kind"><Icon name={KIND[v.kind].icon} size="s" />{KIND[v.kind].label}</span>
                        {l && <Plaque value={l.plaque} deal={l.deal} size="s" />}
                        {l ? listingPlace(l) : c ? c.name : ''}
                        {v.done && <span>· انجام شد</span>}
                      </span>
                    </button>
                    {c?.phone && (
                      <CallLink className="ib" phone={c.phone} label={`تماس با ${c.name}`} style={{ width: 44, height: 44 }}>
                        <Icon name="phone" size="s" />
                      </CallLink>
                    )}
                  </div>
                </div>
              );
            })
          )}
          {nowAt === -1 && day === today && list.length > 0 && <NowLine />}
        </section>
      </div></div>

      {dialog && <VisitDialog visit={dialog.visit} preset={dialog.preset} onClose={() => setDialog(null)} />}
    </div>
  );
}

/** هر خانهٔ ماه جدا memo شده؛ با زدن روز تازه فقط دو خانه (قبلی و تازه) دوباره رندر می‌شوند. */
const DayCell = memo(function DayCell({ k, n, out, today, on, onPick }: { k: string; n: number; out: boolean; today: boolean; on: boolean; onPick: (k: string) => void }) {
  return (
    <button
      type="button"
      className={`cal-d${today ? ' today' : ''}${out ? ' out' : ''}${weekdayIndex(k) === 6 ? ' fri' : ''}`}
      aria-pressed={on}
      aria-label={`${formatJalaliDay(k)}${n ? `، ${toFaDigits(n)} قرار` : ''}`}
      onClick={() => onPick(k)}
    >
      <span className="num">{toFaDigits(jalaliOf(k).d)}</span>
      <span className="cal-dots">{n > 0 && <i />}{n > 1 && <i />}{n > 2 && <i />}</span>
    </button>
  );
});

function NowLine() {
  return (
    <div className="cal-now" aria-hidden="true">
      <span className="num xs b">اکنون</span>
      <i />
      <span className="sp" />
    </div>
  );
}
