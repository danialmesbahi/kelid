import { Link, useSearchParams } from 'react-router';
import { Icon, Skeleton } from '@kelid/ui';
import { formatGrouped, termOf, toFaDigits } from '@kelid/core';
import type { PaymentStatus } from '../api';
import { useFlash } from '../live';
import { dateText, errorText, payTag, planName, useLoad, useSlow } from '../ui';

const FILTERS: Array<{ value: PaymentStatus | ''; label: string }> = [
  { value: '', label: 'همه' },
  { value: 'paid', label: 'موفق' },
  { value: 'pending', label: 'در انتظار بانک' },
  { value: 'failed', label: 'ناموفق' },
  { value: 'canceled', label: 'لغو شده' },
];

/** همهٔ پرداخت‌های درگاه، تازه‌ترین بالا؛ برای پیگیری با بانک کد پیگیری و کارت هم هست. */
export function Payments() {
  const [params, setParams] = useSearchParams();
  const status = (params.get('s') ?? '') as PaymentStatus | '';
  const list = useLoad(`payments:${status}`, (a, t) => a.payments(t, status || null));
  const slow = useSlow(!list.data && list.pending);
  const flash = useFlash();
  const paid = list.data?.filter((p) => p.status === 'paid') ?? [];

  return (
    <>
      <header className="hd">
        <div className="col" style={{ gap: 4 }}>
          <span className="eb">پنل فروشنده</span>
          <h1 className="t1">پرداخت‌ها</h1>
          <span className="mute sm">پرداخت‌های درگاه از همهٔ دفترها؛ تمدیدهای دستی در سابقهٔ هر دفتر است.</span>
        </div>
      </header>
      <div className="bd">
        <div className="ad-tools">
          <div className="seg" role="tablist" aria-label="وضعیت پرداخت">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected={status === f.value}
                onClick={() => setParams((p) => (f.value ? p.set('s', f.value) : p.delete('s'), p), { replace: true })}
              >
                {f.label}
              </button>
            ))}
          </div>
          {list.data && paid.length > 0 && (
            <span className="sm mute">
              {toFaDigits(paid.length)} پرداخت موفق، جمعاً <span className="b num">{formatGrouped(paid.reduce((s, p) => s + p.amount, 0))}</span> تومان
            </span>
          )}
        </div>

        {list.error && !list.data ? (
          <div className="card ad-empty">
            <Icon name="warn" size="l" />
            <span>{errorText(list.error)}</span>
            <button type="button" className="btn btn-s" onClick={list.reload}>
              دوباره امتحان کنید
            </button>
          </div>
        ) : !list.data ? (
          slow && (
            <div className="card ad-table" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="ad-row ad-prow skel-row">
                  <Skeleton w="60%" h={18} />
                  <Skeleton w="70%" h={16} />
                  <Skeleton w="60%" h={16} />
                  <Skeleton w={70} h={26} r={99} />
                  <Skeleton w="60%" h={16} />
                </div>
              ))}
            </div>
          )
        ) : list.data.length === 0 ? (
          <div className="card ad-empty">
            <Icon name="receipt" size="l" />
            <span>{status ? 'پرداختی با این وضعیت نیست.' : 'هنوز پرداختی انجام نشده است.'}</span>
          </div>
        ) : (
          <div className="card ad-table">
            <div className="ad-row ad-prow ad-head" aria-hidden="true">
              <span>دفتر</span>
              <span>پلن</span>
              <span>مبلغ</span>
              <span>وضعیت</span>
              <span>تاریخ و پیگیری</span>
            </div>
            <div className="stagger">
              {list.data.map((p) => (
                <Link key={p.id} to={`/offices/${p.office.id}`} viewTransition className={`ad-row ad-prow hov${flash.has(p.office.id) ? ' ad-flash' : ''}`}>
                  <span className="b ad-ell ad-cell-main">
                    {p.office.name}
                  </span>
                  <span className="sm">
                    {planName(p.plan)}، {termOf(p.period).name}
                  </span>
                  <span className="sm num b">
                    {formatGrouped(p.amount)} <span className="xs mute">تومان</span>
                  </span>
                  <span>
                    <span className={`tag ${payTag[p.status].tone}`}>{payTag[p.status].label}</span>
                  </span>
                  <span className="col">
                    <span className="sm">{dateText(p.paidAt ?? p.createdAt)}</span>
                    <span className="xs mute num">{p.refId ? `کد پیگیری ${toFaDigits(p.refId)}` : p.gateway === 'dev' ? 'درگاه آزمایشی' : 'بی کد پیگیری'}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
