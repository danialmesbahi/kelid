import { useState } from 'react';
import { Link } from 'react-router';
import { Icon } from '@kelid/ui';
import { formatDate, formatGrouped, termDays, termOf, toFaDigits, type LicenseInfo, type Plan } from '@kelid/core';
import type { Billing } from '../auth/api';
import { NewTicketDialog } from '../support/NewTicketDialog';
import { phaseTag } from './useBilling';

const DAY = 86_400_000;
// حلقهٔ روزهای مانده: محیط دایره با شعاع ۵۲ در viewBox ۱۲۰.
const RING = 2 * Math.PI * 52;

export const FEATURES = [
  'فایل، مشتری، بازدید و قرارداد بی‌شمار',
  'همگام روی کامپیوتر، گوشی و مرورگر',
  'کار کامل بدون اینترنت',
  'پشتیبان امن روی سرور دفتر',
  'عکس فایل‌ها با کیفیت کامل',
  'به‌روزرسانی رایگان',
];

interface Props {
  /** پلن و نفرات فعلی دفتر. */
  mine: Plan;
  mineSeats: number;
  used: number;
  expiresAt: string;
  lic: LicenseInfo | null;
  billing: Billing | null;
  manager: boolean;
  first: boolean;
}

/**
 * صفحهٔ اشتراک دفتری که خرید کرده: به جای فهرست پلن‌ها فقط وضعیت اشتراک خودش.
 * تمدید و تغییر پلن در برنامه نیست تا حساب روزها و مبلغ جای خطا نداشته باشد؛ دفتر به پشتیبانی پیام می‌دهد.
 */
export function MySubscription(p: Props) {
  const [ask, setAsk] = useState(false);
  const now = Date.now();
  const end = Date.parse(p.expiresAt);
  const last = p.billing?.payments[0];
  const start = last?.paidAt ? Date.parse(last.paidAt) : end - termDays(last?.period ?? 'year') * DAY;
  const daysLeft = p.lic?.daysLeft ?? Math.max(0, Math.ceil((end - now) / DAY));
  const total = Math.max(DAY, end - start);
  const left = Math.min(1, Math.max(0, (end - now) / total));
  const elapsed = 1 - left;
  const totalDays = Math.round(total / DAY);
  const usedDays = Math.min(totalDays, Math.max(0, Math.floor((now - start) / DAY)));
  const phase = p.lic?.phase ?? (daysLeft > 0 ? 'active' : 'expired');
  const tag = phaseTag[phase];
  const tone = phase === 'expired' || phase === 'suspended' ? 'bad' : phase === 'ending' || phase === 'stale' ? 'warn' : '';
  const full = p.used >= p.mineSeats;
  const soon = phase === 'ending' || phase === 'expired';

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
          {daysLeft > 0 && (
            <span className="xs mute">
              {toFaDigits(usedDays)} روز گذشته از {toFaDigits(totalDays)} روز
            </span>
          )}

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

      <section className="card ms-incl" aria-labelledby="ms-incl">
        <h2 id="ms-incl" className="sm sb">
          در اشتراک شما
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

      <section className={`card ms-help${soon ? ' on' : ''}`} aria-labelledby="ms-help">
        <span className="ms-stat-ic" aria-hidden="true">
          <Icon name="msg" size="s" />
        </span>
        <div className="col" style={{ gap: 4, minWidth: 0 }}>
          <h2 id="ms-help" className="sm sb">
            {phase === 'expired' ? 'اشتراک تمام شده؛ برای تمدید پیام بدهید' : 'تمدید یا تغییر پلن'}
          </h2>
          <p className="xs mute" style={{ margin: 0 }}>
            {p.manager
              ? 'به پشتیبانی کلید پیام بدهید؛ همکاران ما مبلغ و تاریخ تازه را با شما هماهنگ می‌کنند و کار را انجام می‌دهند.'
              : 'تمدید و تغییر پلن را مدیر دفتر با پشتیبانی کلید هماهنگ می‌کند.'}
          </p>
        </div>
        {p.manager && (
          <button type="button" className={soon ? 'btn btn-p' : 'btn btn-s'} onClick={() => setAsk(true)}>
            <Icon name="msg" size="s" />
            پیام به پشتیبانی
          </button>
        )}
      </section>

      {ask && (
        <NewTicketDialog
          topic="billing"
          subject="تمدید یا تغییر پلن"
          text={`می‌خواهم اشتراک دفترم (پلن ${p.mine.name}، ${toFaDigits(p.mineSeats)} نفر) را تمدید کنم / پلنم را تغییر بدهم.`}
          onClose={() => setAsk(false)}
        />
      )}
    </div>
  );
}
