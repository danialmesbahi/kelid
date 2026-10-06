import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import { CheckBox, Cover, Icon, Plaque } from '@kelid/ui';
import {
  addDays, checklistFor, dealCommission, dealLabel, formatJalaliDay, formatToman, listingTitle, suggestedCommission, tehranDayKey, toFaDigits,
  type Client, type Deal, type DealStage, type Listing, type NewDeal,
} from '@kelid/core';
import { useStore } from '../data';
import { useToast } from '../layout/Toasts';
import { Select } from '../layout/Select';
import { coverUrl, useCoverThumbs } from '../photos/photos';
import { JalaliPicker } from '../visits/JalaliPicker';
import { VisitDialog } from '../visits/VisitDialog';
import { STAGES, amountText, parseAmount } from './actions';

/** فیلد مبلغ: هنگام نوشتن ارقام فارسی و جداکننده می‌گیرد، با بیرون رفتن ذخیره می‌شود. */
function Money({ label, value, onSave, hint }: { label: string; value?: number; onSave: (v: number | undefined) => void; hint?: string }) {
  const [text, setText] = useState(amountText(value));
  const [last, setLast] = useState(value);
  // اگر مقدار از بیرون عوض شد (مثلاً «اعمال پیشنهاد» یا برگرداندن)، فیلد هم عوض شود.
  if (value !== last) {
    setLast(value);
    setText(amountText(value));
  }
  return (
    <label className="lbl">
      {label}
      <span className="dl-money">
        <input
          className="fld num"
          inputMode="numeric"
          value={text}
          onChange={(e) => setText(amountText(parseAmount(e.target.value)))}
          onBlur={() => { if (parseAmount(text) !== value) onSave(parseAmount(text)); }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        <span className="xs mute">تومان</span>
      </span>
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

/**
 * پروندهٔ یک معامله: مرحله‌ها، مبلغ و کمیسیون، روز محضر، چک‌لیست قرارداد و یادداشت.
 * هر تغییر همان لحظه ذخیره می‌شود؛ دکمهٔ ذخیره ندارد.
 */
export function DealPanel({ d, l, clients, onMove, onClose }: { d: Deal; l?: Listing; clients: Client[]; onMove: (s: DealStage) => void; onClose: () => void }) {
  const store = useStore();
  const toast = useToast();
  const thumbs = useCoverThumbs();
  const [notes, setNotes] = useState(d.notes ?? '');
  const [picker, setPicker] = useState(false);
  const [visit, setVisit] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const today = tehranDayKey();
  const items = l ? checklistFor(l.deal) : [];
  const doneCount = items.filter((i) => d.checklist.includes(i.id)).length;
  const lease = l && l.deal !== 'sale';
  const suggestion = l ? suggestedCommission(l.deal, d.price, d.rent) : 0;
  const stageIdx = STAGES.findIndex((s) => s.id === d.stage);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => prev?.focus();
  }, []);

  const save = (patch: Partial<NewDeal>) => void store.updateDeal(d.id, patch);
  // مبلغ و یادداشت با blur ذخیره می‌شوند؛ قبل از بستن، فیلد فعال را blur می‌کنیم تا نوشته‌ها با Esc یا کلیک بیرون گم نشوند.
  const close = useCallback(() => {
    if (ref.current?.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
    onClose();
  }, [onClose]);
  // روی window تا هر جای پنل فوکوس باشد کار کند؛ پنجرهٔ قرار، Esc خودش را نگه می‌دارد.
  useEffect(() => {
    if (visit) return;
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visit, close]);
  const toggle = (id: string, on: boolean) => save({ checklist: on ? [...d.checklist, id] : d.checklist.filter((x) => x !== id) });
  const ring = items.length ? doneCount / items.length : 0;

  return createPortal(
    <div className="overlay dl-ov" onMouseDown={close}>
      <aside ref={ref} role="dialog" aria-modal="true" aria-label="پروندهٔ معامله" tabIndex={-1} className="dl-panel" onMouseDown={(e) => e.stopPropagation()}>
        <header className="dl-p-hd">
          <span className="dl-p-cover">{l && <Cover variant={l.cover} src={coverUrl(thumbs, l.id)} />}</span>
          <div className="col" style={{ minWidth: 0, flex: 1, gap: 3 }}>
            <span className="rw" style={{ gap: 8 }}>
              {l && <Plaque value={l.plaque} deal={l.deal} size="s" />}
              <span className="xs mute">{l ? dealLabel[l.deal] : ''}</span>
            </span>
            <h2 className="t2 dl-ell">{l ? listingTitle(l) : 'فایل حذف شده'}</h2>
            {l && <Link viewTransition to={`/files/${l.id}`} className="lnk xs">پروندهٔ فایل</Link>}
          </div>
          <button type="button" className="ib ghost" aria-label="بستن" onClick={close}><Icon name="x" /></button>
        </header>

        <div className="dl-p-bd">
          <nav className="dl-stepper" aria-label="مرحلهٔ معامله">
            {STAGES.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-current={d.stage === s.id ? 'step' : undefined}
                className={`dl-st${i < stageIdx ? ' past' : ''}${d.stage === s.id ? ' on' : ''}`}
                onClick={() => onMove(s.id)}
              >
                <span className="dl-st-dot num">{i < stageIdx ? <Icon name="check" size="s" thick /> : toFaDigits(i + 1)}</span>
                <span className="dl-st-l">{s.label}</span>
              </button>
            ))}
          </nav>
          {d.stage === 'lost' && <p className="tag warn" style={{ alignSelf: 'flex-start' }}>این معامله منصرف شده؛ با زدن یک مرحله برمی‌گردد.</p>}

          <div className="lbl">
            <span>مشتری</span>
            <Select<string>
              label="مشتری"
              value={d.clientId ?? ''}
              onChange={(v) => save({ clientId: v || undefined })}
              options={[{ value: '', label: 'بدون مشتری' }, ...clients.map((c) => ({ value: c.id, label: c.name, hint: toFaDigits(c.phone) }))]}
            />
          </div>

          <div className="dl-grid2">
            <Money label={lease ? 'ودیعه' : 'قیمت توافقی'} value={d.price} onSave={(price) => save({ price })} />
            {l?.deal === 'rent' && <Money label="اجارهٔ ماهانه" value={d.rent} onSave={(rent) => save({ rent })} />}
          </div>

          <section className="dl-box">
            <div className="rw" style={{ gap: 10 }}>
              <span className="t3">کمیسیون</span>
              <span className="sp" />
              <span className="dl-comm-total num">{dealCommission(d) ? formatToman(dealCommission(d)) : '—'}</span>
            </div>
            <div className="dl-grid2">
              <Money label={lease ? 'از مستأجر' : 'از خریدار'} value={d.commissionBuyer} onSave={(commissionBuyer) => save({ commissionBuyer })} />
              <Money label={lease ? 'از موجر' : 'از فروشنده'} value={d.commissionSeller} onSave={(commissionSeller) => save({ commissionSeller })} />
            </div>
            {suggestion > 0 && (suggestion !== d.commissionBuyer || suggestion !== d.commissionSeller) && (
              <div className="dl-suggest">
                <Icon name="spark" size="s" />
                <span className="sp xs">
                  پیشنهاد: <b className="num">{formatToman(suggestion)}</b> از هر طرف
                  <span className="mute"> ({lease ? 'یک‌چهارم اجارهٔ یک ماه' : 'نیم درصد قیمت'}؛ با تعرفهٔ شهرتان تطبیق دهید)</span>
                </span>
                <button type="button" className="btn btn-s" style={{ height: 34, padding: '0 12px', fontSize: 13.5 }} onClick={() => save({ commissionBuyer: suggestion, commissionSeller: suggestion })}>اعمال</button>
              </div>
            )}
          </section>

          <section className="col" style={{ gap: 8 }}>
            <div className="rw" style={{ gap: 8 }}>
              <span className="t3">{l?.deal === 'sale' ? 'روز محضر' : 'روز امضا'}</span>
              <span className="sp" />
              <span className="sm b">{d.dueDay ? formatJalaliDay(d.dueDay) : 'تعیین نشده'}</span>
            </div>
            <div className="vd-days">
              {[{ k: today, l: 'امروز' }, { k: addDays(today, 1), l: 'فردا' }, { k: addDays(today, 7), l: 'هفتهٔ بعد' }].map((q) => (
                <button key={q.k} type="button" className="vd-chip" aria-pressed={d.dueDay === q.k} onClick={() => save({ dueDay: q.k })}>{q.l}</button>
              ))}
              <button type="button" className="vd-chip" aria-expanded={picker} onClick={() => setPicker((v) => !v)}><Icon name="cal" size="s" />تقویم</button>
              {d.dueDay && <button type="button" className="vd-chip" onClick={() => save({ dueDay: undefined })}>بدون روز</button>}
            </div>
            {picker && <JalaliPicker value={d.dueDay ?? today} onChange={(k) => { save({ dueDay: k }); setPicker(false); }} label="روز محضر" />}
            {d.dueDay && (
              <button type="button" className="lnk sm" style={{ alignSelf: 'flex-start', border: 0, background: 'none', padding: '4px 0' }} onClick={() => setVisit(true)}>
                + ثبت قرار امضا در تقویم
              </button>
            )}
          </section>

          {items.length > 0 && (
            <section className="col" style={{ gap: 6 }}>
              <div className="rw" style={{ gap: 10, marginBottom: 4 }}>
                <span className="dl-ring" style={{ '--p': ring } as CSSProperties} aria-hidden="true"><span className="num">{toFaDigits(Math.round(ring * 100))}٪</span></span>
                <span className="col">
                  <span className="t3">چک‌لیست قرارداد</span>
                  <span className="xs mute num">{toFaDigits(doneCount)} از {toFaDigits(items.length)} آماده است</span>
                </span>
              </div>
              {items.map((it) => {
                const on = d.checklist.includes(it.id);
                return (
                  <label key={it.id} className={`dl-check${on ? ' on' : ''}`}>
                    <CheckBox checked={on} onChange={(v) => toggle(it.id, v)} label={it.label} size={22} />
                    <span className="sm">{it.label}</span>
                  </label>
                );
              })}
            </section>
          )}

          <label className="lbl">
            یادداشت
            <textarea className="fld" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (d.notes ?? '') && save({ notes: notes.trim() || undefined })} placeholder="شرط‌ها، قول‌ها، تاریخ تحویل…" />
          </label>
        </div>

        <footer className="dl-p-ft">
          {d.stage !== 'lost' && <button type="button" className="btn btn-g" onClick={() => onMove('lost')}>منصرف شد</button>}
          <button
            type="button"
            className="btn btn-g"
            style={{ color: 'var(--bad)' }}
            onClick={async () => {
              await store.archiveDeal(d.id);
              onClose();
              toast('معامله حذف شد', { label: 'برگرداندن', run: () => void store.restoreDeal(d.id) });
            }}
          >
            حذف
          </button>
          <span className="sp" />
          {d.stage !== 'done' && d.stage !== 'lost' && (
            <button type="button" className="btn btn-p" onClick={() => onMove(STAGES[Math.min(stageIdx + 1, STAGES.length - 1)]!.id)}>
              {stageIdx === STAGES.length - 2 ? 'معامله تمام شد' : `رفتن به «${STAGES[stageIdx + 1]?.label}»`}
              <Icon name="chl" size="s" />
            </button>
          )}
        </footer>
      </aside>
      {visit && <VisitDialog preset={{ listingId: d.listingId, clientId: d.clientId, day: d.dueDay, time: '10:00', kind: 'signing' }} onClose={() => setVisit(false)} />}
    </div>,
    document.getElementById('root') ?? document.body,
  );
}
