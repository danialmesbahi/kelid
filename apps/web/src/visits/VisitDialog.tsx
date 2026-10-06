import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { CheckBox, Icon, Plaque, Segmented } from '@kelid/ui';
import {
  addDays, formatJalaliDay, formatPlaque, listingTitle, tehranDayKey, tehranIso, tehranTimeOf, toEnDigits, toFaDigits,
  type Client, type Listing, type Visit, type VisitKind,
} from '@kelid/core';
import { useQuery, useStore } from '../data';
import { useToast } from '../layout/Toasts';
import { usePhone } from '../layout/usePhone';
import { JalaliPicker } from './JalaliPicker';
import { TimePicker } from './TimePicker';
import { Select } from '../layout/Select';

const KINDS: Array<{ value: VisitKind; label: string }> = [
  { value: 'visit', label: 'بازدید' },
  { value: 'call', label: 'تماس' },
  { value: 'signing', label: 'قرارداد' },
  { value: 'task', label: 'کار' },
];

const DURATIONS = [30, 60, 90, 120];

/** عنوان پیش‌فرض از نوع قرار و نام مشتری یا پلاک فایل؛ کاربر می‌تواند خودش بنویسد. */
function autoTitle(kind: VisitKind, client?: Client, listing?: Listing): string {
  const who = client?.name;
  const file = listing ? `فایل ${formatPlaque(listing.plaque)}` : '';
  if (kind === 'visit') return who ? `بازدید با ${who}` : file ? `بازدید ${file}` : '';
  if (kind === 'call') return who ? `تماس با ${who}` : file ? `تماس با مالک ${file}` : '';
  if (kind === 'signing') return who ? `امضای قرارداد با ${who}` : file ? `امضای قرارداد ${file}` : '';
  return '';
}

/** ساعت گرد بعدی به وقت تهران، برای قرار تازه. */
function defaultStart(): { day: string; time: string } {
  const [h = 9] = tehranTimeOf(new Date().toISOString()).split(':').map(Number);
  // از ۹ شب به بعد «ساعت بعد» دیروقت یا گذشته است؛ فردا ساعت ۹ صبح پیشنهاد می‌شود.
  if (h >= 21) return { day: addDays(tehranDayKey(), 1), time: '09:00' };
  return { day: tehranDayKey(), time: `${String(h + 1).padStart(2, '0')}:00` };
}

/** day و time از تقویم می‌آیند: کلیک روی یک خانهٔ خالی، قرار تازه را همان روز و ساعت باز می‌کند. */
export type VisitPreset = { listingId?: string; clientId?: string; day?: string; time?: string; kind?: VisitKind };

/**
 * پنجرهٔ ثبت یا ویرایش قرار. کاملاً با صفحه‌کلید کار می‌کند: Tab بین فیلدها، Enter ثبت، Esc بستن.
 */
