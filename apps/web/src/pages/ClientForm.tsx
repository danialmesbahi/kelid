import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router';
import { Icon, Segmented, Switch } from '@kelid/ui';
import {
  bestMatches, dealLabel, formatGrouped, formatToman, normalizeForSearch, normalizePhone, toEnDigits, toFaDigits,
  type Client, type ClientTemperature, type DealType, type NewClient, type PropertyKind,
} from '@kelid/core';
import { useQuery, useStore } from '../data';
import { PageSkeleton } from '../layout/PageSkeleton';
import { useToast } from '../layout/Toasts';
import { useGoBack } from '../layout/useGoBack';
import { FieldError, Req } from '../layout/Field';

const KINDS: Array<{ value: PropertyKind; label: string }> = [
  { value: 'apartment', label: 'آپارتمان' },
  { value: 'villa', label: 'ویلایی' },
  { value: 'shop', label: 'مغازه' },
  { value: 'office', label: 'دفتر کار' },
  { value: 'land', label: 'زمین' },
];

const TEMPS: Array<{ value: ClientTemperature; label: string }> = [
  { value: 'hot', label: 'جدی و فوری' },
  { value: 'warm', label: 'معمولی' },
  { value: 'cold', label: 'فعلاً دست نگه داشته' },
];

function parseAmount(s: string): number | undefined {
  const n = Number(toEnDigits(s).replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
const parseNum = (s: string) => {
  const d = toEnDigits(s).replace(/[^\d]/g, '');
  return d ? Number(d) : undefined;
};
const amountText = (n?: number) => (n ? formatGrouped(n) : '');
const numText = (n?: number) => (n === undefined ? '' : toFaDigits(n));

type FormState = {
  name: string; phone: string; deal: DealType; kinds: PropertyKind[]; neighborhoods: string[];
  areaMin: string; areaMax: string; bedroomsMin: string; budget: string; rent: string;
  temperature: ClientTemperature; waiting: boolean; notes: string;
};

function toState(c?: Client): FormState {
  return {
    name: c?.name ?? '', phone: c?.phone ? toFaDigits(c.phone) : '', deal: c?.need.deal ?? 'sale', kinds: c?.need.kinds ?? ['apartment'], neighborhoods: c?.need.neighborhoods ?? [],
    areaMin: numText(c?.need.areaMin), areaMax: numText(c?.need.areaMax), bedroomsMin: numText(c?.need.bedroomsMin),
    budget: amountText(c?.need.budgetMax), rent: amountText(c?.need.rentMax),
    temperature: c?.temperature ?? 'warm', waiting: c?.waitingForNews ?? false, notes: c?.notes ?? '',
  };
}

const NAME_MSG = 'نام مشتری را بنویسید.';

function toClient(f: FormState): NewClient | string {
  if (!f.name.trim()) return NAME_MSG;
  return {
    name: f.name.trim(),
    phone: normalizePhone(f.phone),
    temperature: f.temperature,
    waitingForNews: f.waiting,
    notes: f.notes.trim() || undefined,
    need: {
      deal: f.deal, kinds: f.kinds, neighborhoods: f.neighborhoods,
      areaMin: parseNum(f.areaMin), areaMax: parseNum(f.areaMax), bedroomsMin: parseNum(f.bedroomsMin),
      budgetMax: parseAmount(f.budget), rentMax: f.deal === 'rent' ? parseAmount(f.rent) : undefined,
    },
  };
}

function AmountField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const n = parseAmount(value);
  return (
    <label className="lbl">
      {label}
      <input className="fld num" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} placeholder="به تومان" style={{ fontSize: 19 }} />
      <span className="hint">{n ? `${formatToman(n)} تومان` : ' '}</span>
    </label>
  );
}

function Section({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="col" style={{ border: 0, margin: 0, padding: 0, gap: 14 }}>
      <legend className="t2" style={{ padding: '0 0 14px' }}>{legend}</legend>
      {children}
    </fieldset>
  );
}

const grid = (min: number) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 14 }) as const;

