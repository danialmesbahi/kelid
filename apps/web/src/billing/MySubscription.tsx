import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Icon } from '@kelid/ui';
import {
  formatDate,
  formatGrouped,
  monthlyOf,
  perMonthOf,
  priceOf,
  termDays,
  TERMS,
  termOf,
  toFaDigits,
  type LicenseInfo,
  type Period,
  type Plan,
  type PlanId,
} from '@kelid/core';
import type { Billing } from '../auth/api';
import { phaseTag } from './useBilling';

const DAY = 86_400_000;
const TERM_LABEL: Record<Period, string> = { month: 'یک ماه', half: 'شش ماه', year: 'یک سال' };
// حلقهٔ روزهای مانده: محیط دایره با شعاع ۵۲ در viewBox ۱۲۰.
const RING = 2 * Math.PI * 52;

interface Props {
  /** پلن و نفرات فعلی دفتر. */
  mine: Plan;
  mineSeats: number;
  /** آنچه الان خریده می‌شود: همان پلن (تمدید) یا پلن/نفر بیشتر (ارتقا). */
  target: Plan;
  targetSeats: number;
  plans: readonly Plan[];
  onTarget: (id: PlanId | null, seats: number | null) => void;
  used: number;
  expiresAt: string;
  lic: LicenseInfo | null;
  billing: Billing | null;
  manager: boolean;
  period: Period;
  onPeriod: (p: Period) => void;
  /** پایان اعتبار اگر همین حالا با پلن و مدت انتخاب‌شده خریده شود. */
  until: number | null;
  canPay: boolean;
  opening: boolean;
  onPay: () => void;
  note: ReactNode;
  first: boolean;
}

/**
 * صفحهٔ اشتراک دفتری که خرید کرده: به جای فهرست پلن‌ها، وضعیت اشتراک خودش، تمدید همان پلن و ارتقا.
 * فقط ارتقا (پلن یا نفر بیشتر) هست، نه کاهش؛ پیش از پرداخت حال و بعد کنار هم دیده می‌شود.
 */
