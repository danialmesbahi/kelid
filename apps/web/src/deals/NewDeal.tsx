import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Icon, Plaque } from '@kelid/ui';
import {
  headlinePrice, listingTitle, matchListing, normalizeForSearch, searchText, suggestedCommission, toFaDigits,
  type Client, type Deal, type Listing,
} from '@kelid/core';
import { useStore } from '../data';
import { useToast } from '../layout/Toasts';
import { Select } from '../layout/Select';
import { listingStatusFor } from './actions';

/**
 * شروع معامله: فایل را پیدا کنید، مشتری را انتخاب کنید (مشتری‌هایی که با فایل جورند بالا می‌آیند).
 * مبلغ از قیمت فایل و کمیسیون از پیشنهاد پر می‌شود و بعداً در پروندهٔ معامله عوض می‌شود.
 */
export function NewDealDialog({ data, listingId, onClose, onCreated }: { data: { deals: Deal[]; listings: Listing[]; clients: Client[] }; listingId?: string; onClose: () => void; onCreated: (id: string) => void }) {
  const store = useStore();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [pick, setPick] = useState(listingId ?? '');
  const [clientId, setClientId] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLInputElement>('input')?.focus();
    return () => prev?.focus();
  }, []);

  // روی window، چون بعد از انتخاب فایل دکمهٔ زیر فوکوس از صفحه می‌رود و فوکوس به body برمی‌گردد.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const taken = new Set(data.deals.filter((d) => d.stage !== 'lost' && d.stage !== 'done').map((d) => d.listingId));
  const nq = normalizeForSearch(q);
  const options = data.listings.filter((l) => l.status !== 'closed' && (!nq || searchText(l).includes(nq))).slice(0, 40);
  const l = data.listings.find((x) => x.id === pick);
  const matches = l
    ? data.clients.map((c) => ({ c, score: matchListing(l, c.need).score })).filter((m) => m.score >= 40).sort((a, b) => b.score - a.score).slice(0, 4)
    : [];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!l || busy.current) return;
    busy.current = true;
    const price = l.deal === 'sale' ? l.price.total : l.price.deposit;
    const rent = l.deal === 'rent' ? l.price.monthlyRent : undefined;
    const c = suggestedCommission(l.deal, price, rent) || undefined;
    const d = await store.addDeal({ listingId: l.id, clientId: clientId || undefined, stage: 'talking', price, rent, commissionBuyer: c, commissionSeller: c, checklist: [] });
    const status = listingStatusFor('talking', l.status);
    if (status) await store.updateListing(l.id, { status });
    toast('معامله شروع شد');
    onCreated(d.id);
  };

  return createPortal(
    <div className="overlay vd-ov" onMouseDown={onClose}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="nd-title" tabIndex={-1} className="vd pop" onMouseDown={(e) => e.stopPropagation()}>
        <form onSubmit={submit} className="vd-form">
          <div className="vd-hd rw" style={{ gap: 10 }}>
            <h2 id="nd-title" className="t2 sp">معاملهٔ تازه</h2>
            <button type="button" className="ib ghost" aria-label="بستن" onClick={onClose}><Icon name="x" /></button>
          </div>
          <div className="vd-bd col">
            {!l ? (
              <>
                <label className="lbl">
                  کدام فایل؟
                  <span className="dl-search">
                    <Icon name="search" size="s" />
                    <input className="fld" value={q} onChange={(e) => setQ(e.target.value)} placeholder="پلاک، محله یا خیابان" />
                  </span>
                </label>
                <div className="dl-pick" role="listbox" aria-label="فایل‌ها">
                  {options.map((x) => (
                    <button key={x.id} type="button" role="option" aria-selected={false} className="row hov" onClick={() => setPick(x.id)}>
                      <Plaque value={x.plaque} deal={x.deal} size="s" />
                      <span className="col sp" style={{ minWidth: 0, textAlign: 'right' }}>
                        <span className="sm sb">{listingTitle(x)}</span>
                        <span className="xs mute">{x.neighborhood}، {x.street}</span>
                      </span>
                      <span className="xs num mute">{headlinePrice(x)}</span>
                      {taken.has(x.id) && <span className="tag warn" style={{ height: 22, fontSize: 12 }}>در جریان</span>}
                    </button>
                  ))}
                  {options.length === 0 && <p className="xs mute" style={{ padding: 12 }}>فایلی پیدا نشد.</p>}
                </div>
              </>
            ) : (
              <>
                <div className="dl-picked">
                  <Plaque value={l.plaque} deal={l.deal} />
                  <span className="col sp" style={{ minWidth: 0 }}>
                    <span className="sb">{listingTitle(l)}</span>
                    <span className="xs mute">{l.neighborhood}، {l.street} · {headlinePrice(l)}</span>
                  </span>
                  <button type="button" className="btn btn-g" style={{ height: 36, padding: '0 10px', fontSize: 14 }} onClick={() => setPick('')}>عوض کردن</button>
                </div>
                {taken.has(l.id) && <p className="tag warn" style={{ alignSelf: 'flex-start' }}>این فایل یک معاملهٔ در جریان دارد.</p>}

                {matches.length > 0 && (
                  <div className="col" style={{ gap: 8 }}>
                    <span className="sb sm" style={{ color: 'var(--ink2)' }}>مشتری‌هایی که با این فایل جورند</span>
                    <div className="dl-matches">
                      {matches.map(({ c, score }) => (
                        <button key={c.id} type="button" className="dl-match" aria-pressed={clientId === c.id} onClick={() => setClientId(clientId === c.id ? '' : c.id)}>
                          <span className="av" aria-hidden="true">{c.name.replace(/^(آقای|خانم|خانوادهٔ)\s*/, '').slice(0, 1)}</span>
                          <span className="col" style={{ minWidth: 0, textAlign: 'right' }}>
                            <span className="sm sb">{c.name}</span>
                            <span className="xs num" style={{ color: 'var(--pri-text)' }}>{toFaDigits(score)}٪ جور</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="lbl">
                  <span>مشتری</span>
                  <Select<string>
                    label="مشتری"
                    value={clientId}
                    onChange={setClientId}
                    options={[{ value: '', label: 'بعداً انتخاب می‌کنم' }, ...data.clients.map((c) => ({ value: c.id, label: c.name, hint: toFaDigits(c.phone) }))]}
                  />
                </div>
                <p className="hint">مبلغ از قیمت فایل و کمیسیون از تعرفهٔ پیشنهادی پر می‌شود؛ در پروندهٔ معامله عوضشان کنید.</p>
              </>
            )}
          </div>
          <div className="vd-ft rw">
            <span className="sp" />
            <button type="button" className="btn btn-g" onClick={onClose}>انصراف</button>
            <button type="submit" className="btn btn-p" disabled={!l} style={{ opacity: l ? 1 : 0.5 }}>شروع معامله</button>
          </div>
        </form>
      </div>
    </div>,
    document.getElementById('root') ?? document.body,
  );
}
