import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Icon, Segmented } from '@kelid/ui';
import { formatGrouped, nextExpiry, PLANS, priceOf, toFaDigits, type Period, type Plan, type PlanId } from '@kelid/core';
import { API_URL, type PaymentStatus, type Receipt } from '../auth/api';
import { useAuth, useMember } from '../auth/AuthContext';
import { useToast } from '../layout/Toasts';
import { useFirstVisit } from '../layout/useFirstVisit';
import { adoptLicense, useLicense } from './license';
import { daysLeftText, payError, phaseTag, planName, untilText, useBilling } from './useBilling';
import './billing.css';

type Flow =
  | { step: 'idle' }
  | { step: 'opening' }
  | { step: 'waiting'; id: string; payUrl: string; at: number; blocked: boolean }
  | { step: 'paid'; receipt: Receipt }
  | { step: 'failed'; status: PaymentStatus };

const FEATURES = [
  'فایل، مشتری، بازدید و قرارداد بی‌شمار',
  'همگام روی کامپیوتر، گوشی و مرورگر',
  'کار کامل بدون اینترنت',
  'پشتیبان امن روی سرور دفتر',
  'عکس فایل‌ها با کیفیت کامل',
  'به‌روزرسانی رایگان',
];
const PERIOD_NAME = { month: 'یک‌ماهه', year: 'یک‌ساله' } as const;
const DEMO = API_URL === 'demo';
// پرداختی که منتظرش هستیم با تازه‌شدن صفحه گم نمی‌شود.
const PENDING = 'kelid.pay';
const POLL_MS = 2500;

