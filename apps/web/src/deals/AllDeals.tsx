import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon, Plaque } from '@kelid/ui';
import {
  dealLabel, formatJalaliDay, formatToman, listingPlace, listingTitle, normalizeForSearch, searchText, tehranDayKey, toFaDigits,
  type Client, type Deal, type DealStage, type DealType, type Listing,
} from '@kelid/core';
import { useProgressive } from '../layout/useProgressive';
import { STAGES, STAGE_LABEL } from './actions';

const KINDS: DealType[] = ['sale', 'rent', 'full'];

/**
 * همهٔ معامله‌ها در یک فهرست، با جستجو (فایل، محله، پلاک، مشتری) و فیلتر مرحله و نوع؛
 * وقتی ستونی از سقف کارت‌هایش بیشتر شد از دکمهٔ «همه» باز می‌شود.
 */
export function AllDeals({ data, stage, covered, onStage, onOpen, onClose }: {
  data: { deals: Deal[]; listings: Listing[]; clients: Client[] };
  stage: DealStage | '';
  /** پروندهٔ یک معامله رویش باز است؛ Esc اول آن را می‌بندد */
  covered: boolean;
  onStage: (s: DealStage | '') => void;
  onOpen: (id: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<DealType | ''>('');
  const ref = useRef<HTMLDivElement>(null);
  const listings = new Map(data.listings.map((l) => [l.id, l]));
  const clients = new Map(data.clients.map((c) => [c.id, c]));

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    // روی گوشی صفحه‌کلید فهرست را می‌پوشاند؛ فوکوس فقط روی دسکتاپ
    if (matchMedia('(pointer: fine)').matches) ref.current?.querySelector<HTMLInputElement>('input')?.focus();
    else ref.current?.focus();
    return () => prev?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !covered && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [covered, onClose]);

  const nq = normalizeForSearch(q);
  const matches = (d: Deal) => {
    if (!nq) return true;
    const l = listings.get(d.listingId);
    const c = d.clientId ? clients.get(d.clientId) : undefined;
    return (l && searchText(l).includes(nq)) || (c && normalizeForSearch(`${c.name} ${c.phone}`).includes(nq));
  };
  const ofKind = (d: Deal) => !kind || listings.get(d.listingId)?.deal === kind;
  // شمارهٔ هر مرحله با جستجو و نوع فعلی، تا معلوم باشد کجا چیزی پیدا شده
  const base = data.deals.filter((d) => ofKind(d) && matches(d));
  const found = base.filter((d) => !stage || d.stage === stage);
  const shown = useProgressive(found.length);

  const stages: Array<{ id: DealStage | ''; label: string }> = [{ id: '', label: 'همه' }, ...STAGES, { id: 'lost', label: STAGE_LABEL.lost }];

  return createPortal(
    <div className="overlay vd-ov" onMouseDown={onClose}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="ad-title" tabIndex={-1} className="vd pop dl-all" onMouseDown={(e) => e.stopPropagation()}>
        <div className="vd-hd rw" style={{ gap: 10 }}>
          <span className="col sp" style={{ gap: 2 }}>
            <h2 id="ad-title" className="t2">همهٔ معامله‌ها</h2>
            <span className="xs mute">{toFaDigits(found.length)} معامله</span>
          </span>
          <button type="button" className="ib ghost" aria-label="بستن" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="dl-all-tools col">
          <span className="dl-search">
            <Icon name="search" size="s" />
            <input className="fld" value={q} onChange={(e) => setQ(e.target.value)} placeholder="فایل، محله، پلاک یا مشتری" aria-label="جستجو در معامله‌ها" />
          </span>
          <div className="seg dl-all-seg" aria-label="مرحله">
            {stages.map((s) => (
              <button key={s.id} type="button" aria-pressed={stage === s.id} onClick={() => onStage(s.id)}>
                {s.label}
                <span className="num xs mute">{toFaDigits(s.id ? base.filter((d) => d.stage === s.id).length : base.length)}</span>
              </button>
            ))}
          </div>
          <div className="seg dl-all-seg" aria-label="نوع">
            <button type="button" aria-pressed={kind === ''} onClick={() => setKind('')}>همهٔ نوع‌ها</button>
            {KINDS.map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{dealLabel[k]}</button>
            ))}
          </div>
        </div>
        <div className="vd-bd dl-all-list">
          {found.slice(0, shown).map((d) => {
            const l = listings.get(d.listingId);
            const c = d.clientId ? clients.get(d.clientId) : undefined;
            const day = tehranDayKey(new Date(d.closedAt ?? d.updatedAt));
            return (
              <button key={d.id} type="button" className={`row hov dl-all-row${d.stage === 'lost' ? ' is-lost' : ''}`} onClick={() => onOpen(d.id)}>
                {l && <Plaque value={l.plaque} deal={l.deal} size="s" />}
                <span className="col sp" style={{ minWidth: 0, textAlign: 'right' }}>
                  <span className="sm sb dl-ell">{l ? listingTitle(l) : 'فایل حذف شده'}</span>
                  <span className="xs mute dl-ell">{[l && listingPlace(l), c?.name ?? 'بدون مشتری'].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="col dl-all-end">
                  <span className={`dl-all-stage xs${d.stage === 'done' ? ' done' : ''}`}>{STAGE_LABEL[d.stage]}</span>
                  <span className="xs mute num">{d.price ? formatToman(d.price) : formatJalaliDay(day)}</span>
                </span>
              </button>
            );
          })}
          {found.length === 0 && <p className="dl-empty xs mute">معامله‌ای با این جستجو پیدا نشد.</p>}
        </div>
      </div>
    </div>,
    document.getElementById('root') ?? document.body,
  );
}
