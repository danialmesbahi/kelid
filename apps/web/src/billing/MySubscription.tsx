import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Icon } from '@kelid/ui';
import { formatDate, formatGrouped, perMonthOf, priceOf, termDays, TERMS, termOf, toFaDigits, type LicenseInfo, type Period, type Plan } from '@kelid/core';
import type { Billing } from '../auth/api';
import { phaseTag } from './useBilling';

const DAY = 86_400_000;
const TERM_LABEL: Record<Period, string> = { month: 'یک ماه', half: 'شش ماه', year: 'یک سال' };
// حلقهٔ روزهای مانده: محیط دایره با شعاع ۵۲ در viewBox ۱۲۰.
const RING = 2 * Math.PI * 52;

interface Props {
  plan: Plan;
  seats: number;
  used: number;
  expiresAt: string;
  lic: LicenseInfo | null;
  billing: Billing | null;
  manager: boolean;
  period: Period;
  onPeriod: (p: Period) => void;
  /** پایان اعتبار اگر همین حالا با مدت انتخاب‌شده تمدید شود. */
  until: number | null;
  canPay: boolean;
  opening: boolean;
  onPay: () => void;
  note: ReactNode;
  first: boolean;
}

/**
 * صفحهٔ اشتراک دفتری که خرید کرده: به جای فهرست پلن‌ها، وضعیت اشتراک خودش و یک راه ساده برای تمدید همان پلن.
 * تغییر پلن در برنامه نیست تا حساب روزها و مبلغ ساده و بی‌خطا بماند؛ پشتیبانی از پنل فروشنده پلن را عوض می‌کند.
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
  const full = p.used >= p.seats;
  const t = termOf(p.period);
  const amount = priceOf(p.plan, p.period, p.seats);

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
            <span className="t1">پلن {p.plan.name}</span>
            <span className={`tag ${tag.tone}`}>{tag.label}</span>
          </span>
          <span className="mute">
            {p.seats > 1 ? `تا ${toFaDigits(p.seats)} نفر` : 'یک نفر'}
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
            {toFaDigits(p.used)} از {toFaDigits(p.seats)} نفر
          </b>
          <span className="ms-meter" aria-hidden="true">
            <span className={full ? 'warn' : ''} style={{ width: `${Math.min(100, (p.used / p.seats) * 100)}%` }} />
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
          <div className="col" style={{ gap: 4 }}>
            <h2 id="ms-renew" className="t2">
              {daysLeft > 0 ? 'تمدید اشتراک' : 'فعال‌سازی دوباره'}
            </h2>
            <p className="mute sm" style={{ margin: 0 }}>
              {daysLeft > 0 ? 'مدت تازه به آخر اشتراک فعلی اضافه می‌شود؛ هیچ روزی از دست نمی‌رود.' : 'با تمدید، ثبت و ویرایش همین حالا باز می‌شود.'}
            </p>
          </div>

          <div className="ms-terms" role="radiogroup" aria-label="مدت تمدید">
            {TERMS.map((x) => {
              const sum = priceOf(p.plan, x.id, p.seats);
              const per = perMonthOf(p.plan, x.id, p.seats);
              const save = x.gift || x.off ? Math.round((1 - per / priceOf(p.plan, 'month', p.seats)) * 100) : 0;
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
            <span className="col" style={{ gap: 2 }}>
              {p.until && (
                <span className="sm">
                  اعتبار تازه تا <b>{formatDate(new Date(p.until))}</b>
                </span>
              )}
              <span className="xs mute">
                {toFaDigits(t.months + t.gift)} ماه {t.gift ? `(${toFaDigits(t.gift)} ماه هدیه)` : ''}، پلن {p.plan.name}
              </span>
            </span>
            <div className="col pl-pay">
              <button type="button" className="btn btn-p btn-lg" disabled={!p.canPay || p.opening} onClick={p.onPay}>
                <Icon name="card" size="s" />
                {p.opening ? 'در حال رفتن به بانک…' : `تمدید، ${formatGrouped(amount)} تومان`}
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
