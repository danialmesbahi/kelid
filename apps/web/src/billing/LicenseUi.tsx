import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { Icon } from '@kelid/ui';
import { toFaDigits, type LicenseInfo } from '@kelid/core';
import { useAuth, useMember } from '../auth/AuthContext';
import { useToast } from '../layout/Toasts';
import { useLicense } from './license';
import { onBlockedWrite } from './readOnly';
import { daysLeftText, planName, untilText, useLicenseWatch } from './useBilling';
import './billing.css';

/** چرا ثبت بسته است، به زبان کاربر. */
function blockedText(l: LicenseInfo, manager: boolean): string {
  if (l.phase === 'suspended') return 'حساب دفتر موقتاً بسته شده است. برای باز شدنش با پشتیبانی کلید تماس بگیرید.';
  if (l.phase === 'stale') return 'کلید چند روز است به اینترنت وصل نشده. برای ثبت و ویرایش، یک بار به اینترنت وصل شوید.';
  return manager
    ? 'اشتراک دفتر تمام شده است. اطلاعات‌تان سر جایش است و دیده می‌شود؛ برای ثبت و ویرایش، اشتراک را تمدید کنید.'
    : 'اشتراک دفتر تمام شده است. اطلاعات‌تان سر جایش است و دیده می‌شود؛ برای ثبت و ویرایش، مدیر دفتر باید تمدید کند.';
}

const DISMISS = 'kelid.licenseBar';
const today = () => new Date().toDateString();

/**
 * بالای همهٔ صفحه‌ها: یادآوری چند روز مانده به پایان (قابل بستن برای امروز)، و بعد از پایان، توضیح فقط‌خواندنی (بسته نمی‌شود).
 * همین‌جا هم وقتی ثبت بسته است، هر دقیقه وضعیت از سرور پرسیده می‌شود تا با تمدید بی‌درنگ باز شود.
 */
export function LicenseBar() {
  const lic = useLicense();
  const { manager } = useMember();
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(DISMISS) === today();
    } catch {
      return false;
    }
  });
  useLicenseWatch(!!lic?.readOnly);
  if (!lic) return null;

  if (lic.readOnly) {
    return (
      <div className="lic-bar bad enter" role="status">
        <Icon name={lic.phase === 'stale' ? 'cloud' : 'lock'} />
        <span>{blockedText(lic, manager)}</span>
        {manager && lic.phase === 'expired' && (
          <span className="lic-acts">
            <Link className="btn btn-p" to="/plans" viewTransition>
              تمدید اشتراک
            </Link>
          </span>
        )}
      </div>
    );
  }
  if (lic.phase !== 'ending' || hidden) return null;
  return (
    <div className="lic-bar enter" role="status">
      <Icon name="bell" />
      <span>
        {lic.daysLeft === 1
          ? 'اشتراک دفتر امروز تمام می‌شود.'
          : `${toFaDigits(lic.daysLeft)} روز تا پایان ${lic.trial ? 'دورهٔ آزمایشی' : 'اشتراک دفتر'} مانده است.`}
        {manager ? ' برای اینکه کار دفتر نخوابد، از همین حالا تمدید کنید.' : ' به مدیر دفتر یادآوری کنید.'}
      </span>
      <span className="lic-acts">
        {manager && (
          <Link className="btn btn-p" to="/plans" viewTransition>
            {lic.trial ? 'خرید اشتراک' : 'تمدید'}
          </Link>
        )}
        <button
          type="button"
          className="ib ghost"
          aria-label="بستن یادآوری تا فردا"
          onClick={() => {
            setHidden(true);
            try {
              localStorage.setItem(DISMISS, today());
            } catch {
              /* فقط تا بستن صفحه */
            }
          }}
        >
          <Icon name="x" size="s" />
        </button>
      </span>
    </div>
  );
}

/** کارت کوچک پلن در نوار کناری؛ بی حساب کلید چیزی نشان نمی‌دهد. */
export function PlanLine() {
  const lic = useLicense();
  if (!lic) return null;
  const tone = lic.readOnly ? 'bad' : lic.phase === 'ending' ? 'warn' : '';
  // نوار: سهم روزهای مانده از یک دورهٔ معمول (آزمایشی ۱۴ روز، بقیه یک ماه).
  const fill = Math.max(lic.readOnly ? 100 : 4, Math.min(100, (lic.daysLeft / (lic.trial ? 14 : 30)) * 100));
  return (
    <>
      <span className="rw sm" style={{ justifyContent: 'space-between', gap: 8 }}>
        <span className="b">{lic.trial ? 'دورهٔ آزمایشی' : `پلن ${planName(lic.plan)}`}</span>
        <span className="xs num" style={{ color: tone ? `var(--${tone === 'bad' ? 'bad' : 'warn'})` : 'var(--mute)' }}>
          {lic.phase === 'suspended' ? 'معلق' : lic.phase === 'stale' ? 'نیاز به اینترنت' : daysLeftText(lic)}
        </span>
      </span>
      <span className="bar">
        <span className={tone} style={{ width: `${fill}%` }} />
      </span>
    </>
  );
}

/** نوشتنی که بسته بود: یک اعلان کوتاه با راه تمدید. در App ثبت می‌شود تا فرم‌های تمام‌صفحه را هم بپوشاند. */
export function ReadOnlyToast({ go }: { go: (to: string) => void }) {
  const toast = useToast();
  const lic = useLicense();
  const { manager } = useMember();
  useEffect(() => {
    onBlockedWrite(() => {
      if (!lic) return;
      const renew = manager && lic.phase === 'expired';
      const text =
        lic.phase === 'stale'
          ? 'ذخیره نشد؛ یک بار به اینترنت وصل شوید'
          : lic.phase === 'suspended'
            ? 'ذخیره نشد؛ حساب دفتر معلق است'
            : 'ذخیره نشد؛ اشتراک دفتر تمام شده است';
      toast(text, renew ? { label: 'تمدید', run: () => go('/plans') } : undefined);
    });
    return () => onBlockedWrite(null);
  }, [toast, lic, manager, go]);
  return null;
}

/** فرم‌های ثبت و ویرایش (تمام‌صفحه): بعد از پایان اشتراک به جای فرمی که ذخیره نمی‌شود، توضیح و راه تمدید. */
export function WriteGate({ children }: { children: ReactNode }) {
  const lic = useLicense();
  const { manager } = useMember();
  const navigate = useNavigate();
  const { status } = useAuth();
  if (status !== 'signedIn' || !lic?.readOnly) return children;
  return (
    <div className="ro-page">
      <section className="pl-result card enter" role="alert">
        <span className="pl-mark pl-bad" aria-hidden="true">
          <Icon name="lock" size="l" />
        </span>
        <h1 className="t2">
          {lic.phase === 'stale' ? 'اول به اینترنت وصل شوید' : lic.phase === 'suspended' ? 'حساب دفتر معلق است' : 'اشتراک دفتر تمام شده است'}
        </h1>
        <p className="mute">{blockedText(lic, manager)}</p>
        {lic.phase === 'expired' && <p className="xs mute">پایان اشتراک: {untilText(lic.expiresAt)}</p>}
        <div className="pl-acts">
          {manager && lic.phase === 'expired' && (
            <Link className="btn btn-p btn-lg" to="/plans" viewTransition>
              تمدید اشتراک
            </Link>
          )}
          <button type="button" className="btn btn-s btn-lg" onClick={() => (history.length > 1 ? navigate(-1) : navigate('/', { viewTransition: true }))}>
            برگشت
          </button>
        </div>
      </section>
    </div>
  );
}
