import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useBlocker } from 'react-router';
import { useGoBack } from '../layout/useGoBack';
import { LeaveDialog } from '../layout/LeaveDialog';
import { amountText, FieldError, onlyAmount, onlyDigits, Req } from '../layout/Field';
import { useMember } from '../auth/AuthContext';
import { PlaceFields } from '../places/PlaceFields';
import { CheckBox, Cover, Icon, Segmented, type IconName } from '@kelid/ui';
import { dealLabel, hasBedrooms, formatToman, toEnDigits, type DealType, type Listing, type ListingDraft, type ListingStatus, type NewListing, type PropertyKind, VOICE_FEATURES } from '@kelid/core';
import { VoiceFill } from '../voice/VoiceFill';

/** همهٔ فیلدهای فرم؛ کاور و تعداد عکس جدا مدیریت می‌شوند. */
export type ListingFields = Omit<NewListing, 'cover' | 'photoCount'>;

// همان فهرستی که پر کردن با صدا می‌شناسد، تا امکان گفته‌شده همین‌جا تیک بخورد.
const FEATURES = VOICE_FEATURES;

/** نوع معامله با نشانهٔ خودش؛ رنگ هر کارت همان رنگ پلاک است. */
const DEALS: Array<{ value: DealType; cls: string; icon: IconName; hint: string }> = [
  { value: 'sale', cls: '', icon: 'dealSale', hint: 'انتقال سند به خریدار' },
  { value: 'rent', cls: 'r', icon: 'dealRent', hint: 'ودیعه و اجارهٔ ماهانه' },
  { value: 'full', cls: 'f', icon: 'dealFull', hint: 'فقط ودیعه، بی اجاره' },
];

const KINDS: Array<{ value: PropertyKind; label: string }> = [
  { value: 'apartment', label: 'آپارتمان' },
  { value: 'villa', label: 'ویلایی' },
  { value: 'shop', label: 'مغازه' },
  { value: 'office', label: 'دفتر کار' },
  { value: 'land', label: 'زمین' },
];

/** وضعیت‌هایی که مشاور دستی عوض می‌کند؛ «بایگانی» دکمهٔ جدا دارد. */
export function statusOptions(deal: DealType, current?: ListingStatus): Array<{ value: ListingStatus; label: string }> {
  return [
    { value: 'active', label: 'موجود' },
    { value: 'reserved', label: 'رزرو' },
    ...(current === 'negotiating' ? [{ value: 'negotiating' as const, label: 'در مذاکره' }] : []),
    { value: 'closed', label: deal === 'sale' ? 'فروخته شد' : 'اجاره رفت' },
  ];
}