export function MySubscription(p: Props) {
  const now = Date.now();
  const end = Date.parse(p.expiresAt);
  const last = p.billing?.payments[0];
  const start = last?.paidAt ? Date.parse(last.paidAt) : end - termDays(last?.period ?? 'year') * DAY;
  const daysLeft = p.lic?.daysLeft ?? Math.max(0, Math.ceil((end - now) / DAY));
  const total = Math.max(DAY, end - start);
  const left = Math.min(1, Math.max(0, (end - now) / total));
  const elapsed = 1 - left;
  const phase = p.lic?.phase ?? (daysLeft > 0 ? 'active' : 'expired');
  const tag = phaseTag[phase];
  const tone = phase === 'expired' || phase === 'suspended' ? 'bad' : phase === 'ending' || phase === 'stale' ? 'warn' : '';
  const full = p.used >= p.mineSeats;
  const t = termOf(p.period);
  const amount = priceOf(p.target, p.period, p.targetSeats);
  // پلن‌هایی که جای بیشتری می‌دهند؛ برای پلن فعلی فقط اگر نفر اضافه بپذیرد.
  const ups = p.plans.filter((x) => (x.id === p.mine.id ? !!x.extra && p.mineSeats < x.extra.max : x.seats > p.mineSeats));
  const up = p.target.id !== p.mine.id || p.targetSeats !== p.mineSeats;
  const minSeats = p.target.id === p.mine.id ? p.mineSeats + 1 : p.target.seats;
  const pick = (x: Plan) => p.onTarget(x.id, x.id === p.mine.id ? p.mineSeats + 1 : null);

  return (
    <div className={p.first ? 'bd enter pl-page' : 'bd pl-page'} style={{ paddingTop: 26 }}>
      <header className="col pl-head">
        <span className="eb">اشتراک</span>
        <h1 className="t1">اشتراک دفتر شما</h1>
      </header>

      <section className={`card ms-hero${tone ? ` ${tone}` : ''}`} aria-label="وضعیت اشتراک">
        <div className="ms-ring" role="img" aria-label={daysLeft > 0 ? `${toFaDigits(daysLeft)} روز از اشتراک مانده` : 'اشتراک تمام شده'}>
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle className="ms-ring-track" cx="60" cy="60" r="52" />
            <circle className="ms-ring-fill" cx="60" cy="60" r="52" strokeDasharray={RING} strokeDashoffset={RING * (1 - left)} />
          </svg>
          <span className="ms-ring-in">
            <b className="num">{toFaDigits(daysLeft)}</b>
            <span className="xs mute">{daysLeft > 0 ? 'روز مانده' : 'تمام شده'}</span>
          </span>
        </div>

        <div className="col ms-main">
          <span className="rw ms-title">
            <span className="t1">پلن {p.mine.name}</span>
            <span className={`tag ${tag.tone}`}>{tag.label}</span>
          </span>
          <span className="mute">
            {p.mineSeats > 1 ? `تا ${toFaDigits(p.mineSeats)} نفر` : 'یک نفر'}
            {last ? `، اشتراک ${termOf(last.period).name}` : ''}
          </span>

          <div className="ms-line">
            <span className="ms-track" aria-hidden="true">
              <span className="ms-done" style={{ width: `${elapsed * 100}%` }} />
              <span className="ms-now" style={{ insetInlineStart: `${elapsed * 100}%` }} />
            </span>
            <span className="ms-dates">
              <span>
                <span className="xs mute">شروع</span>
                <b className="sm">{formatDate(new Date(start))}</b>
              </span>
              <span className="ms-end">
                <span className="xs mute">{daysLeft > 0 ? 'پایان اعتبار' : 'تمام شد در'}</span>
                <b className="sm">{formatDate(new Date(end))}</b>
              </span>
            </span>
          </div>
        </div>
      </section>

      <div className="ms-stats">
        <div className="card ms-stat">
          <span className="ms-stat-ic" aria-hidden="true">
            <Icon name="users" size="s" />
          </span>
          <span className="xs mute">همکاران دفتر</span>
          <b>
            {toFaDigits(p.used)} از {toFaDigits(p.mineSeats)} نفر
          </b>
          <span className="ms-meter" aria-hidden="true">
            <span className={full ? 'warn' : ''} style={{ width: `${Math.min(100, (p.used / p.mineSeats) * 100)}%` }} />
          </span>
        </div>
        <div className="card ms-stat">
          <span className="ms-stat-ic" aria-hidden="true">
            <Icon name="receipt" size="s" />
          </span>
          <span className="xs mute">آخرین پرداخت</span>
          <b>{last ? `${formatGrouped(last.amount)} تومان` : 'ثبت شده توسط پشتیبانی'}</b>
          {last?.paidAt && <span className="xs mute">{formatDate(new Date(last.paidAt))}</span>}
        </div>
        <Link className="card ms-stat ms-link" to="/settings" viewTransition>
          <span className="ms-stat-ic" aria-hidden="true">
            <Icon name="doc" size="s" />
          </span>
          <span className="xs mute">رسیدها و تاریخچه</span>
          <b className="rw" style={{ gap: 4 }}>
            دیدن در تنظیمات
            <Icon name="chl" size="s" />
          </b>
        </Link>
      </div>

      {p.manager ? (
        <section className="card ms-renew" aria-labelledby="ms-renew">
          <div className="ms-renew-head">
            <div className="col" style={{ gap: 4, minWidth: 0 }}>
              <h2 id="ms-renew" className="t2">
                {up ? 'ارتقای اشتراک' : daysLeft > 0 ? 'تمدید اشتراک' : 'فعال‌سازی دوباره'}
              </h2>
              <p className="mute sm" style={{ margin: 0 }}>
                {up
                  ? 'همکار بیشتر بیاورید؛ ارزش روزهای باقی‌ماندهٔ پلن فعلی به پلن تازه منتقل می‌شود.'
                  : daysLeft > 0
                    ? 'مدت تازه به آخر اشتراک فعلی اضافه می‌شود؛ هیچ روزی از دست نمی‌رود.'
                    : 'با تمدید، ثبت و ویرایش همین حالا باز می‌شود.'}
              </p>
            </div>
            {ups[0] && (
              <div className="seg" role="group" aria-label="نوع خرید">
                <button type="button" aria-pressed={!up} onClick={() => p.onTarget(null, null)}>
                  تمدید همین پلن
                </button>
                <button type="button" aria-pressed={up} onClick={() => !up && ups[0] && pick(ups[0])}>
                  <Icon name="up" size="s" />
                  ارتقا
                </button>
              </div>
            )}
          </div>

          {up && (
            <div className="ms-ups" role="radiogroup" aria-label="پلن تازه">
              {ups.map((x) => {
                const on = x.id === p.target.id;
                const n = on ? p.targetSeats : x.id === p.mine.id ? p.mineSeats + 1 : x.seats;
                return (
                  <label key={x.id} className={`ms-term${on ? ' on' : ''}`}>
                    <input type="radio" name="up" className="visually-hidden" checked={on} onChange={() => pick(x)} />
                    <span className="ms-dot" aria-hidden="true" />
                    <span className="col" style={{ gap: 2, minWidth: 0 }}>
                      <b>{x.id === p.mine.id ? `نفر بیشتر در پلن ${x.name}` : `پلن ${x.name}`}</b>
                      <span className="xs mute">
                        {x.id === p.mine.id
                          ? `الان ${toFaDigits(p.mineSeats)} نفر`
                          : x.extra
                            ? `تا ${toFaDigits(x.seats)} نفر، بیشتر هم می‌شود`
                            : `تا ${toFaDigits(x.seats)} نفر`}
                      </span>
                    </span>
                    <span className="col ms-term-price">
                      <b className="num">{formatGrouped(monthlyOf(x, n))}</b>
                      <span className="xs mute">تومان در ماه</span>
                    </span>
                  </label>
                );
              })}
              {p.target.extra && (
                <div className="pl-seatbox">
                  <span className="pl-step">
                    <span className="sm sb">تعداد نفرات</span>
                    <span className="pl-stepper">
                      <button
                        type="button"
                        aria-label="یک نفر بیشتر"
                        disabled={p.targetSeats >= p.target.extra.max}
                        onClick={() => p.onTarget(p.target.id, p.targetSeats + 1)}
                      >
                        <Icon name="plus" size="s" />
                      </button>
                      <span className="num" aria-live="polite">
                        {toFaDigits(p.targetSeats)}
                      </span>
                      <button
                        type="button"
                        aria-label="یک نفر کمتر"
                        disabled={p.targetSeats <= Math.max(minSeats, p.used)}
                        onClick={() => p.onTarget(p.target.id, p.targetSeats - 1)}
                      >
                        <span className="pl-minus" />
                      </button>
                    </span>
                  </span>
                  <span className="xs mute">
                    {toFaDigits(p.target.seats)} نفر در قیمت پایه؛ هر نفر بیشتر ماهی {formatGrouped(p.target.extra.monthly)} تومان
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="ms-terms" role="radiogroup" aria-label="مدت">
            {TERMS.map((x) => {
              const sum = priceOf(p.target, x.id, p.targetSeats);
              const per = perMonthOf(p.target, x.id, p.targetSeats);
              const save = x.gift || x.off ? Math.round((1 - per / priceOf(p.target, 'month', p.targetSeats)) * 100) : 0;
              return (
                <label key={x.id} className={`ms-term${x.id === p.period ? ' on' : ''}`}>
                  <input type="radio" name="renew" className="visually-hidden" checked={x.id === p.period} onChange={() => p.onPeriod(x.id)} />
                  <span className="ms-dot" aria-hidden="true" />
                  <span className="col" style={{ gap: 2, minWidth: 0 }}>
                    <span className="rw" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <b>{TERM_LABEL[x.id]}</b>
                      {x.gift > 0 && <span className="pl-gift">{toFaDigits(x.gift)} ماه هدیه</span>}
                    </span>
                    <span className="xs mute">{x.months > 1 ? `ماهی ${formatGrouped(per)} تومان` : 'بدون تخفیف'}</span>
                  </span>
                  <span className="col ms-term-price">
                    <b className="num">{formatGrouped(sum)}</b>
                    {save > 0 ? <span className="pl-save">{toFaDigits(save)}٪ ارزان‌تر</span> : <span className="xs mute">تومان</span>}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="ms-pay">
            {up ? (
              <div className="ms-compare">
                <span className="col">
                  <span className="xs mute">الان</span>
                  <b className="sm">
                    پلن {p.mine.name}، {toFaDigits(p.mineSeats)} نفر
                  </b>
                  <span className="xs mute">تا {formatDate(new Date(end))}</span>
                </span>
                <Icon name="fwd" size="s" />
                <span className="col">
                  <span className="xs mute">بعد از ارتقا</span>
                  <b className="sm">
                    پلن {p.target.name}، {toFaDigits(p.targetSeats)} نفر
                  </b>
                  {p.until && <span className="xs sb">تا {formatDate(new Date(p.until))}</span>}
                </span>
              </div>
            ) : (
              <span className="col" style={{ gap: 2 }}>
                {p.until && (
                  <span className="sm">
                    اعتبار تازه تا <b>{formatDate(new Date(p.until))}</b>
                  </span>
                )}
                <span className="xs mute">
                  {toFaDigits(t.months + t.gift)} ماه {t.gift ? `(${toFaDigits(t.gift)} ماه هدیه)` : ''}، پلن {p.mine.name}
                </span>
              </span>
            )}
            <div className="col pl-pay">
              <button type="button" className="btn btn-p btn-lg" disabled={!p.canPay || p.opening} onClick={p.onPay}>
                <Icon name="card" size="s" />
                {p.opening ? 'در حال رفتن به بانک…' : `${up ? 'ارتقا' : 'تمدید'}، ${formatGrouped(amount)} تومان`}
              </button>
              <span className="xs mute rw pl-trust">{p.note}</span>
            </div>
          </div>
        </section>
      ) : (
        <p className="rw sm pl-agent">
          <Icon name="lock" size="s" />
          تمدید اشتراک را مدیر دفتر انجام می‌دهد.
        </p>
      )}
    </div>
  );
}
