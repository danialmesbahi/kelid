import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@kelid/ui';
import { formatDate, formatGrouped, planById, toFaDigits } from '@kelid/core';
import { ApiError, type OfficeStatus, type PaymentStatus } from './api';
import { useAuth } from './auth';
import { onLiveChange } from './live';
import type { AdminApi } from './api';

export const statusTag: Record<OfficeStatus, { label: string; tone: '' | 'ok' | 'warn' | 'bad' }> = {
  active: { label: 'فعال', tone: 'ok' },
  trial: { label: 'آزمایشی', tone: '' },
  ending: { label: 'رو به پایان', tone: 'warn' },
  expired: { label: 'تمام شده', tone: 'bad' },
  suspended: { label: 'معلق', tone: 'bad' },
};

export const payTag: Record<PaymentStatus, { label: string; tone: '' | 'ok' | 'warn' | 'bad' }> = {
  paid: { label: 'موفق', tone: 'ok' },
  pending: { label: 'در انتظار بانک', tone: 'warn' },
  failed: { label: 'ناموفق', tone: 'bad' },
  canceled: { label: 'لغو شده', tone: '' },
};

export const planName = (id: string) => planById(id)?.name ?? id;
export const dateText = (iso: string) => formatDate(new Date(iso));
export const toman = (n: number) => `${formatGrouped(n)} تومان`;

/** «۱۲ روز مانده»، «امروز تمام می‌شود»، «۳ روز پیش تمام شد». */
export function leftText(iso: string): string {
  const days = Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000);
  if (days > 1) return `${toFaDigits(days)} روز مانده`;
  if (days === 1) return 'امروز تمام می‌شود';
  if (days === 0) return 'امروز تمام شد';
  return `${toFaDigits(-days)} روز پیش تمام شد`;
}

/** آخرین فعالیت به زبان آدم: «همین حالا»، «۳ ساعت پیش»، «۵ روز پیش»، بعد از یک ماه تاریخ. */
export function ago(iso: string | null): string {
  if (!iso) return 'هنوز وارد نشده';
  const min = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (min < 2) return 'همین حالا';
  if (min < 60) return `${toFaDigits(min)} دقیقه پیش`;
  if (min < 24 * 60) return `${toFaDigits(Math.round(min / 60))} ساعت پیش`;
  const days = Math.round(min / 60 / 24);
  if (days === 1) return 'دیروز';
  if (days < 30) return `${toFaDigits(days)} روز پیش`;
  return dateText(iso);
}

/** شمارهٔ موبایل خوانا: ۰۹۱۲ ۱۲۳ ۴۵۶۷ (همیشه چپ‌به‌راست). */
export function Phone({ value }: { value: string }) {
  const s = value.length === 11 ? `${value.slice(0, 4)} ${value.slice(4, 7)} ${value.slice(7)}` : value;
  return (
    <span dir="ltr" className="num ph-n">
      {toFaDigits(s)}
    </span>
  );
}

export function errorText(e: unknown): string {
  if (!(e instanceof ApiError)) return 'کار انجام نشد؛ دوباره امتحان کنید.';
  switch (e.code) {
    case 'offline':
      return 'به سرور وصل نشد؛ اینترنت را بررسی کنید.';
    case 'too_small':
      return 'این پلن برای تعداد همکاران این دفتر کوچک است.';
    case 'not_found':
      return 'این دفتر پیدا نشد.';
    case 'already':
      return 'وضعیت دفتر همین حالا عوض شده است؛ صفحه به‌روز شد.';
    case 'too_many':
      return 'چند بار پشت هم امتحان شد؛ کمی بعد دوباره بزنید.';
    case 'bad_file':
      return 'این نوع فایل پذیرفته نیست؛ فقط عکس، PDF، Word، Excel یا متن.';
    case 'too_big':
      return 'جمع پیوست‌های هر پیام حداکثر ۵ مگابایت است.';
    default:
      return 'کار انجام نشد؛ دوباره امتحان کنید.';
  }
}

/** اسکلت فقط وقتی کار بیشتر از ۱۲۰ میلی‌ثانیه طول بکشد دیده می‌شود (بدون چرخنده). */
export function useSlow(pending: boolean, ms = 120): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!pending) {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), ms);
    return () => clearTimeout(t);
  }, [pending, ms]);
  return slow;
}

// داده‌ای که یک بار آمده، با برگشتن به همان صفحه بی‌درنگ دیده می‌شود و پشت صحنه تازه می‌شود.
const cache = new Map<string, unknown>();

/**
 * watch: با خبر زندهٔ کدام دفتر بی‌صدا تازه شود؛ نداده = هر تغییری (فهرست‌ها و آمار)، رشته = فقط همان دفتر.
 * چند خبر پشت هم فقط یک درخواست می‌سازند: تا جواب قبلی نیامده، درخواست تازه نمی‌رود.
 */