function savedFlow(): Flow {
  try {
    const f = JSON.parse(sessionStorage.getItem(PENDING) ?? 'null') as Extract<Flow, { step: 'waiting' }> | null;
    return f && typeof f.id === 'string' ? { ...f, step: 'waiting' } : { step: 'idle' };
  } catch {
    return { step: 'idle' };
  }
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
 * خرید و تمدید اشتراک. پلن و دوره انتخاب می‌شود، تاریخ پایان تازه پیش از پرداخت دیده می‌شود، درگاه در برگه‌ای جدا باز می‌شود
 * و همین صفحه منتظر می‌ماند تا بانک تأیید کند؛ کاربر جز بستن برگهٔ بانک کاری ندارد.
 */
export function PlansPage() {
  const { session, api, withToken, status } = useAuth();
  const { manager } = useMember();
  const lic = useLicense();
  const toast = useToast();
  const first = useFirstVisit('plans');
  const { billing, failed, reload } = useBilling();
  const [period, setPeriod] = useState<Period>('year');
  const [picked, setPicked] = useState<PlanId | null>(null);
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

  const plans: readonly Plan[] = billing?.plans ?? PLANS;
  const current = billing
    ? { plan: billing.plan, trial: billing.trial, expiresAt: billing.expiresAt }
    : lic
      ? { plan: lic.plan, trial: lic.trial, expiresAt: new Date(lic.expiresAt).toISOString() }
      : null;
  const used = billing?.used ?? 1;
  const fits = (p: Plan) => p.seats >= used;
  const fallback = plans.find((p) => p.id === current?.plan && fits(p)) ?? plans.find((p) => p.id === 'office' && fits(p)) ?? plans.find(fits);
  const plan = plans.find((p) => p.id === picked && fits(p)) ?? fallback;
  const amount = plan ? priceOf(plan, period) : 0;
  const until = plan && current ? nextExpiry(current, plan, period, Date.now()) : null;
  const left = current ? Date.parse(current.expiresAt) - Date.now() : 0;
  const carryNote =
    !current || left <= 0 || !plan
      ? null
      : current.trial
        ? 'روزهای باقی‌ماندهٔ دورهٔ آزمایشی هم سر جایش می‌ماند.'
        : current.plan === plan.id
          ? 'روزهای باقی‌ماندهٔ اشتراک فعلی به آن اضافه می‌شود.'
          : 'ارزش روزهای باقی‌ماندهٔ پلن فعلی به این پلن منتقل می‌شود.';

  const pay = async () => {
    if (!plan || flow.step === 'opening') return;
    // برگهٔ بانک همین لحظهٔ کلیک باز می‌شود؛ بعد از منتظر ماندن برای سرور، مرورگر آن را «پنجرهٔ ناخواسته» می‌گرفت.
    // ویندوز برگه باز نمی‌کند: نشانی بانک در مرورگر خود سیستم باز می‌شود.
    const tab = !window.kelid && !DEMO ? window.open('', '_blank') : null;
    if (tab) {
      tab.opener = null;
      tab.document.title = 'درگاه پرداخت';
      tab.document.body.style.cssText = 'font:16px system-ui,sans-serif;padding:32px;direction:rtl;text-align:center;color:#5C625E';
      tab.document.body.textContent = 'در حال رفتن به صفحهٔ پرداخت بانک…';
    }
    setFlow({ step: 'opening' });
    try {
      const r = await withToken((t) => api.checkout(t, plan.id, period));
      if (r.payUrl && tab) tab.location.href = r.payUrl;
      else if (r.payUrl && window.kelid) window.open(r.payUrl, '_blank');
      setFlow({ step: 'waiting', id: r.id, payUrl: r.payUrl, at: Date.now(), blocked: !!r.payUrl && !tab && !window.kelid });
    } catch (e) {
      tab?.close();
      setFlow({ step: 'idle' });
      toast(payError(e));
    }
  };

  if (flow.step === 'waiting') {
    return (
      <div className="pl-center">
        <section className="pl-result card enter" aria-live="polite">
          <span className="pl-mark pl-wait" aria-hidden="true">
            <Icon name="card" size="l" />
          </span>
          <h1 className="t2">{flow.blocked ? 'صفحهٔ پرداخت را باز کنید' : 'پرداخت را در صفحهٔ بانک کامل کنید'}</h1>
          <p className="mute">
            {flow.blocked
              ? 'مرورگر جلوی باز شدن خودکار صفحهٔ بانک را گرفت. دکمهٔ زیر را بزنید.'
              : DEMO
                ? 'پیش‌نمایش: پرداخت چند لحظه دیگر خودکار انجام می‌شود.'
                : 'بعد از پرداخت، برگهٔ بانک را ببندید. این صفحه خودش باخبر می‌شود و اشتراک فعال می‌شود.'}
          </p>
          <span className="pl-dots" aria-label="منتظر تأیید بانک">
            <i />
            <i />
            <i />
          </span>
          <div className="pl-acts">
            {flow.payUrl && (
              <a className={flow.blocked ? 'btn btn-p btn-lg' : 'btn btn-s'} href={flow.payUrl} target="_blank" rel="noopener noreferrer">
                <Icon name="fwd" size="s" />
                {flow.blocked ? 'رفتن به صفحهٔ پرداخت' : 'باز کردن دوبارهٔ صفحهٔ پرداخت'}
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
  const canPay = manager && !!plan && (billing ? billing.canPay : !failed);

  return (
    <div className={first ? 'bd enter pl-page' : 'bd pl-page'} style={{ paddingTop: 26 }}>
      <header className="col" style={{ gap: 6 }}>
        <span className="eb">اشتراک</span>
        <h1 className="t1">پلن دفتر را انتخاب کنید</h1>
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

      <div className="rw pl-period">
        <Segmented<Period>
          label="مدت اشتراک"
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'month', label: 'ماهانه' },
            {
              value: 'year',
              label: (
                <>
                  سالانه<span className="pl-gift">۲ ماه هدیه</span>
                </>
              ),
            },
          ]}
        />
      </div>

      <div className="pl-grid stagger" role="radiogroup" aria-label="پلن">
        {plans.map((p) => {
          const ok = fits(p);
          const on = p.id === plan?.id;
          const isCurrent = !!current && !current.trial && current.plan === p.id;
          return (
            <label key={p.id} className={`pl-card${on ? ' on' : ''}${ok ? '' : ' off'}`}>
              <input type="radio" name="plan" className="visually-hidden" checked={on} disabled={!ok} onChange={() => setPicked(p.id)} />
              <span className="pl-top">
                <span className="pl-radio" aria-hidden="true" />
                <span className="t2">{p.name}</span>
                {isCurrent ? <span className="tag">پلن فعلی</span> : p.id === 'office' ? <span className="tag ok">پیشنهاد ما</span> : null}
              </span>
              <span className="mute sm">{p.blurb}</span>
              <span className="pl-price">
                <span className="num">{formatGrouped(priceOf(p, period))}</span>
                <span className="mute sm">{period === 'year' ? 'تومان برای یک سال' : 'تومان در ماه'}</span>
              </span>
              <span className="xs mute pl-sub">
                {period === 'year'
                  ? `ماهی حدود ${formatGrouped(Math.round(priceOf(p, 'year') / 12 / 1000) * 1000)} تومان`
                  : `سالانه ${formatGrouped(priceOf(p, 'year'))} تومان`}
              </span>
              <span className="rw sm sb pl-seats">
                <Icon name={p.seats > 1 ? 'users' : 'user'} size="s" />
                {p.seats > 1 ? `تا ${toFaDigits(p.seats)} نفر در دفتر` : 'فقط یک نفر'}
              </span>
              {!ok && <span className="xs pl-why">دفتر شما {toFaDigits(used)} نفر دارد</span>}
            </label>
          );
        })}
      </div>

      <ul className="pl-feat" aria-label="در همهٔ پلن‌ها">
        {FEATURES.map((f) => (
          <li key={f}>
            <Icon name="check" size="s" />
            {f}
          </li>
        ))}
      </ul>

      <section className="pl-sum soft" aria-label="خلاصهٔ پرداخت">
        {manager ? (
          <>
            <div className="col" style={{ gap: 2, minWidth: 0 }}>
              <span className="sm mute">{plan ? `پلن ${plan.name}، ${PERIOD_NAME[period]}` : 'پلنی انتخاب نشده'}</span>
              <span className="pl-total">
                <span className="num">{formatGrouped(amount)}</span> <span className="sm mute">تومان</span>
              </span>
              {until && (
                <span className="sm">
                  اعتبار تا <b>{untilText(until)}</b>
                </span>
              )}
              {carryNote && <span className="xs mute">{carryNote}</span>}
            </div>
            <div className="col pl-pay">
              <button type="button" className="btn btn-p btn-lg" disabled={!canPay || flow.step === 'opening'} onClick={() => void pay()}>
                <Icon name="card" size="s" />
                {flow.step === 'opening' ? 'در حال رفتن به بانک…' : 'پرداخت و فعال‌سازی'}
              </button>
              <span className="xs mute">
                {failed && !billing ? (
                  <>
                    به سرور وصل نشد.{' '}
                    <button type="button" className="lnk pl-retry" onClick={reload}>
                      دوباره امتحان کنید
                    </button>
                  </>
                ) : billing && !billing.canPay ? (
                  'پرداخت آنلاین هنوز روی سرور فعال نشده است.'
                ) : (
                  'پرداخت امن از درگاه بانکی زرین‌پال'
                )}
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