/** «۲۸٬۰۰۰٬۰۰۰٬۰۰۰» یا «28000000000» → عدد */
function parseAmount(s: string): number | undefined {
  const n = Number(toEnDigits(s).replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseNum(s: string): number | undefined {
  const digits = toEnDigits(s).replace(/[^\d]/g, '');
  return digits ? Number(digits) : undefined;
}

const numText = (n?: number) => (n === undefined ? '' : String(n));

type FormState = {
  deal: DealType; kind: PropertyKind; status: ListingStatus;
  neighborhood: string; street: string; address: string;
  area: string; bedrooms: string; floor: string; floorsTotal: string; yearBuilt: string;
  features: string[]; total: string; deposit: string; rent: string; negotiable: boolean;
  description: string; ownerName: string; ownerPhone: string; ownerBestTime: string;
};

function toState(l?: Listing): FormState {
  return {
    deal: l?.deal ?? 'sale', kind: l?.kind ?? 'apartment', status: l?.status ?? 'active',
    neighborhood: l?.neighborhood ?? '', street: l?.street ?? '', address: l?.address ?? '',
    area: numText(l?.area), bedrooms: numText(l?.bedrooms), floor: numText(l?.floor), floorsTotal: numText(l?.floorsTotal), yearBuilt: numText(l?.yearBuilt),
    features: l?.features ?? [],
    total: amountText(l?.price.total), deposit: amountText(l?.price.deposit), rent: amountText(l?.price.monthlyRent), negotiable: l?.negotiable ?? false,
    description: l?.description ?? '', ownerName: l?.owner.name === '—' ? '' : l?.owner.name ?? '', ownerPhone: l?.owner.phone ?? '', ownerBestTime: l?.owner.bestTime ?? '',
  };
}

/** فقط آنچه در صحبت آمده روی فرم می‌نشیند؛ توضیح تازه به توضیح قبلی اضافه می‌شود. */
function withDraft(f: FormState, d: ListingDraft): FormState {
  const n = { ...f };
  if (d.deal) n.deal = d.deal;
  if (d.kind) n.kind = d.kind;
  for (const k of ['neighborhood', 'street', 'address', 'ownerName', 'ownerBestTime'] as const) if (d[k]) n[k] = d[k];
  for (const k of ['area', 'bedrooms', 'floor', 'floorsTotal', 'yearBuilt'] as const) if (d[k] !== undefined) n[k] = numText(d[k]);
  // فهرست امکانات فقط همان امکانات ثابت فرم است؛ امکانی که در صحبت آمد و در فهرست نیست به توضیحات می‌رود.
  const extra: string[] = [];
  for (const x of d.features ?? []) {
    if (!FEATURES.includes(x)) extra.push(x);
    else if (!n.features.includes(x)) n.features = [...n.features, x];
  }
  if (d.total) n.total = amountText(d.total);
  if (d.deposit) n.deposit = amountText(d.deposit);
  // فقط رهن گفته شد و فرم روی فروش بود: رهن کامل است، وگرنه مبلغ در فرم دیده نمی‌شود.
  if (!d.deal && d.deposit && !d.rent && n.deal === 'sale') n.deal = 'full';
  if (d.rent) n.rent = amountText(d.rent);
  if (d.negotiable !== undefined) n.negotiable = d.negotiable;
  if (d.ownerPhone) n.ownerPhone = toEnDigits(d.ownerPhone);
  const more = [d.description, extra.length ? `امکانات دیگر: ${extra.join('، ')}` : ''].filter((x): x is string => !!x && !f.description.includes(x));
  if (more.length) n.description = [f.description.trim(), ...more].filter(Boolean).join('\n');
  return n;
}

type Required = 'neighborhood' | 'area';
const REQ_MSG = 'فیلدهای ستاره‌دار را پر کنید.';

/** فیلدهای ضروری که خالی مانده‌اند، با پیامی که می‌گوید چه بنویسند. */
function missing(f: FormState): Partial<Record<Required, string>> {
  const out: Partial<Record<Required, string>> = {};
  if (!f.neighborhood.trim()) out.neighborhood = 'محلهٔ ملک را بنویسید.';
  if (!parseNum(f.area)) out.area = 'متراژ را بنویسید.';
  return out;
}

function toFields(f: FormState): ListingFields | string {
  const area = parseNum(f.area);
  if (!f.neighborhood.trim() || !area) return 'محله و متراژ را بنویسید.';
  // کلیدهای undefined عمداً نوشته می‌شوند تا با عوض شدن نوع معامله، قیمت قبلی پاک شود.
  const price: Listing['price'] =
    f.deal === 'sale' ? { total: parseAmount(f.total), deposit: undefined, monthlyRent: undefined }
    : f.deal === 'rent' ? { total: undefined, deposit: parseAmount(f.deposit), monthlyRent: parseAmount(f.rent) }
    : { total: undefined, deposit: parseAmount(f.deposit), monthlyRent: undefined };
  return {
    deal: f.deal, kind: f.kind, status: f.status,
    neighborhood: f.neighborhood.trim(), street: f.street.trim(), address: f.address.trim() || undefined,
    area, bedrooms: parseNum(f.bedrooms) ?? 0, floor: parseNum(f.floor), floorsTotal: parseNum(f.floorsTotal), yearBuilt: parseNum(f.yearBuilt),
    features: f.features, price, negotiable: f.negotiable, description: f.description.trim() || undefined,
    owner: { name: f.ownerName.trim() || '—', phone: toEnDigits(f.ownerPhone).trim(), bestTime: f.ownerBestTime.trim() || undefined },
  };
}

/** فقط چیزهایی که کاربر در همین فرم عوض کرده؛ تا تغییر هم‌زمان (مثلاً وضعیت از صفحهٔ فایل) با دادهٔ کهنهٔ فرم برنگردد. */
function editedFields(start: ListingFields | string, next: ListingFields): Partial<ListingFields> {
  if (typeof start === 'string') return next;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(next) as Array<keyof ListingFields>) {
    if (JSON.stringify(start[k]) !== JSON.stringify(next[k])) out[k] = next[k];
  }
  return out as Partial<ListingFields>;
}

function AmountField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const n = parseAmount(value);
  return (
    <label className="lbl">
      {label}
      <input className="fld num" inputMode="numeric" value={value} onChange={(e) => onChange(onlyAmount(e.target.value))} placeholder="به تومان" style={{ fontSize: 19 }} />
      <span className="hint">{n ? `${formatToman(n)} تومان` : ' '}</span>
    </label>
  );
}