export function VisitDialog({ visit, preset, onClose }: { visit?: Visit; preset?: VisitPreset; onClose: () => void }) {
  const store = useStore();
  const toast = useToast();
  const data = useQuery('visit-dialog', async (s) => ({ listings: await s.listListings(), clients: await s.listClients() }));
  const [kind, setKind] = useState<VisitKind>(visit?.kind ?? preset?.kind ?? 'visit');
  const [title, setTitle] = useState(visit?.title ?? '');
  const [fresh] = useState(() => {
    const d = defaultStart();
    return preset?.day ? { day: preset.day, time: preset.time ?? (preset.day === d.day ? d.time : '09:00') } : d;
  });
  const [day, setDay] = useState(visit ? tehranDayKey(new Date(visit.startsAt)) : fresh.day);
  const [time, setTime] = useState(visit ? tehranTimeOf(visit.startsAt) : fresh.time);
  const [duration, setDuration] = useState(visit ? Math.max(15, Math.round((Date.parse(visit.endsAt) - Date.parse(visit.startsAt)) / 60_000)) : 60);
  const [listingId, setListingId] = useState(visit?.listingId ?? preset?.listingId ?? '');
  const [clientId, setClientId] = useState(visit?.clientId ?? preset?.clientId ?? '');
  const [done, setDone] = useState(visit?.done ?? false);
  const [error, setError] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const phone = usePhone();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  // Enter دوباره یا دو کلیک سریع نباید دو قرار ثبت کند.
  const saving = useRef(false);

  const listing = data?.listings.find((l) => l.id === listingId);
  const client = data?.clients.find((c) => c.id === clientId);
  const suggested = autoTitle(kind, client, listing);
  const today = tehranDayKey();
  // ثابت می‌ماند تا تقویم داخل پنجره با هر حرف عنوان دوباره ساخته نشود
  const pickDay = useCallback((k: string) => {
    setDay(k);
    setCalendarOpen(false);
  }, []);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    // روی گوشی (همان مرز usePhone) فوکوس روی فیلد، صفحه‌کلید را باز می‌کند و نیمی از برگه را می‌پوشاند.
    if (matchMedia('(max-width: 767px)').matches) dialogRef.current?.focus();
    else firstRef.current?.focus();
    return () => prev?.focus();
  }, []);

  // Tab داخل پنجره می‌چرخد و Esc می‌بندد.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const items = [...dialogRef.current.querySelectorAll<HTMLElement>('button, input, select, textarea, [tabindex="0"]')].filter((el) => !el.hasAttribute('disabled') && el.tabIndex >= 0);
    const firstEl = items[0];
    const lastEl = items.at(-1);
    if (e.shiftKey && document.activeElement === firstEl) {
      e.preventDefault();
      lastEl?.focus();
    } else if (!e.shiftKey && document.activeElement === lastEl) {
      e.preventDefault();
      firstEl?.focus();
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const hhmm = toEnDigits(time);
    const finalTitle = title.trim() || suggested;
    if (!finalTitle) {
      setError('یک عنوان کوتاه بنویسید.');
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(hhmm)) {
      setError('ساعت را درست وارد کنید.');
      return;
    }
    if (saving.current) return;
    const startsAt = tehranIso(day, hhmm);
    const input = {
      kind, title: finalTitle, startsAt, endsAt: new Date(Date.parse(startsAt) + duration * 60_000).toISOString(),
      listingId: listingId || undefined, clientId: clientId || undefined, done,
    };
    saving.current = true;
    try {
      if (visit) await store.updateVisit(visit.id, input);
      else await store.addVisit(input);
    } catch (err) {
      saving.current = false;
      setError(err instanceof Error ? err.message : 'ذخیره نشد؛ دوباره تلاش کنید.');
      return;
    }
    const when = day === today ? 'امروز' : day === addDays(today, 1) ? 'فردا' : formatJalaliDay(day);
    toast(`${finalTitle} · ${when} ساعت ${toFaDigits(hhmm)} ${visit ? 'ذخیره شد' : 'ثبت شد'}`);
    onClose();
  };

  // روی گوشی تقویم بسته است و با دکمهٔ «تقویم» باز می‌شود؛ وگرنه فرم از صفحه بلندتر می‌شود.
  const showCalendar = !phone || calendarOpen;
  const quickDays = [{ k: today, l: 'امروز' }, { k: addDays(today, 1), l: 'فردا' }, { k: addDays(today, 2), l: 'پس‌فردا' }];
  const customDay = !quickDays.some((q) => q.k === day);

  // پنجره بیرون از صفحه رندر می‌شود: صفحه view-transition-name دارد و لایهٔ جدا می‌سازد،
  // پس داخل آن نوار بالا و نوار پایین گوشی روی پنجره می‌افتادند.
  // کلیک بیرون فقط همین پنجره را ببندد، نه پنل قراردادی که این پنجره از آن باز شده.
  return createPortal(
    <div className="overlay vd-ov" onMouseDown={(e) => { e.stopPropagation(); onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="vd-title" tabIndex={-1} className="vd pop" onMouseDown={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
        <form onSubmit={submit} className="vd-form">
          <div className="vd-hd rw" style={{ gap: 10 }}>
            <h2 id="vd-title" className="t2 sp">{visit ? 'ویرایش قرار' : 'قرار تازه'}</h2>
            <button type="button" className="ib ghost" aria-label="بستن" onClick={onClose}><Icon name="x" /></button>
          </div>

          <div className="vd-bd col">
            <div className="vd-fill">
              <Segmented<VisitKind> label="نوع قرار" value={kind} onChange={setKind} options={KINDS} />
            </div>

            <label className="lbl">
              عنوان
              <input ref={firstRef} className="fld" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={suggested || 'مثلاً پیگیری سند'} />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              <div className="lbl">
                <span>فایل</span>
                <Select<string>
                  label="فایل"
                  value={listingId}
                  onChange={setListingId}
                  options={[{ value: '', label: 'بدون فایل' }, ...(data?.listings ?? []).map((l) => ({ value: l.id, label: `${listingTitle(l)}`, hint: `${formatPlaque(l.plaque)} · ${l.neighborhood}`, lead: <Plaque value={l.plaque} deal={l.deal} size="s" /> }))]}
                />
              </div>
              <div className="lbl">
                <span>مشتری</span>
                <Select<string>
                  label="مشتری"
                  value={clientId}
                  onChange={setClientId}
                  options={[{ value: '', label: 'بدون مشتری' }, ...(data?.clients ?? []).map((c) => ({ value: c.id, label: c.name, hint: toFaDigits(c.phone) }))]}
                />
              </div>
            </div>

            <div className="col" style={{ gap: 8 }}>
              <div className="rw" style={{ gap: 8 }}>
                <span id="vd-day" className="sb sm" style={{ color: 'var(--ink2)' }}>روز</span>
                <span className="sp" />
                <span className="sm b" aria-live="polite">{formatJalaliDay(day)}</span>
              </div>
              <div className="vd-days" role="group" aria-labelledby="vd-day">
                {quickDays.map((q) => (
                  <button key={q.k} type="button" className="vd-chip" aria-pressed={day === q.k} onClick={() => { setDay(q.k); setCalendarOpen(false); }}>{q.l}</button>
                ))}
                {phone && (
                  <button type="button" className="vd-chip" aria-pressed={customDay} aria-expanded={calendarOpen} onClick={() => setCalendarOpen((o) => !o)}>
                    <Icon name="cal" size="s" />تقویم
                  </button>
                )}
              </div>
              {showCalendar && <JalaliPicker value={day} onChange={pickDay} label="انتخاب روز" />}
            </div>

            <div className="vd-when rw">
              <div className="col" style={{ flex: '1 1 180px', gap: 7 }}>
                <span className="sb sm" style={{ color: 'var(--ink2)' }}>ساعت</span>
                <TimePicker value={time} onChange={setTime} />
              </div>
              <div className="vd-dur col" style={{ gap: 7 }}>
                <span className="sb sm" style={{ color: 'var(--ink2)' }}>مدت</span>
                <Segmented<number> label="مدت قرار" value={duration} onChange={setDuration} options={DURATIONS.map((d) => ({ value: d, label: d < 60 ? `${toFaDigits(d)} دقیقه` : `${toFaDigits(d / 60).replace('.', '٫')} ساعت` }))} />
              </div>
            </div>

            {visit && (
              <label className="rw sm" style={{ gap: 10 }}>
                <CheckBox checked={done} onChange={setDone} label="انجام شد" />
                انجام شد
              </label>
            )}
          </div>

          <div className="vd-ft rw">
            {error && <span role="alert" className="tag bad">{error}</span>}
            <span className="sp" />
            <button type="button" className="btn btn-g" onClick={onClose}>انصراف</button>
            <button type="submit" className="btn btn-p">{visit ? 'ذخیره' : 'ثبت قرار'}</button>
          </div>
        </form>
      </div>
    </div>,
    document.getElementById('root') ?? document.body,
  );
}
