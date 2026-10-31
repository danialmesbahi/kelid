/**
 * پلن‌های اشتراک و حساب مدت اعتبار؛ هم سرور (قیمت و مدت واقعی) و هم برنامه و سایت (نمایش و پیش‌نمایش تاریخ) همین حساب را می‌کنند.
 * خود فهرست پلن‌ها و قیمت‌ها روی سرور است و از پنل فروشنده عوض می‌شود؛ این‌جا فقط پیش‌فرض و حساب است.
 */

/** شناسهٔ پلن و مدت: چند حرف کوچک انگلیسی؛ پلن‌های تازه را پنل فروشنده با شناسهٔ تصادفی می‌سازد. */
export type PlanId = string;
export type Period = string;
export const CATALOG_ID = /^[a-z]{2,20}$/;

export interface Plan {
  id: PlanId;
  name: string;
  /** چند نفر (عضو + دعوت باز) در قیمت پایه جا می‌شوند. */
  seats: number;
  /** قیمت یک ماه به تومان. */
  monthly: number;
  blurb: string;
  /** پلنی که نفر اضافه می‌گیرد: قیمت ماهانهٔ هر نفر بیشتر از seats، و سقف کل نفرات. */
  extra?: { monthly: number; max: number };
  /** خط‌های کارت پلن در سایت معرفی. */
  features: string[];
  /** برچسب کارت برجسته (مثلاً «محبوب‌ترین»)؛ خالی یعنی کارت معمولی. */
  badge?: string;
  /** فروخته نمی‌شود و در سایت و برنامه نیست؛ دفترهایی که دارندش تا پایان اعتبار نگهش می‌دارند. */
  hidden?: boolean;
}

export interface Term {
  id: Period;
  name: string;
  /** ماه‌هایی که پولش داده می‌شود. */
  months: number;
  /** ماه‌های هدیه روی همان. */
  gift: number;
  /** درصد تخفیف روی قیمت ماه‌های پولی. */
  off: number;
  hidden?: boolean;
}

/** فهرست پلن‌ها و مدت‌های خرید؛ منبع اصلی جدول‌های plans و terms سرور است که پنل فروشنده عوضشان می‌کند. */
export interface Catalog {
  plans: Plan[];
  terms: Term[];
}

/**
 * فهرست پیش‌فرض: همان که migration در سرور می‌کارد، و تا برنامه یا سایت فهرست سرور را نگرفته نشان داده می‌شود.
 * مبلغ به تومان؛ درگاه ریال می‌گیرد.
 */
export const DEFAULT_CATALOG: Catalog = {
  plans: [
    {
      id: 'solo',
      name: 'تک‌نفره',
      seats: 1,
      monthly: 2_000_000,
      blurb: 'برای مشاوری که تنها کار می‌کند',
      features: ['فایل، مشتری، بازدید و قرارداد در یک‌جا', 'پیدا کردن خودکار فایل جور برای هر مشتری', 'کار کامل بدون اینترنت', 'روی ویندوز، مک و گوشی با هم'],
    },
    {
      id: 'office',
      name: 'دفتر',
      seats: 5,
      monthly: 5_000_000,
      blurb: 'برای بیشتر دفترهای املاک',
      features: ['هر همکار روی دستگاه خودش، همه هماهنگ', 'نقش مدیر و مشاور برای همکاران', 'شمارهٔ مالک فقط برای کسی که مدیر بخواهد', 'همهٔ امکانات پلن تک‌نفره'],
      badge: 'محبوب‌ترین',
    },
    {
      id: 'pro',
      name: 'دفتر بزرگ',
      seats: 10,
      monthly: 9_900_000,
      blurb: 'برای دفترهای پرهمکار',
      extra: { monthly: 500_000, max: 50 },
      features: ['تا ۱۰ همکار؛ هر نفر بیشتر ماهی ۵۰۰ هزار تومان', 'دعوت همکار فقط با شمارهٔ موبایل', 'نقش‌ها و دسترسی‌های جدا', 'همهٔ امکانات پلن دفتر'],
    },
  ],
  // ماه هدیه و تخفیف با هم: هرچه مدت بلندتر، هر ماه ارزان‌تر.
  terms: [
    { id: 'month', name: 'یک‌ماهه', months: 1, gift: 0, off: 0 },
    { id: 'half', name: 'شش‌ماهه', months: 6, gift: 1, off: 10 },
    { id: 'year', name: 'یک‌ساله', months: 12, gift: 2, off: 15 },
  ],
};

