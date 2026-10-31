import { useState, type FormEvent, type ReactNode } from 'react';
import { Icon, Skeleton, Switch } from '@kelid/ui';
import { bestTerm, formatGrouped, perMonthOf, priceOf, toFaDigits, type Plan, type Term } from '@kelid/core';
import type { AdminApi, AdminCatalog, CatalogKind, PlanInput, TermInput } from '../api';
import { useAuth } from '../auth';
import { Dialog, errorText, toman, useCatalog, useSlow, useToast } from '../ui';

type Editing = { kind: 'plan'; item: Plan | null } | { kind: 'term'; item: Term | null } | null;

/**
 * پلن‌ها و مدت‌های خرید؛ همان که دفترها در صفحهٔ خرید برنامه و کارت‌های قیمت سایت می‌بینند.
 * حذف بی‌پرسش است و با «برگرداندن» برمی‌گردد؛ دفترهایی که پلن حذف‌شده را دارند تا پایان اعتبار نگهش می‌دارند.
 */
export function Plans() {
  const { call } = useAuth();
  const toast = useToast();
  const cat = useCatalog();
  const slow = useSlow(!cat.data && cat.pending);
  const [editing, setEditing] = useState<Editing>(null);
  const plans = cat.data?.plans.filter((p) => !p.deleted) ?? [];
  const terms = cat.data?.terms.filter((t) => !t.deleted) ?? [];

  const run = async (fn: (a: AdminApi, t: string) => Promise<AdminCatalog>) => {
    try {
      cat.set(await call(fn));
      return true;
    } catch (e) {
      toast(errorText(e), { bad: true });
      return false;
    }
  };
  const remove = async (kind: CatalogKind, id: string, name: string) => {
    if (await run((a, t) => a.setDeleted(t, kind, id, true)))
      toast(`«${name}» حذف شد.`, { action: { label: 'برگرداندن', run: () => void run((a, t) => a.setDeleted(t, kind, id, false)) } });
  };
  const move = (kind: CatalogKind, list: Array<{ id: string }>, i: number, d: number) => {
    const ids = list.map((x) => x.id);
    [ids[i], ids[i + d]] = [ids[i + d]!, ids[i]!];
    void run((a, t) => a.order(t, kind, ids));
  };

  return (
    <>
      <header className="hd">
        <div className="col ad-hd-main" style={{ gap: 4 }}>
          <span className="eb">پنل فروشنده</span>
          <h1 className="t1">پلن‌ها و قیمت‌ها</h1>
          <span className="mute sm ad-sub">
            همان چیزی که دفترها در صفحهٔ خرید برنامه و سایت کلید می‌بینند؛ هر تغییر همان لحظه اعمال می‌شود. پرداخت‌های نیمه‌کاره با مبلغ قبلی تمام می‌شوند.
          </span>
        </div>
        <div className="rw ad-acts">
          <button type="button" className="btn btn-s" onClick={() => setEditing({ kind: 'term', item: null })}>
            <Icon name="cal" size="s" />
            مدت تازه
          </button>
          <button type="button" className="btn btn-p" onClick={() => setEditing({ kind: 'plan', item: null })}>
            <Icon name="plus" size="s" />
            پلن تازه
          </button>
        </div>
      </header>

      <div className="bd">
        {cat.error && !cat.data ? (
          <div className="card ad-empty">
            <Icon name="warn" size="l" />
            <span>{errorText(cat.error)}</span>
            <button type="button" className="btn btn-s" onClick={cat.reload}>
              دوباره امتحان کنید
            </button>
          </div>
        ) : !cat.data ? (
          slow && (
            <div className="ad-pcs" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="card ad-pc">
                  <Skeleton w="50%" h={22} />
                  <Skeleton w="70%" h={16} />
                  <Skeleton w="60%" h={30} />
                  <Skeleton w="80%" h={60} />
                </div>
              ))}
            </div>
          )
        ) : (
          <>
            <section className="col" style={{ gap: 12 }} aria-labelledby="pl-h">
              <h2 id="pl-h" className="t2">
                پلن‌ها
              </h2>
              <div className="ad-pcs stagger">
                {plans.map((p, i) => (
                  <article key={p.id} className={`card ad-pc${p.hidden ? ' ad-pc-off' : ''}`}>
                    <div className="rw" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <h3 className="t2 sp">{p.name}</h3>
                      {p.badge && <span className="tag ok">{p.badge}</span>}
                      {p.hidden && <span className="tag">پنهان</span>}
                    </div>
                    {p.blurb && <p className="sm mute ad-pc-blurb">{toFaDigits(p.blurb)}</p>}
                    <p className="ad-pc-price">
                      <b className="num">{formatGrouped(p.monthly)}</b> <span className="sm mute">تومان در ماه</span>
                    </p>
                    <p className="sm ad-pc-seats">
                      <Icon name={p.seats > 1 ? 'users' : 'user'} size="s" />
                      {p.seats > 1 ? `تا ${toFaDigits(p.seats)} نفر` : 'یک نفر'}
                      {p.extra && `؛ هر نفر بیشتر ماهی ${formatGrouped(p.extra.monthly)}، تا ${toFaDigits(p.extra.max)} نفر`}
                    </p>
                    {p.features.length > 0 && (
                      <ul className="ad-pc-feats sm">
                        {p.features.map((f, k) => (
                          <li key={k}>
                            <Icon name="check" size="s" />
                            {toFaDigits(f)}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="xs mute ad-pc-n">{cat.data!.offices[p.id] ? `${toFaDigits(cat.data!.offices[p.id]!)} دفتر روی این پلن` : 'هنوز دفتری روی این پلن نیست'}</p>
                    <div className="rw ad-pc-ft">
                      <Order kind="plans" list={plans} i={i} move={move} name={p.name} />
                      <button type="button" className="ib ghost" aria-label={`حذف پلن ${p.name}`} onClick={() => void remove('plans', p.id, p.name)}>
                        <Icon name="x" size="s" />
                      </button>
                      <button type="button" className="btn btn-s ad-pc-edit" onClick={() => setEditing({ kind: 'plan', item: p })}>
                        <Icon name="edit" size="s" />
                        ویرایش
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="col" style={{ gap: 12, marginTop: 28 }} aria-labelledby="tm-h">
              <div className="col" style={{ gap: 2 }}>
                <h2 id="tm-h" className="t2">
                  مدت‌های خرید
                </h2>
                <span className="sm mute">قیمت هر مدت از قیمت ماهانهٔ پلن حساب می‌شود: ماه‌های پولی با تخفیف، به اضافهٔ ماه‌های هدیه.</span>
              </div>
              <div className="card ad-table">
                {terms.map((t, i) => (
                  <div key={t.id} className={`ad-row ad-trow${t.hidden ? ' ad-pc-off' : ''}`}>
                    <span className="rw" style={{ gap: 8 }}>
                      <b>{t.name}</b>
                      {t.hidden && <span className="tag">پنهان</span>}
                    </span>
                    <span className="sm">
                      {toFaDigits(t.months)} ماه{t.gift ? ` + ${toFaDigits(t.gift)} ماه هدیه` : ''}
                    </span>
                    <span className="sm">{t.off ? `${toFaDigits(t.off)}٪ تخفیف` : 'بی تخفیف'}</span>
                    <span className="rw" style={{ gap: 4, justifyContent: 'flex-end' }}>
                      <Order kind="terms" list={terms} i={i} move={move} name={t.name} />
                      <button type="button" className="ib ghost" aria-label={`حذف مدت ${t.name}`} onClick={() => void remove('terms', t.id, t.name)}>
                        <Icon name="x" size="s" />
                      </button>
                      <button type="button" className="btn btn-s" onClick={() => setEditing({ kind: 'term', item: t })}>
                        <Icon name="edit" size="s" />
                        ویرایش
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <PriceTable plans={plans.filter((p) => !p.hidden)} terms={terms.filter((t) => !t.hidden)} />
          </>
        )}
      </div>

      {editing?.kind === 'plan' && (
        <PlanDialog
          plan={editing.item}
          terms={terms.filter((t) => !t.hidden)}
          onClose={() => setEditing(null)}
          onSave={(b) => run((a, t) => a.savePlan(t, editing.item?.id ?? null, b))}
        />
      )}
      {editing?.kind === 'term' && (
        <TermDialog
          term={editing.item}
          plan={plans.find((p) => p.badge && !p.hidden) ?? plans.find((p) => !p.hidden)}
          onClose={() => setEditing(null)}
          onSave={(b) => run((a, t) => a.saveTerm(t, editing.item?.id ?? null, b))}
        />
      )}
    </>
  );
}

function Order({ kind, list, i, move, name }: { kind: CatalogKind; list: Array<{ id: string }>; i: number; move: (k: CatalogKind, l: Array<{ id: string }>, i: number, d: number) => void; name: string }) {
  return (
    <>
      <button type="button" className="ib ghost" aria-label={`${name} یکی جلوتر`} disabled={i === 0} onClick={() => move(kind, list, i, -1)}>
        <Icon name="down" size="s" className="ad-flip" />
      </button>
      <button type="button" className="ib ghost" aria-label={`${name} یکی عقب‌تر`} disabled={i === list.length - 1} onClick={() => move(kind, list, i, 1)}>
        <Icon name="down" size="s" />
      </button>
    </>
  );
}

/** قیمت هر پلن در هر مدت، همان عددی که دفتر پیش از پرداخت می‌بیند. */
function PriceTable({ plans, terms }: { plans: Plan[]; terms: Term[] }) {
  if (!plans.length || !terms.length) return null;
  return (
    <section className="col" style={{ gap: 12, marginTop: 28 }} aria-labelledby="pt-h">
      <div className="col" style={{ gap: 2 }}>
        <h2 id="pt-h" className="t2">
          قیمت‌ها در صفحهٔ خرید
        </h2>
        <span className="sm mute">مبلغ یک‌جای هر خرید؛ زیرش هزینهٔ هر ماه. پلن‌ها و مدت‌های پنهان این‌جا نیستند.</span>
      </div>
      <div className="card ad-ptable-wrap">
        <table className="ad-ptable">
          <thead>
            <tr>
              <th scope="col">پلن</th>
              {terms.map((t) => (
                <th key={t.id} scope="col">
                  {t.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id}>
                <th scope="row">{p.name}</th>
                {terms.map((t) => (
                  <td key={t.id}>
                    <span className="num b">{formatGrouped(priceOf(p, t))}</span>
                    <span className="xs mute">ماهی {formatGrouped(perMonthOf(p, t))}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** عدد از کادر: رقم فارسی هم پذیرفته می‌شود، بقیه دور ریخته. */
const digits = (v: string, max = 12) =>
  v
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, '')
    .slice(0, max);

function Num({ label, value, onChange, hint, max, autoFocus }: { label: string; value: string; onChange: (v: string) => void; hint?: ReactNode; max?: number; autoFocus?: boolean }) {
  return (
    <label className="lbl">
      {label}
      <input className="fld num" inputMode="numeric" value={value} onChange={(e) => onChange(digits(e.target.value, max))} data-autofocus={autoFocus || undefined} />
      {hint && <span className="xs mute ad-hint">{hint}</span>}
    </label>
  );
}

function Foot({ error, busy, onClose, label }: { error: string; busy: boolean; onClose: () => void; label: string }) {
  return (
    <>
      {error && (
        <p className="ad-note bad" role="alert">
          <Icon name="warn" size="s" />
          {error}
        </p>
      )}
      <div className="ad-dlg-ft">
        <button type="button" className="btn btn-g" onClick={onClose}>
          انصراف
        </button>
        <button type="submit" className="btn btn-p" disabled={busy}>
          {busy ? 'لحظه‌ای صبر کنید…' : label}
        </button>
      </div>
    </>
  );
}

function PlanDialog({ plan, terms, onClose, onSave }: { plan: Plan | null; terms: Term[]; onClose: () => void; onSave: (b: PlanInput) => Promise<boolean> }) {
  const [name, setName] = useState(plan?.name ?? '');
  const [blurb, setBlurb] = useState(plan?.blurb ?? '');
  const [seats, setSeats] = useState(String(plan?.seats ?? 1));
  const [monthly, setMonthly] = useState(plan ? String(plan.monthly) : '');
  const [extra, setExtra] = useState(!!plan?.extra);
  const [extraMonthly, setExtraMonthly] = useState(String(plan?.extra?.monthly ?? ''));
  const [extraMax, setExtraMax] = useState(String(plan?.extra?.max ?? ''));
  const [features, setFeatures] = useState(plan?.features.join('\n') ?? '');
  const [badge, setBadge] = useState(plan?.badge ?? '');
  const [shown, setShown] = useState(!plan?.hidden);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const n = Number(seats);
  const price = Number(monthly);
  const ex = extra ? { monthly: Number(extraMonthly || 0), max: Number(extraMax) } : null;
  const draft: Plan | null = name.trim() && n >= 1 && price >= 1000 ? { id: 'x', name, blurb, seats: n, monthly: price, features: [], ...(ex ? { extra: ex } : {}) } : null;
  const best = bestTerm(terms);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!name.trim()) return setError('نام پلن را بنویسید.');
    if (!(n >= 1 && n <= 500)) return setError('تعداد نفرات باید بین ۱ و ۵۰۰ باشد.');
    if (!(price >= 1000)) return setError('قیمت ماهانه را به تومان بنویسید (دست‌کم ۱٬۰۰۰).');
    if (ex && !(ex.max > n && ex.max <= 500)) return setError('سقف نفرات باید بیشتر از نفرات پایه و حداکثر ۵۰۰ باشد.');
    const list = features
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean);
    if (list.length > 10) return setError('حداکثر ۱۰ خط ویژگی.');
    setBusy(true);
    setError('');
    if (await onSave({ name: name.trim(), blurb: blurb.trim(), seats: n, monthly: price, extra: ex, features: list, badge: badge.trim() || null, hidden: !shown })) onClose();
    else setBusy(false);
  };

  return (
    <Dialog title={plan ? `ویرایش پلن «${plan.name}»` : 'پلن تازه'} onClose={onClose} wide>
      <form className="ad-dlg-bd" onSubmit={submit}>
        <div className="ad-grid2">
          <label className="lbl">
            نام پلن
            <input className="fld" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="مثلاً «دفتر»" data-autofocus />
          </label>
          <label className="lbl">
            برچسب کارت برجسته
            <input className="fld" value={badge} maxLength={30} onChange={(e) => setBadge(e.target.value)} placeholder="خالی = کارت معمولی؛ مثلاً «محبوب‌ترین»" />
          </label>
        </div>
        <label className="lbl">
          توضیح کوتاه
          <input className="fld" value={blurb} maxLength={120} onChange={(e) => setBlurb(e.target.value)} placeholder="مثلاً «برای بیشتر دفترهای املاک»" />
        </label>
        <div className="ad-grid2">
          <Num label="قیمت ماهانه (تومان)" value={monthly} onChange={setMonthly} hint={price ? toman(price) : 'قیمت یک ماه، بی تخفیف'} />
          <Num label="تعداد نفرات" value={seats} onChange={setSeats} max={3} hint="عضوها و دعوت‌های باز دفتر" />
        </div>

        <div className="chk ad-chk">
          <span className="col sp">
            <span className="sm sb">نفر اضافه هم می‌فروشد</span>
            <span className="xs mute">دفتر می‌تواند بیشتر از نفرات پایه بخرد؛ هر نفر قیمت جدا دارد.</span>
          </span>
          <Switch checked={extra} onChange={setExtra} label="نفر اضافه هم می‌فروشد" />
        </div>
        {extra && (
          <div className="ad-grid2">
            <Num
              label="قیمت ماهانهٔ هر نفر اضافه (تومان)"
              value={extraMonthly}
              onChange={setExtraMonthly}
              hint={extraMonthly ? toman(Number(extraMonthly)) : undefined}
            />
            <Num label="سقف کل نفرات" value={extraMax} onChange={setExtraMax} max={3} />
          </div>
        )}

        <label className="lbl">
          ویژگی‌های کارت در سایت
          <textarea className="fld" rows={4} value={features} onChange={(e) => setFeatures(e.target.value)} placeholder="هر خط یک ویژگی" />
        </label>

        <div className="chk ad-chk">
          <span className="col sp">
            <span className="sm sb">برای فروش نشان داده شود</span>
            <span className="xs mute">خاموش: از سایت و صفحهٔ خرید برنامه می‌رود؛ دفترهایی که دارندش نگهش می‌دارند.</span>
          </span>
          <Switch checked={shown} onChange={setShown} label="برای فروش نشان داده شود" />
        </div>

        {draft && terms.length > 0 && (
          <div className="ad-sum">
            <span className="sm mute">مبلغ هر خرید{ex ? ' با نفرات پایه' : ''}</span>
            <span className="ad-sum-terms">
              {terms.map((t) => (
                <span key={t.id} className="sm">
                  {t.name}: <b className="num">{formatGrouped(priceOf(draft, t))}</b>
                  {t === best && t.months > 1 && <span className="xs mute"> (ماهی {formatGrouped(perMonthOf(draft, t))})</span>}
                </span>
              ))}
            </span>
          </div>
        )}
        <Foot error={error} busy={busy} onClose={onClose} label={plan ? 'ذخیره' : 'ساختن پلن'} />
      </form>
    </Dialog>
  );
}

function TermDialog({ term, plan, onClose, onSave }: { term: Term | null; plan: Plan | undefined; onClose: () => void; onSave: (b: TermInput) => Promise<boolean> }) {
  const [name, setName] = useState(term?.name ?? '');
  const [months, setMonths] = useState(String(term?.months ?? ''));
  const [gift, setGift] = useState(String(term?.gift ?? 0));
  const [off, setOff] = useState(String(term?.off ?? 0));
  const [shown, setShown] = useState(!term?.hidden);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const m = Number(months);
  const g = Number(gift || 0);
  const o = Number(off || 0);
  const draft: Term | null = m >= 1 && m <= 36 && g <= 24 && o <= 90 ? { id: 'x', name, months: m, gift: g, off: o } : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!name.trim()) return setError('نام مدت را بنویسید؛ مثلاً «شش‌ماهه».');
    if (!(m >= 1 && m <= 36)) return setError('ماه‌های پولی باید بین ۱ و ۳۶ باشد.');
    if (g > 24) return setError('ماه هدیه حداکثر ۲۴ است.');
    if (o > 90) return setError('تخفیف حداکثر ۹۰ درصد است.');
    setBusy(true);
    setError('');
    if (await onSave({ name: name.trim(), months: m, gift: g, off: o, hidden: !shown })) onClose();
    else setBusy(false);
  };

  return (
    <Dialog title={term ? `ویرایش مدت «${term.name}»` : 'مدت تازه'} onClose={onClose}>
      <form className="ad-dlg-bd" onSubmit={submit}>
        <label className="lbl">
          نام مدت
          <input className="fld" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder="مثلاً «سه‌ماهه»" data-autofocus />
        </label>
        <div className="ad-grid3">
          <Num label="ماه‌های پولی" value={months} onChange={setMonths} max={2} />
          <Num label="ماه هدیه" value={gift} onChange={setGift} max={2} />
          <Num label="درصد تخفیف" value={off} onChange={setOff} max={2} />
        </div>
        <div className="chk ad-chk">
          <span className="col sp">
            <span className="sm sb">برای فروش نشان داده شود</span>
            <span className="xs mute">خاموش: در سایت و صفحهٔ خرید انتخاب‌کردنی نیست.</span>
          </span>
          <Switch checked={shown} onChange={setShown} label="برای فروش نشان داده شود" />
        </div>
        {draft && (
          <div className="ad-sum">
            <span className="sm mute">
              {toFaDigits(draft.months + draft.gift)} ماه اعتبار{plan ? `؛ پلن ${plan.name}` : ''}
            </span>
            {plan && (
              <span className="b">
                {toman(priceOf(plan, draft))}، ماهی {formatGrouped(perMonthOf(plan, draft))}
              </span>
            )}
          </div>
        )}
        <Foot error={error} busy={busy} onClose={onClose} label={term ? 'ذخیره' : 'ساختن مدت'} />
      </form>
    </Dialog>
  );
}
