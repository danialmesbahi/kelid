import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Icon } from '@kelid/ui';
import { bestTerm, formatGrouped, forSale, monthlyOf, nextExpiry, perMonthOf, priceOf, seatsFor, termDays, toFaDigits, type Period, type Plan, type PlanId } from '@kelid/core';
import { API_URL, type PaymentStatus, type Receipt } from '../auth/api';
import { useAuth, useMember } from '../auth/AuthContext';
import { useToast } from '../layout/Toasts';
import { useFirstVisit } from '../layout/useFirstVisit';
import { useCatalog } from './catalog';
import { adoptLicense, useLicense } from './license';
import { daysLeftText, payError, phaseTag, planName, untilText, useBilling } from './useBilling';
import { FEATURES, MySubscription } from './MySubscription';
import './billing.css';

type Flow =
  | { step: 'idle' }
  | { step: 'opening' }
  | { step: 'going' }
  | { step: 'waiting'; id: string; payUrl: string; at: number }
  | { step: 'paid'; receipt: Receipt }
  | { step: 'failed'; status: PaymentStatus };

const DEMO = API_URL === 'demo';
// پرداختی که منتظرش هستیم با تازه‌شدن صفحه گم نمی‌شود.
const PENDING = 'kelid.pay';
const POLL_MS = 2500;

function savedFlow(): Flow {
  // برگشت از بانک: نشانی ‎#/plans?pay=…‎ است (مسیریاب hash)؛ اگر حافظهٔ برگه پاک شده باشد، همان شناسه کافی است.
  const back = new URLSearchParams(location.hash.split('?')[1] ?? '').get('pay');
  try {
    const f = JSON.parse(sessionStorage.getItem(PENDING) ?? 'null') as Extract<Flow, { step: 'waiting' }> | null;
    if (f && typeof f.id === 'string' && (!back || f.id === back)) return { ...f, step: 'waiting' };
  } catch {
    /* حافظهٔ موقت در دسترس نیست */
  }
  return back ? { step: 'waiting', id: back, payUrl: '', at: Date.now() } : { step: 'idle' };
}

function keepFlow(f: Flow) {
  try {
    if (f.step === 'waiting') sessionStorage.setItem(PENDING, JSON.stringify(f));
    else sessionStorage.removeItem(PENDING);
  } catch {
    /* بی حافظهٔ موقت، فقط تا تازه شدن صفحه */
  }
}

/**
 * خرید و تمدید اشتراک. پلن و دوره انتخاب می‌شود، تاریخ پایان تازه پیش از پرداخت دیده می‌شود، بعد درگاه.
 * وب: همین برگه به بانک می‌رود و بانک آن را به ‎#/plans?pay=…‎ برمی‌گرداند (برگهٔ دوم کلید پایگاه دادهٔ OPFS را قفل می‌دید).
 * ویندوز: بانک در مرورگر سیستم باز می‌شود و همین صفحه منتظر می‌ماند تا بانک تأیید کند.
 */
