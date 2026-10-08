/**
 * پلن‌های اشتراک و حساب مدت اعتبار؛ هم سرور (قیمت و مدت واقعی) و هم برنامه (نمایش و پیش‌نمایش تاریخ) همین را می‌خوانند.
 * قیمت‌ها موقت‌اند تا صاحب کار قیمت نهایی را بگوید (docs/TECH_STACK.md → تصمیم‌ها). مبلغ به تومان؛ درگاه ریال می‌گیرد.
 */

export type PlanId = 'solo' | 'office' | 'pro';
export type Period = 'month' | 'year';

export interface Plan {
  id: PlanId;
  name: string;
  /** چند نفر (عضو + دعوت باز) در دفتر جا می‌شوند. */
  seats: number;
  /** قیمت یک ماه به تومان. */
  monthly: number;
  blurb: string;
}

export const PLANS: readonly Plan[] = [
  { id: 'solo', name: 'تک‌نفره', seats: 1, monthly: 190_000, blurb: 'برای مشاوری که تنها کار می‌کند' },
  { id: 'office', name: 'دفتر', seats: 5, monthly: 490_000, blurb: 'برای بیشتر دفترهای املاک' },
  { id: 'pro', name: 'دفتر بزرگ', seats: 15, monthly: 990_000, blurb: 'برای دفترهای پرهمکار' },
];

/** پلن دورهٔ آزمایشی دفتر تازه؛ همان جای پیش‌فرض دفترها (offices.seats). */
export const TRIAL_PLAN: PlanId = 'office';
export const TRIAL_DAYS = 14;
/** سالانه = ده ماه؛ دو ماه هدیه. */
export const YEAR_MONTHS = 10;
const DAY = 86_400_000;
export const PERIOD_DAYS: Record<Period, number> = { month: 30, year: 365 };
/** از چند روز مانده به پایان، برنامه یادآوری می‌کند. */
export const WARN_DAYS = 7;
/** دستگاهی که این‌قدر به سرور سر نزده، تا یک بار وصل نشود فقط‌خواندنی است (اشتراک لغوشده یا معلق دیر نماند). */
export const OFFLINE_GRACE_DAYS = 14;

export function planById(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

/** مبلغ یک خرید به تومان. */
export function priceOf(plan: Plan, period: Period): number {
  return period === 'year' ? plan.monthly * YEAR_MONTHS : plan.monthly;
}

export interface SubscriptionState {
  plan: PlanId;
  trial: boolean;
  /** پایان اعتبار، ISO. */
  expiresAt: string;
}

/**
 * پایان اعتبار بعد از خرید. روزهای باقی‌مانده هدر نمی‌روند: روزهای آزمایشی و روزهای همان پلن کامل به آخر اضافه می‌شوند،
 * و با عوض کردن پلن، ارزش ریالی روزهای مانده به روزهای پلن تازه تبدیل می‌شود (ارتقا = روز کمتر، کاهش = روز بیشتر).
 */
export function nextExpiry(cur: SubscriptionState, plan: Plan, period: Period, now: number): number {
  const left = Math.max(0, Date.parse(cur.expiresAt) - now);
  const old = planById(cur.plan);
  const carry = cur.trial || !old || old.id === plan.id ? left : Math.floor((left * old.monthly) / plan.monthly);
  return now + carry + PERIOD_DAYS[period] * DAY;
}

/** آنچه سرور امضا می‌کند و دستگاه بی‌اینترنت هم با کلید عمومی می‌سنجد. زمان‌ها ثانیهٔ یونیکس. */
export interface LicensePayload {
  v: 1;
  off: string;
  plan: PlanId;
  seats: number;
  trial: boolean;
  /** پایان اشتراک. */
  exp: number;
  /** زمان سرور هنگام صدور. */
  iat: number;
  /** تا این زمان باید دوباره به سرور سر بزند. */
  chk: number;
  /** فروشنده دفتر را معلق کرده (پنل فروشنده). */
  sus?: boolean;
}

export type LicensePhase = 'active' | 'trial' | 'ending' | 'expired' | 'stale' | 'suspended';

export interface LicenseInfo {
  phase: LicensePhase;
  /** فقط خواندن: ثبت و ویرایش بسته است. */
  readOnly: boolean;
  plan: PlanId;
  seats: number;
  trial: boolean;
  expiresAt: number;
  /** روزهای کامل باقی‌مانده (گرد به بالا)؛ بعد از پایان صفر. */
  daysLeft: number;
}

/** وضعیت اشتراک در زمان now (میلی‌ثانیه). */
export function licenseInfo(p: LicensePayload, now: number): LicenseInfo {
  const expiresAt = p.exp * 1000;
  const left = expiresAt - now;
  const daysLeft = left > 0 ? Math.ceil(left / DAY) : 0;
  const phase: LicensePhase = p.sus
    ? 'suspended'
    : left <= 0
      ? 'expired'
      : now > p.chk * 1000
        ? 'stale'
        : daysLeft <= WARN_DAYS
          ? 'ending'
          : p.trial
            ? 'trial'
            : 'active';
  return {
    phase,
    readOnly: phase === 'expired' || phase === 'stale' || phase === 'suspended',
    plan: p.plan,
    seats: p.seats,
    trial: p.trial,
    expiresAt,
    daysLeft,
  };
}

/** متن ساده و یکدست بایت‌ها برای امضا؛ ترتیب کلیدها ثابت است تا سرور و برنامه یک چیز را بسنجند. */
export function encodeLicense(p: LicensePayload): string {
  const fixed: LicensePayload = {
    v: 1,
    off: p.off,
    plan: p.plan,
    seats: p.seats,
    trial: p.trial,
    exp: p.exp,
    iat: p.iat,
    chk: p.chk,
    ...(p.sus ? { sus: true } : {}),
  };
  return b64url(new TextEncoder().encode(JSON.stringify(fixed)));
}

/** بخش دادهٔ توکن مجوز («داده.امضا»)؛ امضا را بررسی نمی‌کند. */
export function decodeLicense(token: string): { payload: LicensePayload; body: string; sig: Uint8Array<ArrayBuffer> } | null {
  const [body, sig, extra] = token.split('.');
  if (!body || !sig || extra !== undefined || token.length > 1024) return null;
  try {
    const p = JSON.parse(new TextDecoder().decode(fromB64url(body))) as Partial<LicensePayload>;
    const ok =
      p.v === 1 &&
      typeof p.off === 'string' &&
      typeof p.plan === 'string' &&
      typeof p.seats === 'number' &&
      typeof p.trial === 'boolean' &&
      typeof p.exp === 'number' &&
      typeof p.iat === 'number' &&
      typeof p.chk === 'number';
    return ok ? { payload: p as LicensePayload, body, sig: fromB64url(sig) } : null;
  } catch {
    return null;
  }
}

export function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