/** keep: تا دادهٔ کلید تازه برسد، دادهٔ قبلی (مثلاً فیلتر قبلی فهرست) سر جایش می‌ماند تا صفحه خالی نشود و نپرد. */
export function useLoad<T>(key: string, fn: (api: AdminApi, token: string) => Promise<T>, watch?: string, keep = false) {
  const { call } = useAuth();
  // from: دادهٔ data مال کدام کلید است (با keep ممکن است هنوز مال کلید قبلی باشد)
  const [state, setState] = useState<{ key: string; from: string; data: T | undefined; error: unknown; pending: boolean }>(() => ({
    key,
    from: key,
    data: cache.get(key) as T | undefined,
    error: null,
    pending: true,
  }));
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const seq = useRef(0);
  const live = useRef({ busy: false, again: false });

  const load = useCallback(() => {
    const n = ++seq.current;
    setState((s) =>
      s.from === key || !cache.has(key) ? { ...s, key, error: null, pending: true } : { key, from: key, data: cache.get(key) as T, error: null, pending: true },
    );
    return call((a, t) => fnRef.current(a, t)).then(
      (data) => {
        cache.set(key, data);
        if (n === seq.current) setState({ key, from: key, data, error: null, pending: false });
      },
      (error: unknown) => void (n === seq.current && setState((s) => ({ ...s, error, pending: false }))),
    );
  }, [key, call]);
  useEffect(() => void load(), [load]);

  useEffect(() => {
    const l = live.current;
    const quiet = () => {
      if (l.busy) return void (l.again = true);
      l.busy = true;
      const n = ++seq.current;
      // تازه کردن بی‌صدا: داده‌ای که دیده می‌شود سر جایش می‌ماند تا دادهٔ تازه برسد.
      void call((a, t) => fnRef.current(a, t))
        .then(
          (data) => {
            cache.set(key, data);
            if (n === seq.current) setState({ key, from: key, data, error: null, pending: false });
          },
          () => {},
        )
        .finally(() => {
          l.busy = false;
          if (l.again) {
            l.again = false;
            quiet();
          }
        });
    };
    return onLiveChange((ids) => {
      if (watch === undefined || !ids.length || ids.includes(watch)) quiet();
    });
  }, [key, call, watch]);

  const set = useCallback(
    (data: T) => {
      cache.set(key, data);
      setState({ key, from: key, data, error: null, pending: false });
    },
    [key],
  );
  const own = state.from === key ? state.data : (cache.get(key) as T | undefined);
  const data = own ?? (keep ? state.data : undefined);
  const reload = useCallback(() => void load(), [load]);
  return { data, stale: own === undefined && data !== undefined, error: state.error, pending: state.pending, reload, set };
}

/** فیلتر یا جستجو عوض شد: اگر ابزارهای فهرست به بالای صفحه چسبیده‌اند (گوشی)، صفحه جایی می‌رود که
 *  ابزارها همان‌جا بمانند و فهرست تازه از اولش دیده شود؛ نه این‌که ته فهرستِ کوتاه‌تر یا بالای صفحه بپرد. */
export function toListTop(tools: HTMLElement | null) {
  if (!tools || getComputedStyle(tools).position !== 'sticky') return;
  const stuck = parseFloat(getComputedStyle(tools).top) || 0;
  const parent = tools.parentElement;
  if (!parent) return;
  const target = parent.getBoundingClientRect().top + window.scrollY + (parseFloat(getComputedStyle(tools).marginTop) || 0) - stuck;
  if (window.scrollY > target) window.scrollTo(0, target);
}

/** حرکت ورود ردیف‌ها فقط برای فهرستی که صفحه با آن باز شد؛ با عوض شدن فیلتر یا جستجو ردیف‌ها دوباره نمی‌پرند. */
export function useEnter(key: string): string {
  const [first] = useState(key);
  return key === first ? 'stagger' : '';
}

/** پنجرهٔ روی صفحه: Esc و کلیک بیرون می‌بندند، فوکوس داخلش می‌ماند و بعد از بستن برمی‌گردد. */
export function Dialog({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('[data-autofocus]') ?? ref.current;
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab' || !ref.current) return;
      const f = [...ref.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea, select, a[href]')];
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) {
        e.preventDefault();
        f[f.length - 1]!.focus();
      } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
        e.preventDefault();
        f[0]!.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      before?.focus?.();
    };
  }, [onClose]);
  return createPortal(
    <div className="overlay ad-ov" onMouseDown={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`ad-dlg pop${wide ? ' wide' : ''}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="ad-dlg-hd">
          <h2 className="t2 sp">{title}</h2>
          <button type="button" className="ib ghost" aria-label="بستن" onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

type Toast = { id: number; text: string; bad?: boolean; action?: { label: string; run: () => void }; leaving?: boolean };
type Notify = (text: string, opts?: { bad?: boolean; action?: { label: string; run: () => void } }) => void;
const ToastCtx = createContext<Notify>(() => undefined);

/** اعلان کوچک پایین صفحه؛ همیشه فقط تازه‌ترین دیده می‌شود. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const dismiss = useCallback((id: number) => {
    setToasts((ts) => ts.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 220);
  }, []);
  const notify = useCallback<Notify>(
    (text, opts) => {
      const t: Toast = { id: ++seq.current, text, ...opts };
      setToasts((ts) => [...ts.map((x) => ({ ...x, leaving: true })), t]);
      setTimeout(() => setToasts((ts) => ts.filter((x) => !x.leaving || x.id === t.id)), 220);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => dismiss(t.id), t.action ? 6000 : 3500);
    },
    [dismiss],
  );
  return (
    <ToastCtx.Provider value={notify}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.leaving ? 'out' : ''}`}>
            <Icon name={t.bad ? 'warn' : 'check'} size="s" thick />
            <span className="sp sm">{t.text}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action!.run();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button type="button" className="toast-x" aria-label="بستن اعلان" onClick={() => dismiss(t.id)}>
              <Icon name="x" size="s" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