/** فرم تمام‌صفحهٔ ثبت و ویرایش مشتری. */
function ClientForm({ client, onSaved }: { client?: Client; onSaved: (c: Client, matches: number) => void }) {
  const store = useStore();
  const data = useQuery('client-form', async (s) => ({ clients: await s.listClients(), listings: await s.listListings() }));
  const [f, setF] = useState(() => toState(client));
  const [initial] = useState(() => JSON.stringify(toState(client)));
  const [hood, setHood] = useState('');
  const [error, setError] = useState('');
  const [nameErr, setNameErr] = useState(false);
  const saving = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const stayRef = useRef<HTMLButtonElement>(null);
  const goBack = useGoBack();
  const set = <K extends keyof FormState>(k: K) => (v: FormState[K]) => setF((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(f) !== initial;
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !saving.current && currentLocation.pathname !== nextLocation.pathname);

  useEffect(() => {
    if (blocker.state === 'blocked') stayRef.current?.focus();
  }, [blocker.state]);

  useEffect(() => {
    if (!dirty || window.kelid) return;
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 's' || e.key === 'س')) {
        e.preventDefault();
        formRef.current?.requestSubmit();
      } else if (e.key === 'Escape' && blocker.state === 'blocked') blocker.reset();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [blocker]);

  const phone = normalizePhone(f.phone);
  const duplicate = phone.length >= 7 ? data?.clients.find((c) => c.id !== client?.id && normalizePhone(c.phone) === phone) : undefined;

  // پیشنهاد محله از فایل‌های خود دفتر؛ آنچه انتخاب شده یا با متن تایپ‌شده جور نیست کنار می‌رود.
  const chosen = new Set(f.neighborhoods.map(normalizeForSearch));
  const typed = normalizeForSearch(hood);
  const suggestions = [...new Set((data?.listings ?? []).map((l) => l.neighborhood))]
    .filter((n) => !chosen.has(normalizeForSearch(n)) && (!typed || normalizeForSearch(n).includes(typed)))
    .slice(0, 8);
  const addHood = (name: string) => {
    const v = name.trim();
    if (v && !chosen.has(normalizeForSearch(v))) set('neighborhoods')([...f.neighborhoods, v]);
    setHood('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const input = toClient(f);
    if (typeof input === 'string') {
      setError(input);
      if (input === NAME_MSG) {
        setNameErr(true);
        requestAnimationFrame(() => {
          const el = formRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]');
          el?.focus({ preventScroll: true });
          el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        });
      }
      return;
    }
    setError('');
    saving.current = true;
    try {
      const saved = client ? await store.updateClient(client.id, input) : await store.addClient(input);
      onSaved(saved, bestMatches(data?.listings ?? [], saved.need).length);
    } catch (err) {
      saving.current = false;
      setError(err instanceof Error ? err.message : 'ذخیره نشد؛ دوباره امتحان کنید.');
    }
  };

  const toggleKind = (k: PropertyKind, on: boolean) => set('kinds')(on ? [...f.kinds, k] : f.kinds.filter((x) => x !== k));

  return (
    <div style={{ padding: 8, minHeight: '100vh', display: 'flex', background: 'var(--bg)' }}>
      <form ref={formRef} onSubmit={submit} noValidate className="col" style={{ flex: 1, minWidth: 0, background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 20 }}>
        <header className="top" style={{ position: 'sticky', top: 0, background: 'var(--paper)', borderRadius: '20px 20px 0 0', zIndex: 2 }}>
          {blocker.state === 'blocked' ? (
            <>
              <span role="alert" className="tag warn"><Icon name="warn" size="s" />تغییرات ذخیره نشده‌اند</span>
              <span className="sp" />
              <button ref={stayRef} type="button" className="btn btn-s" onClick={() => blocker.reset()}>ادامهٔ ویرایش</button>
              <button type="button" className="btn btn-d" onClick={() => blocker.proceed()}>بیرون رفتن بدون ذخیره</button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-g" onClick={() => goBack(client ? `/clients?c=${client.id}` : '/clients')} style={{ padding: '0 12px' }}><Icon name="x" size="s" />بستن</button>
              <span className="b" style={{ fontSize: 18 }}>{client ? `ویرایش ${client.name}` : 'مشتری جدید'}</span>
              <span className="sp" />
              {error && <span role="alert" className="tag bad">{error}</span>}
              <button type="submit" className="btn btn-p">{client ? 'ذخیرهٔ تغییرات' : 'ثبت مشتری'}</button>
            </>
          )}
        </header>

        <div className="col enter" style={{ width: '100%', maxWidth: 760, margin: '0 auto', padding: '28px 20px 80px', gap: 36 }}>
          <Section legend="۱. چه کسی است؟">
            <div style={grid(220)}>
              <label className="lbl">
                <span>نام<Req /></span>
                <input
                  className="fld"
                  value={f.name}
                  onChange={(e) => {
                    set('name')(e.target.value);
                    if (nameErr) {
                      setNameErr(false);
                      setError('');
                    }
                  }}
                  placeholder="مثلاً آقای کریمی"
                  aria-required="true"
                  aria-invalid={nameErr}
                  aria-describedby={nameErr ? 'err-name' : undefined}
                />
                <FieldError id="err-name" text={nameErr ? NAME_MSG : undefined} />
              </label>
              <label className="lbl">
                شماره تماس
                <input className="fld num" inputMode="tel" value={f.phone} onChange={(e) => set('phone')(e.target.value)} style={{ direction: 'ltr', textAlign: 'right' }} />
              </label>
            </div>
            {duplicate && (
              <div role="alert" className="rw sm" style={{ gap: 10, flexWrap: 'wrap', padding: '10px 14px', borderRadius: 12, background: 'var(--warn-tint)', color: 'var(--warn)' }}>
                <Icon name="warn" size="s" />
                <span className="sp sb">این شماره برای «{duplicate.name}» ثبت شده است.</span>
                <Link viewTransition className="lnk" to={`/clients?c=${duplicate.id}`}>باز کردن پروندهٔ او</Link>
              </div>
            )}
          </Section>

          <Section legend="۲. دنبال چه می‌گردد؟">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              {(['sale', 'rent', 'full'] as const).map((d) => (
                <button key={d} type="button" aria-pressed={f.deal === d} onClick={() => set('deal')(d)} className={`col ${f.deal === d ? 'sel' : ''}`}
                  style={{ minHeight: 80, borderRadius: 16, border: '1px solid var(--line2)', background: 'var(--paper)', padding: '14px 16px', alignItems: 'flex-start', gap: 8, textAlign: 'right' }}>
                  <span className={`plq s ${d === 'rent' ? 'r' : d === 'full' ? 'f' : ''}`}>{d === 'sale' ? 'خرید' : d === 'rent' ? 'اجاره' : 'رهن'}</span>
                  <span className="b">{dealLabel[d]}</span>
                </button>
              ))}
            </div>
            <span className="sb sm" style={{ color: 'var(--ink2)' }}>نوع ملک <span className="hint">هیچ‌کدام = فرقی ندارد</span></span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
              {KINDS.map((k) => (
                <label key={k.value} className="chk">
                  <input type="checkbox" checked={f.kinds.includes(k.value)} onChange={(e) => toggleKind(k.value, e.target.checked)} />
                  {k.label}
                </label>
              ))}
            </div>
          </Section>

          <Section legend="۳. کجا؟">
            {f.neighborhoods.length > 0 && (
              <div className="rw" style={{ gap: 8, flexWrap: 'wrap' }} aria-label="محله‌های انتخاب‌شده">
                {f.neighborhoods.map((n) => (
                  <span key={n} className="tag ok" style={{ paddingLeft: 4 }}>
                    {n}
                    <button type="button" aria-label={`حذف ${n}`} onClick={() => set('neighborhoods')(f.neighborhoods.filter((x) => x !== n))}
                      style={{ border: 0, background: 'transparent', color: 'inherit', width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 99 }}>
                      <Icon name="x" size="s" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="rw" style={{ gap: 8 }}>
              <input className="fld" value={hood} onChange={(e) => setHood(e.target.value)} placeholder={f.neighborhoods.length ? 'محلهٔ دیگر' : 'محله را بنویسید؛ خالی = فرقی ندارد'} aria-label="افزودن محله"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addHood(hood); } }} style={{ flex: 1 }} />
              <button type="button" className="btn btn-s" onClick={() => addHood(hood)} disabled={!hood.trim()}><Icon name="plus" size="s" />افزودن</button>
            </div>
            {suggestions.length > 0 && (
              <div className="rw" style={{ gap: 6, flexWrap: 'wrap' }}>
                <span className="xs mute">از فایل‌های شما:</span>
                {suggestions.map((n) => (
                  <button key={n} type="button" className="tag" onClick={() => addHood(n)} style={{ border: 0 }}><Icon name="plus" size="s" />{n}</button>
                ))}
              </div>
            )}
          </Section>

          <Section legend="۴. اندازه">
            <div style={grid(140)}>
              <label className="lbl">متراژ از<input className="fld num" inputMode="numeric" value={f.areaMin} onChange={(e) => set('areaMin')(e.target.value)} /></label>
              <label className="lbl">متراژ تا<input className="fld num" inputMode="numeric" value={f.areaMax} onChange={(e) => set('areaMax')(e.target.value)} /></label>
              <label className="lbl">حداقل خواب<input className="fld num" inputMode="numeric" value={f.bedroomsMin} onChange={(e) => set('bedroomsMin')(e.target.value)} /></label>
            </div>
          </Section>

          <Section legend="۵. بودجه">
            {f.deal === 'sale' && <AmountField label="حداکثر قیمت (تومان)" value={f.budget} onChange={set('budget')} />}
            {f.deal === 'rent' && (
              <div style={grid(220)}>
                <AmountField label="حداکثر ودیعه (تومان)" value={f.budget} onChange={set('budget')} />
                <AmountField label="حداکثر اجارهٔ ماهانه (تومان)" value={f.rent} onChange={set('rent')} />
              </div>
            )}
            {f.deal === 'full' && <AmountField label="حداکثر مبلغ رهن (تومان)" value={f.budget} onChange={set('budget')} />}
          </Section>

          <Section legend="۶. پیگیری">
            <div className="rw" style={{ gap: 12, flexWrap: 'wrap' }}>
              <span className="sb sm" style={{ color: 'var(--ink2)' }}>چقدر جدی است؟</span>
              <Segmented<ClientTemperature> label="جدیت مشتری" value={f.temperature} onChange={set('temperature')} options={TEMPS} />
            </div>
            <div className="rw" style={{ gap: 12 }}>
              <Switch checked={f.waiting} onChange={set('waiting')} label="منتظر خبر از شماست" />
              <span className="sm">منتظر خبر از شماست <span className="hint">بالای فهرست مشتری‌ها می‌آید</span></span>
            </div>
            <label className="lbl">
              یادداشت <span className="hint">فقط برای دفتر</span>
              <textarea className="fld" rows={3} value={f.notes} onChange={(e) => set('notes')(e.target.value)} style={{ lineHeight: 1.9 }} />
            </label>
          </Section>
        </div>
      </form>
    </div>
  );
}

export function NewClientPage() {
  const navigate = useNavigate();
  const toast = useToast();
  return (
    <ClientForm
      onSaved={(c, matches) => {
        navigate(`/clients?c=${c.id}`, { replace: true, viewTransition: true });
        toast(matches ? `${c.name} ثبت شد · ${toFaDigits(matches)} فایل مناسب پیدا شد` : `${c.name} ثبت شد`);
      }}
    />
  );
}

export function EditClientPage() {
  const { id = '' } = useParams();
  const goBack = useGoBack();
  const toast = useToast();
  const data = useQuery(`client-edit:${id}`, async (s) => ({ c: await s.getClient(id) }));
  if (!data) return <PageSkeleton />;
  if (!data.c) {
    return (
      <div className="bd" style={{ paddingTop: 40 }}>
        <h1 className="t1">این مشتری پیدا نشد</h1>
        <Link viewTransition className="lnk" to="/clients">بازگشت به مشتری‌ها</Link>
      </div>
    );
  }
  return (
    <ClientForm
      key={data.c.id}
      client={data.c}
      onSaved={(c) => {
        // ویرایش از پروندهٔ همین مشتری باز می‌شود؛ برگشت به همان.
        goBack(`/clients?c=${c.id}`);
        toast(`تغییرات ${c.name} ذخیره شد`);
      }}
    />
  );
}
