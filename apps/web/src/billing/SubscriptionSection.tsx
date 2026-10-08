import { Link } from 'react-router';
import { Icon } from '@kelid/ui';
import { formatGrouped, planById, toFaDigits } from '@kelid/core';
import { useAuth, useMember } from '../auth/AuthContext';
import { useLicense } from './license';
import { daysLeftText, phaseTag, planName, untilText, useBilling } from './useBilling';
import './billing.css';

/** کارت «اشتراک» در تنظیمات: پلن و تاریخ پایان، راه تمدید برای مدیر، و رسید پرداخت‌ها. */
export function SubscriptionSection() {
  const { status } = useAuth();
  const { manager } = useMember();
  const lic = useLicense();
  const { billing } = useBilling();

  if (status !== 'signedIn') {
    return (
      <section aria-labelledby="sub" className="card" style={{ padding: 24, display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
        <span className="ib sub-ic" aria-hidden="true">
          <Icon name="gem" size="l" />
        </span>
        <div className="col" style={{ flex: '1 1 260px' }}>
          <h2 id="sub" className="t2">
            اشتراک
          </h2>
          <span className="mute sm">این نسخه فقط روی همین دستگاه کار می‌کند و اشتراک لازم ندارد.</span>
        </div>
      </section>
    );
  }

  const tag = lic ? phaseTag[lic.phase] : null;
  const seats = billing?.seats ?? lic?.seats;
  const plan = planById(billing?.plan ?? lic?.plan ?? '');
  const expires = billing?.expiresAt ?? (lic ? new Date(lic.expiresAt).toISOString() : null);
  const trial = billing?.trial ?? lic?.trial;

  return (
    <section aria-labelledby="sub" className="card col" style={{ padding: 24, gap: 18 }}>
      <div className="sub-head">
        <span className="ib sub-ic" aria-hidden="true">
          <Icon name="gem" size="l" />
        </span>
        <div className="col" style={{ gap: 4, minWidth: 0 }}>
          <span className="rw" style={{ gap: 10, flexWrap: 'wrap' }}>
            <h2 id="sub" className="t2">
              اشتراک
            </h2>
            {tag && <span className={`tag ${tag.tone}`}>{tag.label}</span>}
          </span>
          <span className="mute sm sub-facts">
            {plan ? <span>{trial ? `دورهٔ آزمایشی (پلن ${plan.name})` : `پلن ${plan.name}`}</span> : <span>در حال خواندن وضعیت…</span>}
            {seats !== undefined && <span>تا {toFaDigits(seats)} نفر</span>}
            {expires && (
              <span>
                {lic && lic.daysLeft <= 0 ? 'تمام شد در' : 'تا'} {untilText(expires)}
                {lic && lic.daysLeft > 0 ? ` (${daysLeftText(lic)})` : ''}
              </span>
            )}
          </span>
        </div>
        {manager ? (
          <Link className="btn btn-p" to="/plans" viewTransition>
            <Icon name="card" size="s" />
            {trial ? 'خرید اشتراک' : 'تمدید یا تغییر پلن'}
          </Link>
        ) : (
          <Link className="btn btn-s" to="/plans" viewTransition>
            دیدن پلن‌ها
          </Link>
        )}
      </div>
      {!manager && <span className="xs mute">پرداخت و تمدید را مدیر دفتر انجام می‌دهد.</span>}

      {billing && billing.payments.length > 0 && (
        <div className="col" style={{ gap: 8 }}>
          <span className="sb sm">رسید پرداخت‌ها</span>
          <ul className="sub-list">
            {billing.payments.map((p) => (
              <li key={p.id}>
                <span className="col" style={{ minWidth: 0 }}>
                  <span className="sb">
                    پلن {planName(p.plan)}، {p.period === 'year' ? 'یک‌ساله' : 'یک‌ماهه'}
                  </span>
                  <span className="xs mute">
                    {p.paidAt ? untilText(p.paidAt) : ''}
                    {p.refId ? (
                      <>
                        ، کد پیگیری <span className="pl-ref">{toFaDigits(p.refId)}</span>
                      </>
                    ) : null}
                  </span>
                </span>
                <span className="num">
                  {formatGrouped(p.amount)} <span className="xs mute">تومان</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