export function PlansPage() {
  const { session, api, withToken, status } = useAuth();
  const { manager } = useMember();
  const lic = useLicense();
  const toast = useToast();
  const first = useFirstVisit('plans');
  const { billing, failed, reload } = useBilling();
  const catalog = useCatalog();
  const [period, setPeriod] = useState<Period | null>(null);
  const [picked, setPicked] = useState<PlanId | null>(null);
  const [wantSeats, setWantSeats] = useState<number | null>(null);
  // تیک‌های پیش از خرید به همین انتخاب بسته‌اند؛ با عوض شدن پلن، نفرات یا مدت از نو زده می‌شوند.
  const [agreed, setAgreed] = useState<{ sel: string; ids: number[] }>({ sel: '', ids: [] });
  const [flow, setFlowState] = useState<Flow>(savedFlow);
  const office = session?.office.id;
  const setFlow = (f: Flow) => {
    keepFlow(f);
    setFlowState(f);
  };

  // منتظر بانک: هر چند ثانیه و هر بار که کاربر به این برگه برگشت.
  const waitingId = flow.step === 'waiting' ? flow.id : null;
  useEffect(() => {
    if (!waitingId || !api || !office) return;
    let live = true;
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      withToken((t) => api.payment(t, waitingId)).then(
        async (r) => {
          if (!live || r.status === 'pending') return;
          if (r.status === 'paid') {
            await adoptLicense(r.license, office);
            if (!live) return;
            keepFlow({ step: 'paid', receipt: r });
            setFlowState({ step: 'paid', receipt: r });
            reload();
          } else {
            keepFlow({ step: 'failed', status: r.status });
            setFlowState({ step: 'failed', status: r.status });
          }
        },
        () => {},
      );
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    addEventListener('focus', tick);
    return () => {
      live = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
      removeEventListener('focus', tick);
    };
  }, [waitingId, api, office, withToken, reload]);

  if (status === 'off' || !api) {
    return (
      <div className="bd enter" style={{ paddingTop: 26 }}>
        <h1 className="t1">اشتراک</h1>
        <p className="mute">این نسخهٔ کلید فقط روی همین دستگاه کار می‌کند و اشتراکی لازم ندارد.</p>
      </div>
    );
  }

  // پلن‌ها و مدت‌ها از پنل کلید؛ پلن پنهانِ خود دفتر فقط برای صفحهٔ «اشتراک دفتر شما» می‌آید، نه برای خرید.
  const all: readonly Plan[] = billing?.plans ?? catalog.plans;
  const { plans, terms } = forSale({ plans: [...all], terms: billing?.terms ?? catalog.terms });
  const best = bestTerm(terms);
  const current = billing
    ? { plan: billing.plan, trial: billing.trial, expiresAt: billing.expiresAt }
    : lic
      ? { plan: lic.plan, trial: lic.trial, expiresAt: new Date(lic.expiresAt).toISOString() }
      : null;
  const used = billing?.used ?? 1;
  const curSeats = billing?.seats ?? lic?.seats;
  const fits = (p: Plan) => (p.extra?.max ?? p.seats) >= used;
  // پلن با نفر اضافه: کمتر از نفرات فعلی دفتر نمی‌شود؛ پیش‌فرض همان تعدادی که الان خریده.
  const seatsOf = (p: Plan) => seatsFor(p, Math.max(used, wantSeats ?? (current?.plan === p.id ? (curSeats ?? 0) : 0)));
  const fallback = plans.find((p) => p.id === current?.plan && fits(p)) ?? plans.find((p) => !!p.badge && fits(p)) ?? plans.find(fits);
  const plan = plans.find((p) => p.id === picked && fits(p)) ?? fallback;
  const seats = plan ? seatsOf(plan) : 0;
  const term = terms.find((t) => t.id === period) ?? best;
  const amount = plan && term ? priceOf(plan, term, seats) : 0;
  const termMonths = term ? term.months + term.gift : 1;
  const until =
    plan && term && current ? nextExpiry({ ...current, seats: curSeats }, all.find((p) => p.id === current.plan), plan, termDays(term), Date.now(), seats) : null;
  const left = current ? Date.parse(current.expiresAt) - Date.now() : 0;
  const carryNote =
    !current || left <= 0 || !plan
      ? null
      : current.trial
        ? 'روزهای باقی‌ماندهٔ دورهٔ آزمایشی هم سر جایش می‌ماند.'
        : current.plan === plan.id && (!plan.extra || curSeats === seats)
          ? 'روزهای باقی‌ماندهٔ اشتراک فعلی به آن اضافه می‌شود.'
          : 'ارزش روزهای باقی‌ماندهٔ پلن فعلی به این پلن منتقل می‌شود.';

  const pay = async () => {
    if (!plan || !term || flow.step === 'opening' || flow.step === 'going') return;
    const web = !window.kelid;
    setFlow({ step: 'opening' });
    try {
      const r = await withToken((t) => api.checkout(t, plan.id, term.id, plan.extra ? seats : undefined, web ? location.origin : undefined));
      const waiting: Flow = { step: 'waiting', id: r.id, payUrl: r.payUrl, at: Date.now() };
      if (r.payUrl && web) {
        // رفتن به بانک بیرون از برنامه است، نه جابه‌جایی صفحه‌های کلید؛ پرداخت در انتظار در حافظهٔ برگه می‌ماند تا برگشت.
        keepFlow(waiting);
        setFlowState({ step: 'going' });
        location.assign(r.payUrl);
        return;
      }
      // ویندوز برگه باز نمی‌کند: نشانی بانک در مرورگر خود سیستم باز می‌شود.
      if (r.payUrl) window.open(r.payUrl, '_blank');
      setFlow(waiting);
    } catch (e) {
      setFlow({ step: 'idle' });
      toast(payError(e));
    }
  };

  if (flow.step === 'going') {
    return (
      <div className="pl-center">
        <section className="pl-result card enter" aria-live="polite">
          <span className="pl-mark pl-wait" aria-hidden="true">
            <Icon name="shield" size="l" />
          </span>
          <h1 className="t2">در حال رفتن به درگاه بانک</h1>
          <p className="mute">چند لحظه صبر کنید. بعد از پرداخت، بانک خودش شما را به کلید برمی‌گرداند.</p>
          <span className="pl-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </section>
      </div>
    );
  }

  if (flow.step === 'waiting') {
    return (
      <div className="pl-center">
        <section className="pl-result card enter" aria-live="polite">
          <span className="pl-mark pl-wait" aria-hidden="true">
            <Icon name="card" size="l" />
          </span>
          <h1 className="t2">{window.kelid ? 'پرداخت را در صفحهٔ بانک کامل کنید' : 'در حال گرفتن تأیید بانک'}</h1>
          <p className="mute">
            {DEMO
              ? 'پیش‌نمایش: پرداخت چند لحظه دیگر خودکار انجام می‌شود.'
              : window.kelid
                ? 'بعد از پرداخت، صفحهٔ بانک را ببندید. این صفحه خودش باخبر می‌شود و اشتراک فعال می‌شود.'
                : 'اگر پرداخت را کامل کرده‌اید، چند لحظه صبر کنید؛ اشتراک همین‌جا فعال می‌شود.'}
          </p>
          <span className="pl-dots" aria-label="منتظر تأیید بانک">
            <i />
            <i />
            <i />
          </span>
          <div className="pl-acts">
            {flow.payUrl && (
              <a className="btn btn-s" href={flow.payUrl} {...(window.kelid ? { target: '_blank', rel: 'noopener noreferrer' } : { rel: 'noreferrer' })}>
                <Icon name="fwd" size="s" />
                باز کردن دوبارهٔ صفحهٔ پرداخت
              </a>
            )}
            <button type="button" className="btn btn-g" onClick={() => setFlow({ step: 'idle' })}>
              انصراف
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (flow.step === 'paid') {
    const r = flow.receipt;
    return (
      <div className="pl-center">
        <section className="pl-result card enter" aria-live="polite">
          <span className="pl-mark stamp" aria-hidden="true">
            <Icon name="check" size="l" thick />
          </span>
          <h1 className="t1">اشتراک فعال شد</h1>
          <p className="sb">
            پلن {planName(r.plan)} تا {r.expiresAt ? untilText(r.expiresAt) : ''}
          </p>
          <p className="mute sm">
            {formatGrouped(r.amount)} تومان پرداخت شد
            {r.refId ? (
              <>
                ، کد پیگیری بانک <span className="pl-ref">{toFaDigits(r.refId)}</span>
              </>
            ) : null}
            . رسید در تنظیمات می‌ماند.
          </p>
          <div className="pl-acts">
            <Link className="btn btn-p btn-lg" to="/" viewTransition onClick={() => setFlow({ step: 'idle' })}>
              برگشت به کار
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (flow.step === 'failed') {
    return (
      <div className="pl-center">
        <section className="pl-result card enter" aria-live="polite">
          <span className="pl-mark pl-bad" aria-hidden="true">
            <Icon name="x" size="l" thick />
          </span>
          <h1 className="t2">{flow.status === 'canceled' ? 'پرداخت لغو شد' : 'پرداخت انجام نشد'}</h1>
          <p className="mute">اشتراک تغییری نکرد. اگر مبلغی از حسابتان کم شده، بانک تا ۷۲ ساعت خودکار برمی‌گرداند.</p>
          <div className="pl-acts">
            <button type="button" className="btn btn-p btn-lg" onClick={() => setFlow({ step: 'idle' })}>
              دوباره امتحان کنید
            </button>
          </div>
        </section>
      </div>
    );
  }

  const tag = lic ? phaseTag[lic.phase] : null;
  const sel = `${plan?.id}|${seats}|${term?.id}`;
  const rules =
    plan && term
      ? [
        `پلن ${plan.name}${plan.extra ? ` برای ${toFaDigits(seats)} نفر` : ''} و مدت ${term.name} را خودم انتخاب کرده‌ام و مبلغ ${formatGrouped(amount)} تومان را تأیید می‌کنم.`,
        `اعتبار اشتراک${until ? ` تا ${untilText(until)}` : ''} است؛ بعد از آن تا تمدید نشود برنامه فقط‌خواندنی می‌شود و اطلاعات پاک نمی‌شود.`,
          'بعد از خرید، تمدید، ارتقا یا تغییر پلن در برنامه نیست و فقط با پیام به پشتیبانی کلید انجام می‌شود.',
        ]
      : [];
  const ticked = (i: number) => agreed.sel === sel && agreed.ids.includes(i);
  const tick = (i: number, on: boolean) => {
    const ids = agreed.sel === sel ? agreed.ids.filter((x) => x !== i) : [];
    setAgreed({ sel, ids: on ? [...ids, i] : ids });
  };
  const allTicked = rules.every((_, i) => ticked(i));
  const canPay = manager && !!plan && !!term && allTicked && (billing ? billing.canPay : !failed);
  const payNote =
    failed && !billing ? (
      <>
        به سرور وصل نشد.{' '}
        <button type="button" className="lnk pl-retry" onClick={reload}>
          دوباره امتحان کنید
        </button>
      </>
    ) : billing && !billing.canPay ? (
      'پرداخت آنلاین هنوز روی سرور فعال نشده است.'
    ) : (
      <>
        <Icon name="shield" size="s" />
        پرداخت امن از درگاه بانکی زرین‌پال
      </>
    );

  // دفتری که اشتراک خریده فهرست پلن‌ها نمی‌بیند؛ فقط اشتراک خودش. تمدید و تغییر پلن از راه پشتیبانی است.
  const mineOf = current && !current.trial ? all.find((p) => p.id === current.plan) : undefined;
  if (mineOf && current) {
    return (
      <MySubscription
        mine={mineOf}
        mineSeats={curSeats ?? mineOf.seats}
        used={used}
        expiresAt={current.expiresAt}
        lic={lic}
        billing={billing}
        manager={manager}
        first={first}
      />
    );
  }

  return (
    <div className={first ? 'bd enter pl-page' : 'bd pl-page'} style={{ paddingTop: 26 }}>
      <header className="col pl-head">
        <span className="eb">اشتراک</span>
        <h1 className="t1">پلن دفترتان را انتخاب کنید</h1>
        <p className="mute" style={{ margin: 0 }}>
          همهٔ امکانات کلید در همهٔ پلن‌ها هست؛ فرقشان فقط در تعداد همکاران است.
        </p>
        {lic && tag && (
          <p className="rw sm pl-now" style={{ margin: '6px 0 0' }}>
            <span className={`tag ${tag.tone}`}>{tag.label}</span>
            <span>
              {lic.trial ? 'دورهٔ آزمایشی' : `پلن ${planName(lic.plan)}`}
              {lic.daysLeft > 0 ? ` تا ${untilText(lic.expiresAt)}، ${daysLeftText(lic)}` : `، پایان: ${untilText(lic.expiresAt)}`}
            </span>
          </p>
        )}
      </header>

      <div className="pl-terms" role="radiogroup" aria-label="مدت اشتراک">
        {terms.map((t) => (
          <label key={t.id} className={`pl-term${t === term ? ' on' : ''}`}>
            <input type="radio" name="term" className="visually-hidden" checked={t === term} onChange={() => setPeriod(t.id)} />
            {t === best && terms.length > 1 && (t.gift > 0 || t.off > 0) && <span className="pl-flag">بیشترین تخفیف</span>}
            <span className="pl-term-name">{t.name}</span>
            <span className={t.gift ? 'pl-gift' : 'xs mute'}>{t.gift ? `${toFaDigits(t.gift)} ماه هدیه` : 'ماه به ماه'}</span>
          </label>
        ))}
      </div>

      <div className="pl-grid stagger" role="radiogroup" aria-label="پلن">
        {plans.map((p) => {
          const ok = fits(p);
          const on = p.id === plan?.id;
          const isCurrent = !!current && !current.trial && current.plan === p.id;
          const n = seatsOf(p);
          if (!term) return null;
          const total = priceOf(p, term, n);
          const full = monthlyOf(p, n);
          const perMonth = perMonthOf(p, term, n);
          const save = Math.round((1 - total / (full * termMonths)) * 100);
          const step = (d: number) => {
            setPicked(p.id);
            setWantSeats(seatsFor(p, Math.max(used, n + d)));
          };
          return (
            <label key={p.id} className={`pl-card${on ? ' on' : ''}${ok ? '' : ' off'}${p.badge ? ' best' : ''}`}>
              <input type="radio" name="plan" className="visually-hidden" checked={on} disabled={!ok} onChange={() => setPicked(p.id)} />
              {isCurrent ? <span className="pl-ribbon cur">پلن فعلی شما</span> : p.badge ? <span className="pl-ribbon">{p.badge}</span> : null}
              <span className="pl-top">
                <span className="pl-ic" aria-hidden="true">
                  <Icon name={p.seats > 1 ? 'users' : 'user'} />
                </span>
                <span className="col" style={{ gap: 0, minWidth: 0 }}>
                  <span className="t2">{p.name}</span>
                  <span className="sm mute">{p.extra ? `تا ${toFaDigits(p.seats)} نفر، بیشتر هم می‌شود` : p.seats > 1 ? `تا ${toFaDigits(p.seats)} نفر` : 'فقط یک نفر'}</span>
                </span>
                <span className="pl-check" aria-hidden="true">
                  <Icon name="check" size="s" thick />
                </span>
              </span>

              <span className="pl-price">
                {save > 0 && (
                  <span className="pl-was">
                    <s className="num">{formatGrouped(full)}</s>
                    <span className="pl-save">{toFaDigits(save)}٪ ارزان‌تر</span>
                  </span>
                )}
                <span className="pl-big">
                  <span className="num">{formatGrouped(perMonth)}</span>
                  <span className="sm mute">تومان در ماه</span>
                </span>
              </span>

              <span className="pl-bill sm">
                {term.gift ? (
                  <>
                    <span>
                      یک‌جا <b className="num">{formatGrouped(total)}</b> تومان
                    </span>
                    <span className="pl-giftline">
                      <Icon name="gem" size="s" />
                      {toFaDigits(term.months)} ماه + {toFaDigits(term.gift)} ماه هدیه
                    </span>
                  </>
                ) : best && best !== term ? (
                  <span className="mute">
                    با اشتراک {best.name} ماهی <b className="num">{formatGrouped(perMonthOf(p, best, n))}</b> تومان
                  </span>
                ) : null}
              </span>

              {p.extra && (
                <span className="pl-seatbox">
                  <span className="pl-step">
                    <span className="sm sb">تعداد نفرات</span>
                    <span className="pl-stepper">
                      <button type="button" aria-label="یک نفر بیشتر" disabled={!ok || n >= p.extra.max} onClick={() => step(1)}>
                        <Icon name="plus" size="s" />
                      </button>
                      <span className="num" aria-live="polite">
                        {toFaDigits(n)}
                      </span>
                      <button type="button" aria-label="یک نفر کمتر" disabled={!ok || n <= Math.max(p.seats, used)} onClick={() => step(-1)}>
                        <span className="pl-minus" />
                      </button>
                    </span>
                  </span>
                  <span className="xs mute">
                    {n > p.seats
                      ? `${toFaDigits(n - p.seats)} نفر بیشتر از ${toFaDigits(p.seats)} نفر پایه، هر نفر ماهی ${formatGrouped(p.extra.monthly)} تومان`
                      : `هر نفر بیشتر از ${toFaDigits(p.seats)}، ماهی ${formatGrouped(p.extra.monthly)} تومان`}
                  </span>
                </span>
              )}
              {!ok && <span className="xs pl-why">دفتر شما {toFaDigits(used)} نفر دارد</span>}
            </label>
          );
        })}
      </div>

      <section className="pl-incl" aria-labelledby="pl-incl">
        <h2 id="pl-incl" className="sm sb">
          در همهٔ پلن‌ها
        </h2>
        <ul className="pl-feat">
          {FEATURES.map((f) => (
            <li key={f}>
              <Icon name="check" size="s" />
              {f}
            </li>
          ))}
        </ul>
      </section>

      {manager && plan && (
        <section className="card pl-agree" aria-labelledby="pl-agree">
          <h2 id="pl-agree" className="sm sb">
            پیش از پرداخت، این‌ها را بخوانید و تیک بزنید
          </h2>
          {rules.map((t, i) => (
            <label key={i} className={ticked(i) ? 'pl-tick on' : 'pl-tick'}>
              <input type="checkbox" className="visually-hidden" checked={ticked(i)} onChange={(e) => tick(i, e.target.checked)} />
              <span className="pl-box" aria-hidden="true">
                <Icon name="check" size="s" thick />
              </span>
              <span className="sm">{t}</span>
            </label>
          ))}
        </section>
      )}

      <section className="pl-sum" aria-label="خلاصهٔ پرداخت">
        {manager ? (
          <>
            <div className="col pl-sum-text">
              <span className="sm mute">
                {plan && term ? `پلن ${plan.name}${plan.extra ? ` برای ${toFaDigits(seats)} نفر` : ''}، ${term.name}` : 'پلنی انتخاب نشده'}
              </span>
              <span className="pl-total">
                <span className="num">{formatGrouped(amount)}</span> <span className="sm mute">تومان</span>
              </span>
              {until && (
                <span className="sm">
                  اعتبار تا <b>{untilText(until)}</b>
                </span>
              )}
              {carryNote && <span className="xs mute pl-carry">{carryNote}</span>}
            </div>
            <div className="col pl-pay">
              <button type="button" className="btn btn-p btn-lg" disabled={!canPay || flow.step === 'opening'} onClick={() => void pay()}>
                <Icon name="card" size="s" />
                {flow.step === 'opening' ? (
                  'در حال رفتن به بانک…'
                ) : (
                  <>
                    پرداخت<span className="pl-long"> و فعال‌سازی</span>
                  </>
                )}
              </button>
              <span className="xs mute rw pl-trust">
                {plan && !allTicked ? 'برای پرداخت، همهٔ موارد بالا را تیک بزنید.' : payNote}
              </span>
            </div>
          </>
        ) : (
          <p className="rw sm pl-agent">
            <Icon name="lock" size="s" />
            پرداخت و تمدید را مدیر دفتر انجام می‌دهد. اگر اشتراک تمام شده، به مدیرتان خبر دهید.
          </p>
        )}
      </section>
    </div>
  );
}
