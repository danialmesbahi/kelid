import { useCallback, useEffect, useState } from 'react';
import { formatDate, planById, toFaDigits, type LicenseInfo, type LicensePhase } from '@kelid/core';
import { ApiError, type Billing } from '../auth/api';
import { useAuth } from '../auth/AuthContext';
import { onLiveBilling } from '../sync/state';
import { adoptLicense } from './license';

// اشتراک تازه‌ای که اتصال زنده آورد، به همهٔ صفحه‌های باز (اشتراک، پلن‌ها) هم می‌رسد؛ یک درخواست برای همه.
const fresh = new Set<(b: Billing) => void>();

/** اشتراک دفتر از سرور، با مجوز تازه. بی اینترنت failed می‌شود و صفحه از مجوز روی دستگاه نشان می‌دهد. */
export function useBilling(): { billing: Billing | null; failed: boolean; reload: () => void } {
  const { api, withToken, session } = useAuth();
  const [billing, setBilling] = useState<Billing | null>(null);
  const [failed, setFailed] = useState(false);
  const office = session?.office.id;

  const reload = useCallback(() => {
    if (!api || !office) return;
    setFailed(false);
    withToken((t) => api.billing(t)).then(
      (b) => {
        setBilling(b);
        void adoptLicense(b.license, office);
      },
      () => setFailed(true),
    );
  }, [api, withToken, office]);
  useEffect(reload, [reload]);
  useEffect(() => {
    fresh.add(setBilling);
    return () => void fresh.delete(setBilling);
  }, []);
  return { billing, failed, reload };
}

/**
 * تمدید، تعلیق یا پرداخت (روی دستگاه دیگر یا از پنل کلید) ⇒ سرور همان لحظه خبر می‌دهد و این دستگاه بی‌آن‌که کسی
 * کاری بکند مجوز تازه می‌گیرد؛ قفل خواندنی همان لحظه باز یا بسته می‌شود.
 */
export function useLiveLicense() {
  const { api, withToken, session } = useAuth();
  const office = session?.office.id;
  useEffect(() => {
    if (!api || !office) return;
    let busy = false;
    let again = false;
    const pull = () => {
      if (busy) return void (again = true);
      busy = true;
      withToken((t) => api.billing(t))
        .then(async (b) => {
          await adoptLicense(b.license, office);
          fresh.forEach((f) => f(b));
        })
        .catch(() => {})
        .finally(() => {
          busy = false;
          if (again) {
            again = false;
            pull();
          }
        });
    };
    return onLiveBilling(pull);
  }, [api, office, withToken]);
}

/**
 * وقتی ثبت بسته است (اشتراک تمام شده، یا مدت زیادی بی‌اینترنت)، هر دقیقه که برنامه جلوی چشم است یک بار سر می‌زند؛
 * تا مدیر روی دستگاه دیگری تمدید کرد یا اینترنت برگشت، این دستگاه هم بی‌آن‌که کاری بکند باز شود.
 */
export function useLicenseWatch(readOnly: boolean) {
  const { api, withToken, session } = useAuth();
  const office = session?.office.id;
  useEffect(() => {
    if (!readOnly || !api || !office) return;
    const check = () => {
      if (document.visibilityState !== 'visible' || navigator.onLine === false) return;
      withToken((t) => api.billing(t)).then(
        (b) => adoptLicense(b.license, office),
        () => {},
      );
    };
    check();
    const id = setInterval(check, 60_000);
    addEventListener('online', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(id);
      removeEventListener('online', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, [readOnly, api, office, withToken]);
}

export const phaseTag: Record<LicensePhase, { label: string; tone: 'ok' | 'warn' | 'bad' | '' }> = {
  trial: { label: 'دورهٔ آزمایشی', tone: 'ok' },
  active: { label: 'فعال', tone: 'ok' },
  ending: { label: 'رو به پایان', tone: 'warn' },
  expired: { label: 'تمام شده', tone: 'bad' },
  stale: { label: 'نیاز به اینترنت', tone: 'warn' },
  suspended: { label: 'معلق', tone: 'bad' },
};

export function planName(id: string): string {
  return planById(id)?.name ?? id;
}

/** «۱۲ روز مانده» یا «امروز تمام می‌شود». */
export function daysLeftText(l: LicenseInfo): string {
  if (l.daysLeft <= 0) return 'تمام شده';
  if (l.daysLeft === 1) return 'امروز تمام می‌شود';
  return `${toFaDigits(l.daysLeft)} روز مانده`;
}

export function untilText(iso: string | number): string {
  return formatDate(new Date(iso));
}

export function payError(e: unknown): string {
  if (!(e instanceof ApiError)) return 'پرداخت شروع نشد؛ دوباره امتحان کنید';
  switch (e.code) {
    case 'offline':
      return 'به اینترنت وصل نیستید؛ برای پرداخت وصل شوید';
    case 'too_small':
      return 'این پلن برای تعداد همکاران دفتر کوچک است';
    case 'forbidden':
      return 'پرداخت را مدیر دفتر انجام می‌دهد';
    case 'no_gateway':
      return 'پرداخت آنلاین هنوز روی سرور فعال نشده است';
    case 'gateway':
      return 'درگاه بانک جواب نداد؛ چند لحظه دیگر دوباره امتحان کنید';
    case 'too_many':
      return 'چند بار پشت هم امتحان شد؛ کمی بعد دوباره بزنید';
    default:
      return 'پرداخت شروع نشد؛ دوباره امتحان کنید';
  }
}
