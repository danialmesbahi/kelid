import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { Cover, Icon, Plaque } from '@kelid/ui';
import {
  checklistFor, dealCommission, formatJalaliDay, formatToman, jalaliOf, listingTitle, tehranDayKey, toFaDigits,
  type Client, type Deal, type DealStage, type Listing,
  listingPlace,
} from '@kelid/core';
import { useQuery, useSlow } from '../data';
import { dealsQuery } from '../queries';
import { PageSkeleton } from '../layout/PageSkeleton';
import { usePhone } from '../layout/usePhone';
import { coverUrl, useCoverThumbs } from '../photos/photos';
import { dayName } from '../calendar/time';
import { STAGES, STAGE_LABEL, useMoveDeal } from './actions';
import { DealPanel } from './DealPanel';
import { NewDealDialog } from './NewDeal';
import './deals.css';

type Live = Exclude<DealStage, 'lost'>;

export function DealsPage() {
  const data = useQuery(dealsQuery.key, dealsQuery.fn);
  const slow = useSlow(!data);
  const phone = usePhone();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Live>('talking');
  const [showLost, setShowLost] = useState(false);
  // کارتی که تازه به «تمام شد» رسیده مهر می‌خورد
  const [stamped, setStamped] = useState<string | null>(null);
  const move = useMoveDeal();
  const thumbs = useCoverThumbs();
  const openId = params.get('d');
  const newFor = params.get('new');

  const setParam = (k: string, v: string | null) =>
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (v === null) n.delete(k);
      else n.set(k, v);
      if (k === 'new' && v === null) n.delete('new');
      return n;
    }, { replace: true });

  if (!data) return slow ? <PageSkeleton /> : null;

  const listings = new Map(data.listings.map((l) => [l.id, l]));
  const clients = new Map(data.clients.map((c) => [c.id, c]));
  const live = data.deals.filter((d) => d.stage !== 'lost');
  const lost = data.deals.filter((d) => d.stage === 'lost');
  const open = data.deals.find((d) => d.id === openId);
  const inProgress = live.filter((d) => d.stage !== 'done');
  const month = jalaliOf(tehranDayKey());
  const earned = live.filter((d) => d.stage === 'done' && d.closedAt && (() => { const j = jalaliOf(tehranDayKey(new Date(d.closedAt))); return j.y === month.y && j.m === month.m; })()).reduce((s, d) => s + dealCommission(d), 0);
  const coming = inProgress.reduce((s, d) => s + dealCommission(d), 0);

  const onMove = async (d: Deal, stage: DealStage) => {
    await move(d, listings.get(d.listingId), stage);
    if (stage === 'done') setStamped(d.id);
  };

  const card = (d: Deal) => (
    <DealCard
      key={d.id}
      d={d}
      l={listings.get(d.listingId)}
      c={d.clientId ? clients.get(d.clientId) : undefined}
      cover={coverUrl(thumbs, d.listingId)}
      stamped={stamped === d.id}
      onOpen={() => setParam('d', d.id)}
    />
  );

  return (
    <div className="dlpage">
      <div className="hd dl-hd">
        <div className="col" style={{ gap: 4 }}>
          <span className="eb">قراردادها</span>
          <h1 className="t1">خط معامله‌ها</h1>
          <span className="mute sm">
            {inProgress.length ? <><b style={{ color: 'var(--ink)' }}>{toFaDigits(inProgress.length)} معامله</b> در جریان است.</> : 'معاملهٔ در جریانی ندارید.'}
          </span>
        </div>
        <span className="sp" />
        <div className="dl-stats">
          <Stat label="کمیسیون در راه" value={coming ? formatToman(coming) : '—'} />
          <Stat label={`درآمد ${['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'][month.m - 1]}`} value={earned ? formatToman(earned) : '—'} gold />
        </div>
        <button type="button" className="btn btn-p dl-new" onClick={() => setParam('new', '')}>
          <Icon name="plus" size="s" thick />
          معاملهٔ تازه
        </button>
      </div>

      {phone ? (
        <div className="bd" style={{ paddingTop: 0 }}>
          <div className="dl-tabs" role="tablist" aria-label="مرحله‌ها">
            {STAGES.map((s) => {
              const n = live.filter((d) => d.stage === s.id).length;
              return (
                <button key={s.id} type="button" role="tab" aria-selected={tab === s.id} onClick={() => setTab(s.id)}>
                  {s.label}
                  <span className="num">{toFaDigits(n)}</span>
                </button>
              );
            })}
          </div>
          <div key={tab} className="col stagger" style={{ gap: 12 }}>
            {live.filter((d) => d.stage === tab).map(card)}
            {!live.some((d) => d.stage === tab) && <Empty stage={tab} />}
          </div>
        </div>
      ) : (
        <Board deals={live} onMove={onMove} render={card} />
      )}

      {lost.length > 0 && (
        <div className="dl-lost">
          <button type="button" className="lnk sm" aria-expanded={showLost} onClick={() => setShowLost((v) => !v)}>
            {showLost ? 'پنهان کردن' : 'نمایش'} {toFaDigits(lost.length)} معاملهٔ منصرف‌شده
          </button>
          {showLost && (
            <div className="dl-lost-list enter">
              {lost.map((d) => {
                const l = listings.get(d.listingId);
                return (
                  <button key={d.id} type="button" className="row hov" onClick={() => setParam('d', d.id)}>
                    {l && <Plaque value={l.plaque} deal={l.deal} size="s" />}
                    <span className="sp sm" style={{ textAlign: 'right' }}>{l ? listingTitle(l) : 'فایل'} · {d.clientId ? clients.get(d.clientId)?.name : 'بدون مشتری'}</span>
                    <span className="xs mute">منصرف شد</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {open && (
        <DealPanel
          d={open}
          l={listings.get(open.listingId)}
          clients={data.clients}
          onMove={(stage) => onMove(open, stage)}
          onClose={() => setParam('d', null)}
        />
      )}
      {newFor !== null && (
        <NewDealDialog
          data={data}
          listingId={newFor || undefined}
          onClose={() => setParam('new', null)}
          onCreated={(id) => setParams((p) => { const n = new URLSearchParams(p); n.delete('new'); n.set('d', id); return n; }, { replace: true })}
        />
      )}
    </div>
  );
}

function Stat({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <span className={`dl-stat${gold ? ' gold' : ''}`}>
      <span className="xs mute">{label}</span>
      <span className="num">{value}</span>
    </span>
  );
}

function Empty({ stage }: { stage: Live }) {
  const text: Record<Live, string> = {
    talking: 'معامله‌ای در مذاکره نیست. از «معاملهٔ تازه» شروع کنید.',
    deposit: 'هنوز بیعانه‌ای گرفته نشده.',
    signed: 'قرارداد امضاشده‌ای در راه نیست.',
    done: 'معاملهٔ تمام‌شده‌ای نیست.',
  };
  return <p className="dl-empty xs mute">{text[stage]}</p>;
}

/** ستون‌های خط معامله؛ کارت با موس به ستون دیگر کشیده می‌شود. */
function Board({ deals, onMove, render }: { deals: Deal[]; onMove: (d: Deal, s: DealStage) => Promise<void> | void; render: (d: Deal) => ReactNode }) {
  const g = useRef<{ d: Deal; x0: number; y0: number; x: number; y: number; cols: Array<{ id: Live; r: DOMRect }>; moved: boolean; el: HTMLElement } | null>(null);
  // state فقط وقتی عوض می‌شود که ستون زیر موس عوض شود؛ جابه‌جایی خود کارت مستقیم روی DOM است تا هر حرکت موس کل تابلو را رندر نکند.
  const [drag, setDrag] = useState<{ id: string; to: Live } | null>(null);
  const dragRef = useRef(drag);
  // کارت رهاشده همان لحظه در ستون تازه می‌نشیند، بی آنکه منتظر ذخیره بماند و یک لحظه به جای قبلی‌اش بپرد.
  const [moved, setMoved] = useState<Record<string, Live>>({});
  // جایی که کارت رها شد؛ بعد از رندر، کارت از همان‌جا نرم به جای تازه‌اش سُر می‌خورد.
  const flip = useRef<{ id: string; x: number; y: number; rot: number } | null>(null);
  const frame = useRef(0);
  const boardRef = useRef<HTMLDivElement>(null);
  const swallow = useRef(false);

  useEffect(() => {
    // کلیکی که پایان کشیدن است کارت را باز نکند
    const stop = (e: MouseEvent) => {
      if (!swallow.current) return;
      swallow.current = false;
      e.stopPropagation();
      e.preventDefault();
    };
    window.addEventListener('click', stop, true);
    return () => {
      window.removeEventListener('click', stop, true);
      cancelAnimationFrame(frame.current);
    };
  }, []);

  // وقتی دادهٔ ذخیره‌شده به جای تازه رسید، جای موقت لازم نیست.
  useEffect(() => {
    setMoved((m) => {
      const done = Object.keys(m).filter((id) => deals.find((d) => d.id === id)?.stage === m[id] || !deals.some((d) => d.id === id));
      if (!done.length) return m;
      const next = { ...m };
      for (const id of done) delete next[id];
      return next;
    });
  }, [deals]);

  useLayoutEffect(() => {
    const f = flip.current;
    if (!f) return;
    flip.current = null;
    const el = boardRef.current?.querySelector<HTMLElement>(`[data-deal="${f.id}"]`);
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = el.getBoundingClientRect();
    const dx = f.x - (r.left + r.width / 2);
    const dy = f.y - (r.top + r.height / 2);
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    el.animate([{ transform: `translate(${dx}px, ${dy}px) rotate(${f.rot}deg)` }, { transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.2, .8, .2, 1)' });
  });

  const stageOf = (d: Deal) => moved[d.id] ?? (d.stage as Live);

  // کشیدن نیمه‌کاره (رها شده بیرون صفحه یا لغو شده) بی‌صدا برمی‌گردد و هیچ معامله‌ای جابه‌جا نمی‌شود
  const reset = () => {
    const s = g.current;
    g.current = null;
    cancelAnimationFrame(frame.current);
    if (!s?.moved) return;
    s.el.style.transform = '';
    dragRef.current = null;
    setDrag(null);
  };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    reset();
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-deal]');
    if (!el || e.button !== 0 || e.pointerType === 'touch') return;
    const d = deals.find((x) => x.id === el.dataset.deal);
    if (!d) return;
    const cols = [...(boardRef.current?.querySelectorAll<HTMLElement>('[data-stage]') ?? [])].map((c) => ({ id: c.dataset.stage as Live, r: c.getBoundingClientRect() }));
    g.current = { d, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, cols, moved: false, el };
  };
  const rot = (s: { x: number; x0: number }) => (s.x > s.x0 ? 1.5 : -1.5);
  // هر فریم یک بار: موس می‌تواند در هر فریم چند رویداد بفرستد
  const paint = () => {
    const s = g.current;
    if (!s) return;
    s.el.style.transform = `translate3d(${s.x - s.x0}px, ${s.y - s.y0}px, 0) rotate(${rot(s)}deg)`;
    const hit = s.cols.find((c) => s.x >= c.r.left && s.x <= c.r.right);
    const to = hit?.id ?? stageOf(s.d);
    if (dragRef.current?.id !== s.d.id || dragRef.current.to !== to) {
      dragRef.current = { id: s.d.id, to };
      setDrag(dragRef.current);
    }
  };
  const moveP = (e: PointerEvent<HTMLDivElement>) => {
    const s = g.current;
    if (!s) return;
    if (e.buttons === 0) return reset();
    s.x = e.clientX;
    s.y = e.clientY;
    if (!s.moved && Math.hypot(s.x - s.x0, s.y - s.y0) < 6) return;
    if (!s.moved) s.el.setPointerCapture?.(e.pointerId);
    s.moved = true;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(paint);
  };
  const up = () => {
    const s = g.current;
    g.current = null;
    cancelAnimationFrame(frame.current);
    if (!s?.moved) return;
    // جای فعلی کارت (با جابه‌جایی) پیش از برداشتن آن، برای سُر خوردن به جای تازه
    const r = s.el.getBoundingClientRect();
    flip.current = { id: s.d.id, x: r.left + r.width / 2, y: r.top + r.height / 2, rot: rot(s) };
    s.el.style.transform = '';
    swallow.current = true;
    setTimeout(() => (swallow.current = false), 0);
    const last = dragRef.current;
    if (last && last.to !== stageOf(s.d)) {
      const id = s.d.id;
      setMoved((m) => ({ ...m, [id]: last.to }));
      // ذخیره نشد (مثلاً اشتراک تمام شده): کارت به جای واقعی‌اش برمی‌گردد
      void Promise.resolve(onMove(s.d, last.to)).catch(() =>
        setMoved((m) => {
          const next = { ...m };
          delete next[id];
          return next;
        }),
      );
    }
    dragRef.current = null;
    setDrag(null);
  };

  return (
    <div className="dl-board" ref={boardRef} onPointerDown={down} onPointerMove={moveP} onPointerUp={up} onPointerCancel={reset}>
      {STAGES.map((s, i) => {
        const mine = deals.filter((d) => stageOf(d) === s.id);
        const sum = mine.reduce((t, d) => t + dealCommission(d), 0);
        return (
          <section key={s.id} data-stage={s.id} className={`dl-col${drag?.to === s.id ? ' drop' : ''}${s.id === 'done' ? ' done' : ''}`} aria-label={s.label}>
            <header className="dl-col-hd">
              <span className="dl-step num">{toFaDigits(i + 1)}</span>
              <span className="col" style={{ minWidth: 0 }}>
                <span className="b">{s.label} <span className="mute num" style={{ fontWeight: 500 }}>{toFaDigits(mine.length)}</span></span>
                <span className="xs faint">{sum ? `کمیسیون ${formatToman(sum)}` : s.hint}</span>
              </span>
            </header>
            <div className="dl-col-bd">
              {mine.map((d) => (
                <div key={d.id} data-deal={d.id} className={drag?.id === d.id ? 'dl-drag' : undefined}>
                  {render(d)}
                </div>
              ))}
              {mine.length === 0 && <Empty stage={s.id} />}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function DealCard({ d, l, c, cover, stamped, onOpen }: { d: Deal; l?: Listing; c?: Client; cover?: string; stamped: boolean; onOpen: () => void }) {
  const items = l ? checklistFor(l.deal) : [];
  const doneItems = items.filter((i) => d.checklist.includes(i.id)).length;
  const pct = items.length ? doneItems / items.length : 0;
  const commission = dealCommission(d);
  const today = tehranDayKey();
  const due = d.dueDay && d.stage !== 'done' ? d.dueDay : undefined;
  return (
    <button type="button" className={`dl-card${d.stage === 'done' ? ' is-done' : ''}`} onClick={onOpen} aria-label={`${l ? listingTitle(l) : 'فایل'}، ${c?.name ?? 'بدون مشتری'}، ${STAGE_LABEL[d.stage]}`}>
      <span className="dl-card-top">
        <span className="dl-thumb">{l && <Cover variant={l.cover} src={cover} />}</span>
        <span className="col" style={{ minWidth: 0, gap: 3, flex: 1 }}>
          <span className="rw" style={{ gap: 6 }}>
            {l && <Plaque value={l.plaque} deal={l.deal} size="s" />}
            {d.price ? <span className="dl-price num">{formatToman(d.price)}</span> : null}
          </span>
          <span className="dl-title">{l ? listingTitle(l) : 'فایل حذف شده'}</span>
          <span className="xs mute dl-ell">{l ? listingPlace(l) : ''}</span>
        </span>
      </span>
      <span className="dl-card-mid">
        <span className="av dl-av" aria-hidden="true">{c ? c.name.replace(/^(آقای|خانم|خانوادهٔ)\s*/, '').slice(0, 1) : '؟'}</span>
        <span className="sm sb dl-ell" style={{ flex: 1 }}>{c?.name ?? 'بدون مشتری'}</span>
        {commission > 0 && <span className="dl-comm num" title="کمیسیون دو طرف">{formatToman(commission)}</span>}
      </span>
      {items.length > 0 && (
        <span className="dl-card-ft">
          <span className="dl-prog" aria-hidden="true"><span style={{ width: `${pct * 100}%` }} /></span>
          <span className="xs mute num">{toFaDigits(doneItems)}/{toFaDigits(items.length)}</span>
          {due && <span className={`dl-due xs${due <= today ? ' soon' : ''}`}><Icon name="cal" size="s" />{dayName(due, today) === formatJalaliDay(due) ? formatJalaliDay(due).split(' ').slice(1).join(' ') : dayName(due, today)}</span>}
        </span>
      )}
      {d.stage === 'done' && <span className={`dl-stamp${stamped ? ' stamp' : ''}`} aria-hidden="true">{l?.deal === 'sale' ? 'فروخته شد' : 'اجاره رفت'}</span>}
    </button>
  );
}