function Section({ legend, children, boxed }: { legend: string; children: ReactNode; boxed?: boolean }) {
  return (
    <fieldset className="col" style={boxed ? { margin: 0, padding: 18, gap: 14, borderRadius: 18, background: 'var(--paper2)', border: '1px solid var(--line)' } : { border: 0, margin: 0, padding: 0, gap: 14 }}>
      <legend className="t2" style={{ padding: boxed ? '0 6px' : '0 0 14px' }}>{legend}</legend>
      {children}
    </fieldset>
  );
}

const grid = (min: number) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 14 }) as const;

/**
 * فرم مشترک ثبت و ویرایش فایل. اگر چیزی عوض شده و کاربر بی‌ذخیره بیرون برود، یک بار می‌پرسد.
 */
export function ListingForm({ listing, title, submitLabel, cancelTo, showStatus, photoNote, onSubmit }: {
  listing?: Listing; title: string; submitLabel: string; cancelTo: string; showStatus?: boolean; photoNote?: boolean;
  /** `edited` فقط فیلدهای عوض‌شده نسبت به فایلی است که فرم با آن باز شد؛ ویرایش باید همین را بفرستد. */
  onSubmit: (fields: ListingFields, edited: Partial<ListingFields>) => Promise<void>;
}) {
  const [f, setF] = useState(() => toState(listing));
  // مشاورِ بی‌اجازه شمارهٔ مالکِ فایل ثبت‌شده را ندارد که ببیند یا عوض کند؛ در فایل تازه می‌نویسدش.
  const { ownerPhones } = useMember();
  const phoneLocked = !ownerPhones && !!listing;
  const [start] = useState(() => toFields(toState(listing)));
  const [initial] = useState(() => JSON.stringify(toState(listing)));
  const [error, setError] = useState('');
  const [errs, setErrs] = useState<Partial<Record<Required, string>>>({});
  // همهٔ فیلدهای ضروری که پر شد، پیام پایین فرم هم می‌رود
  useEffect(() => {
    if (!Object.keys(errs).length) setError((x) => (x === REQ_MSG ? '' : x));
  }, [errs]);
  const [custom, setCustom] = useState('');
  const saving = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const goBack = useGoBack();
  const set = <K extends keyof FormState>(k: K) => (v: FormState[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    // با نوشتن در فیلد، پیام خطای همان فیلد می‌رود
    if (k in errs) setErrs((e) => { const n = { ...e }; delete n[k as Required]; return n; });
  };
  const dirty = JSON.stringify(f) !== initial;

  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !saving.current && currentLocation.pathname !== nextLocation.pathname);

  // بستن یا تازه کردن تب در وب؛ در ویندوز پنجره بی‌صدا بسته نمی‌شود، پس آنجا لازم نیست.
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

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    // دوبار کلیک یا نگه داشتن Ctrl+S نباید دو فایل بسازد
    if (saving.current) return;
    const miss = missing(f);
    if (Object.keys(miss).length) {
      setErrs(miss);
      setError(REQ_MSG);
      // اولین فیلد خالی دیده و آمادهٔ نوشتن شود
      requestAnimationFrame(() => {
        const el = formRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]');
        el?.focus({ preventScroll: true });
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
      return;
    }
    const fields = toFields(f);
    if (typeof fields === 'string') {
      setError(fields);
      return;
    }
    setError('');
    saving.current = true;
    try {
      await onSubmit(fields, editedFields(start, fields));
    } catch (err) {
      saving.current = false;
      setError(err instanceof Error ? err.message : 'ذخیره نشد؛ دوباره امتحان کنید.');
    }
  };

  const allFeatures = [...FEATURES, ...f.features.filter((x) => !FEATURES.includes(x))];
  const addCustom = () => {
    const v = custom.trim();
    if (v && !f.features.includes(v)) set('features')([...f.features, v]);
    setCustom('');
  };

  return (
    <div style={{ padding: 8, minHeight: '100vh', display: 'flex', background: 'var(--bg)' }}>
      <form ref={formRef} onSubmit={submit} noValidate className="col" style={{ flex: 1, minWidth: 0, background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 20 }}>
        <header className="top" style={{ position: 'sticky', top: 0, background: 'var(--paper)', borderRadius: '20px 20px 0 0', zIndex: 2 }}>
          <button type="button" className="btn btn-g" onClick={() => goBack(cancelTo)} style={{ padding: '0 12px' }}><Icon name="x" size="s" />بستن</button>
          <span className="b" style={{ fontSize: 18 }}>{title}</span>
        </header>
        {blocker.state === 'blocked' && <LeaveDialog onStay={() => blocker.reset()} onLeave={() => blocker.proceed()} />}

        <div className="col enter" style={{ width: '100%', maxWidth: 760, margin: '0 auto', padding: '28px 20px 40px', gap: 36, flex: 1 }}>
          {!listing && (
            <VoiceFill
              form="listing"
              onDraft={(d) => {
                let before: FormState | null = null;
                setF((x) => ((before = x), withDraft(x, d)));
                setErrs((e) => {
                  const n = { ...e };
                  if (d.neighborhood) delete n.neighborhood;
                  if (d.area) delete n.area;
                  return n;
                });
                return () => before && setF(before);
              }}
            />
          )}
          <Section legend="۱. این ملک برای چیست؟">
            <div className="dealpick">
              {DEALS.map((d) => (
                <button key={d.value} type="button" aria-pressed={f.deal === d.value} onClick={() => set('deal')(d.value)} className={`dealopt ${d.cls}`}>
                  <span className="dealopt-ic"><Icon name={d.icon} size="l" /></span>
                  <span className="col" style={{ gap: 2, minWidth: 0 }}>
                    <span className="b" style={{ fontSize: 16 }}>{dealLabel[d.value]}</span>
                    <span className="xs mute">{d.hint}</span>
                  </span>
                  {f.deal === d.value && <span className="dealopt-ok pop-in" aria-hidden="true"><Icon name="check" size="s" thick /></span>}
                </button>
              ))}
            </div>
            <div className="rw" style={{ gap: 12, flexWrap: 'wrap' }}>
              <span className="sb sm" style={{ color: 'var(--ink2)' }}>نوع ملک</span>
              <Segmented<PropertyKind> label="نوع ملک" value={f.kind} onChange={set('kind')} options={KINDS} />
            </div>
            {showStatus && (
              <div className="rw" style={{ gap: 12, flexWrap: 'wrap' }}>
                <span className="sb sm" style={{ color: 'var(--ink2)' }}>وضعیت</span>
                <Segmented<ListingStatus> label="وضعیت فایل" value={f.status} onChange={set('status')} options={statusOptions(f.deal, listing?.status)} />
              </div>
            )}
          </Section>

          <Section legend="۲. کجاست؟">
            <PlaceFields hood={f.neighborhood} street={f.street} onHood={set('neighborhood')} onStreet={set('street')} hoodError={errs.neighborhood} />
            <label className="lbl">نشانی کامل <span className="hint">فقط برای دفتر؛ به مشتری نشان داده نمی‌شود</span><input className="fld" value={f.address} onChange={(e) => set('address')(e.target.value)} /></label>
          </Section>

          <Section legend="۳. مشخصات">
            <div style={grid(120)}>
              <label className="lbl">
                <span>متراژ<Req /></span>
                <input className="fld num" inputMode="numeric" value={f.area} onChange={(e) => set('area')(onlyDigits(e.target.value, 6))} aria-required="true" aria-invalid={!!errs.area} aria-describedby={errs.area ? 'err-area' : undefined} />
                <FieldError id="err-area" text={errs.area} />
              </label>
              {hasBedrooms(f) && <label className="lbl">خواب<input className="fld num" inputMode="numeric" value={f.bedrooms} onChange={(e) => set('bedrooms')(onlyDigits(e.target.value, 2))} /></label>}
              <label className="lbl">طبقه<input className="fld num" inputMode="numeric" value={f.floor} onChange={(e) => set('floor')(onlyDigits(e.target.value, 3))} /></label>
              <label className="lbl">تعداد طبقات<input className="fld num" inputMode="numeric" value={f.floorsTotal} onChange={(e) => set('floorsTotal')(onlyDigits(e.target.value, 3))} /></label>
              <label className="lbl">سال ساخت<input className="fld num" inputMode="numeric" value={f.yearBuilt} onChange={(e) => set('yearBuilt')(onlyDigits(e.target.value, 4))} placeholder="1403" /></label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 }}>
              {allFeatures.map((x) => (
                <label key={x} className="chk">
                  <CheckBox size={22} label={x} checked={f.features.includes(x)} onChange={(on) => set('features')(on ? [...f.features, x] : f.features.filter((y) => y !== x))} />
                  {x}
                </label>
              ))}
            </div>
            <div className="rw" style={{ gap: 8 }}>
              <input className="fld" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="امکان دیگر، مثلاً شومینه" aria-label="افزودن امکان دیگر"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }} style={{ flex: 1 }} />
              <button type="button" className="btn btn-s" onClick={addCustom} disabled={!custom.trim()}><Icon name="plus" size="s" />افزودن</button>
            </div>
          </Section>

          <Section legend="۴. قیمت">
            {f.deal === 'sale' && <AmountField label="قیمت کل (تومان)" value={f.total} onChange={set('total')} />}
            {f.deal === 'rent' && (
              <div style={grid(220)}>
                <AmountField label="ودیعه (تومان)" value={f.deposit} onChange={set('deposit')} />
                <AmountField label="اجارهٔ ماهانه (تومان)" value={f.rent} onChange={set('rent')} />
              </div>
            )}
            {f.deal === 'full' && <AmountField label="مبلغ رهن کامل (تومان)" value={f.deposit} onChange={set('deposit')} />}
            <label className="chk" style={{ alignSelf: 'flex-start' }}>
              <CheckBox size={22} label="قیمت قابل مذاکره است" checked={f.negotiable} onChange={set('negotiable')} />
              قیمت قابل مذاکره است
            </label>
          </Section>

          <Section legend="۵. توضیحات">
            <label className="lbl">
              دربارهٔ این ملک <span className="hint">نورگیری، وضعیت ساختمان، دسترسی‌ها</span>
              <textarea className="fld" rows={4} value={f.description} onChange={(e) => set('description')(e.target.value)} style={{ lineHeight: 1.9 }} />
            </label>
          </Section>

          <Section legend="۶. مالک" boxed>
            <span className="xs rw" style={{ gap: 6, color: 'var(--brass-text)' }}><Icon name="lock" size="s" />در حالت نمایش و برگهٔ چاپی دیده نمی‌شود</span>
            <div style={grid(200)}>
              <label className="lbl">نام مالک<input className="fld" value={f.ownerName} onChange={(e) => set('ownerName')(e.target.value)} /></label>
              {phoneLocked ? (
                <label className="lbl">
                  شمارهٔ مالک
                  <input className="fld" value="" readOnly placeholder="فقط مدیر دفتر می‌بیند" aria-describedby="phone-locked" />
                  <span id="phone-locked" className="xs mute">شماره روی سرور دفتر محفوظ است و با ویرایش شما عوض نمی‌شود.</span>
                </label>
              ) : (
                <label className="lbl">
                  شمارهٔ مالک
                  <input className="fld num" inputMode="tel" value={f.ownerPhone} onChange={(e) => set('ownerPhone')(onlyDigits(e.target.value))} style={{ direction: 'ltr', textAlign: 'right' }} aria-describedby={ownerPhones ? undefined : 'phone-hidden'} />
                  {!ownerPhones && <span id="phone-hidden" className="xs mute">بعد از ثبت، شماره فقط برای مدیر دفتر دیده می‌شود.</span>}
                </label>
              )}
              <label className="lbl">بهترین زمان تماس<input className="fld" value={f.ownerBestTime} onChange={(e) => set('ownerBestTime')(e.target.value)} placeholder="مثلاً عصرها" /></label>
            </div>
          </Section>

          {photoNote && (
            <div className="rw sm mute" style={{ gap: 10 }}>
              <Cover variant="f" style={{ width: 64, height: 48, borderRadius: 10, flex: 'none' }} />
              بعد از ثبت، عکس‌ها را در صفحهٔ همین فایل اضافه کنید (با گوشی یا از روی کامپیوتر).
            </div>
          )}
        </div>

        {/* دکمهٔ ثبت همیشه پایین فرم و زیر دست است، همان‌جا که چشم بعد از پر کردن فرم می‌رسد. */}
        <footer className="lf-foot">
          <div className="lf-foot-in">
            {error ? <span role="alert" className="tag bad">{error}</span> : <span className="xs mute lf-kbd"><span className="req" style={{ marginInlineStart: 0 }}>*</span> ضروری · ذخیرهٔ سریع: Ctrl+S</span>}
            <span className="sp" />
            <button type="submit" className="btn btn-p btn-lg lf-save"><Icon name="check" size="s" thick />{submitLabel}</button>
          </div>
        </footer>
      </form>
    </div>
  );
}