/** آنچه برای خرید پیشنهاد می‌شود (پلن‌ها و مدت‌های پنهان‌نشده). */
export function forSale(c: Catalog): Catalog {
  return { plans: c.plans.filter((p) => !p.hidden), terms: c.terms.filter((t) => !t.hidden) };
}

/** مدتی که هر ماهش ارزان‌ترین است؛ پیش‌فرض انتخاب و «بیشترین تخفیف». */
export function bestTerm(terms: readonly Term[]): Term | undefined {
  const rate = (t: Term) => (t.months * (100 - t.off)) / 100 / (t.months + t.gift);
  return terms.reduce<Term | undefined>((b, t) => (!b || rate(t) < rate(b) ? t : b), undefined);
}

/** پلن دورهٔ آزمایشی دفتر تازه؛ همان جای پیش‌فرض دفترها (offices.seats). */
export const TRIAL_PLAN: PlanId = 'office';
export const TRIAL_DAYS = 14;
const DAY = 86_400_000;
/** میانگین روزهای یک ماه؛ مدت هر خرید = (ماه‌های پولی + هدیه) × این. */
const MONTH_DAYS = 30.44;
export function termDays(t: Term): number {
  return Math.round((t.months + t.gift) * MONTH_DAYS);
}
/** از چند روز مانده به پایان، برنامه یادآوری می‌کند. */
export const WARN_DAYS = 7;
/** دستگاهی که این‌قدر به سرور سر نزده، تا یک بار وصل نشود فقط‌خواندنی است (اشتراک لغوشده یا معلق دیر نماند). */
export const OFFLINE_GRACE_DAYS = 14;

/** تعداد نفرات معتبر برای پلن: پلن بی‌نفر اضافه همیشه seats خودش، بقیه بین seats و سقف. */
export function seatsFor(plan: Plan, seats?: number): number {
  if (!plan.extra || seats === undefined || !Number.isInteger(seats)) return plan.seats;
  return Math.min(plan.extra.max, Math.max(plan.seats, seats));
}

/** قیمت یک ماهِ پلن با همین تعداد نفر، بی‌تخفیف. */
export function monthlyOf(plan: Plan, seats?: number): number {
  return plan.monthly + (plan.extra ? (seatsFor(plan, seats) - plan.seats) * plan.extra.monthly : 0);
}

/** قیمت‌ها گرد به این مقدار تا هر عددی که کاربر می‌بیند رند باشد. */
const ROUND = 50_000;

/** هزینهٔ هر ماهِ اعتبار در این مدت (با تخفیف و ماه‌های هدیه)، رند. */
export function perMonthOf(plan: Plan, t: Term, seats?: number): number {
  if (!t.gift && !t.off) return monthlyOf(plan, seats);
  const f = (t.months * (100 - t.off)) / 100 / (t.months + t.gift);
  const each = (m: number) => Math.round((m * f) / ROUND) * ROUND;
  return each(plan.monthly) + (plan.extra ? (seatsFor(plan, seats) - plan.seats) * each(plan.extra.monthly) : 0);
}

/** مبلغ یک خرید به تومان. */
export function priceOf(plan: Plan, t: Term, seats?: number): number {
  return perMonthOf(plan, t, seats) * (t.months + t.gift);
}

export interface SubscriptionState {
  plan: PlanId;
  trial: boolean;
  /** پایان اعتبار، ISO. */
  expiresAt: string;
  /** نفرات خریده‌شده؛ برای پلن با نفر اضافه. */
  seats?: number;
}

/**
 * پایان اعتبار بعد از خرید. روزهای باقی‌مانده هدر نمی‌روند: روزهای آزمایشی و روزهای همان پلن کامل به آخر اضافه می‌شوند،
 * و با عوض کردن پلن یا تعداد نفرات، ارزش ریالی روزهای مانده به روزهای پلن تازه تبدیل می‌شود (ارتقا = روز کمتر، کاهش = روز بیشتر).
 * old پلن فعلی دفتر است (اگر هنوز در فهرست باشد)؛ days طول همین خرید.
 */
export function nextExpiry(cur: SubscriptionState, old: Plan | undefined, plan: Plan, days: number, now: number, seats?: number): number {
  const left = Math.max(0, Date.parse(cur.expiresAt) - now);
  const was = old && monthlyOf(old, cur.seats);
  const will = monthlyOf(plan, seats);
  const carry = cur.trial || !was || !will || was === will ? left : Math.floor((left * was) / will);
  return now + carry + days * DAY;
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
