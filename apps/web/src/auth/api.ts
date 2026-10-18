import { cleanVoiceDraft, encodeLicense, nextExpiry, PLANS, planById, priceOf, seatsFor, TRIAL_DAYS, type Period, type Plan, type PlanId, type VoiceDraft, type VoiceForm } from '@kelid/core';
import { phoneDigits } from './phone';

// ارتباط با سرور ورود (apps/server/src/auth/routes.ts). نشانی سرور در زمان ساخت: VITE_KELID_API_URL.
// بدون آن، برنامه مثل قبل فقط روی همین دستگاه کار می‌کند و صفحهٔ ورود نمی‌آید.

export type Role = 'manager' | 'agent';

/** دفتری که این شماره را دعوت کرده؛ فقط بعد از کد درست یا ورود دیده می‌شود. */
export interface InviteInfo {
  officeName: string;
  invitedBy: string;
  name: string;
  role: Role;
}

export interface Session {
  accessToken: string;
  accessExpiresIn: number;
  refreshToken: string;
  deviceId: string;
  // نشست‌های ذخیره‌شده از پیش از رمز عبور و همکاران این‌ها را ندارند؛ آن موقع هر حساب مدیر دفتر خودش بود.
  user: { id: string; name: string; phone: string; hasPassword?: boolean; role?: Role; seeOwnerPhones?: boolean };
  office: { id: string; name: string };
  invite?: InviteInfo | null;
  /** مجوز امضاشدهٔ اشتراک دفتر؛ سرور قدیمی ندارد. */
  license?: string;
}

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'canceled';

export interface Receipt {
  id: string;
  plan: PlanId;
  period: Period;
  /** نفرات خریده‌شده؛ سرور قدیمی ندارد. */
  seats?: number;
  /** تومان */
  amount: number;
  status: PaymentStatus;
  refId: string | null;
  card: string | null;
  createdAt: string;
  paidAt: string | null;
  /** پایان اشتراک بعد از همین پرداخت. */
  expiresAt: string | null;
}

export interface Billing {
  plan: PlanId;
  trial: boolean;
  expiresAt: string;
  seats: number;
  /** همکاران + دعوت‌های باز */
  used: number;
  plans: Plan[];
  /** درگاه پرداخت روی سرور روشن است. */
  canPay: boolean;
  payments: Receipt[];
  license: string;
}

export interface Member {
  id: string;
  name: string;
  phone: string;
  role: Role;
  seeOwnerPhones: boolean;
  lastSeenAt: string | null;
}

export interface Invite {
  phone: string;
  name: string;
  role: Role;
  seeOwnerPhones: boolean;
  invitedBy: string;
  createdAt: string;
}

export interface Team {
  seats: number;
  members: Member[];
  invites: Invite[];
}

export interface NewInvite {
  phone: string;
  name: string;
  role: Role;
  seeOwnerPhones: boolean;
}

export interface Device {
  id: string;
  name: string;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}

export type ApiErrorCode =
  | 'bad_phone' | 'bad_code' | 'bad_name' | 'bad_password' | 'wrong' | 'expired' | 'too_many' | 'sms_failed' | 'unauthorized' | 'not_found' | 'bad_photo'
  | 'forbidden' | 'no_seat' | 'member' | 'last_manager' | 'self' | 'not_alone'
  | 'subscription' | 'too_small' | 'no_gateway' | 'gateway'
  // پر کردن فرم با صدا: سرور سرویس هوش مصنوعی ندارد، سرویس جواب نداد، یا صدا خراب بود.
  | 'no_ai' | 'ai_failed' | 'bad_audio'
  // دستگاه‌های دفتر به سقف نفرات اشتراک رسیده؛ ApiError.limit فهرست و بلیت ادامه را دارد.
  | 'device_limit'
  // فقط سمت برنامه: توکن مال دفتر دیگری است (کاربر دفترش را عوض کرد)؛ همگام‌سازی دفتر قبلی همان‌جا می‌ایستد.
  | 'office_changed'
  | 'offline' | 'server';

/** دستگاه وارد شدهٔ دفتر وقتی دفتر به سقف رسیده. mine: مال خود این حساب. locked: دستگاه مدیر که مشاور نمی‌تواند خارجش کند. */
export interface OfficeDevice extends Omit<Device, 'current'> {
  owner: string;
  mine: boolean;
  locked: boolean;
}

/** دفتر به سقف دستگاه (نفرات اشتراک) رسیده؛ با ticket یکی از دستگاه‌ها بیرون می‌رود (replaceDevice). */
export interface DeviceLimit {
  ticket: string;
  seats: number;
  devices: OfficeDevice[];
}

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly retryAfter?: number,
    readonly attemptsLeft?: number,
    readonly limit?: DeviceLimit,
  ) {
    super(code);
  }
}

export type VerifyResult = { session: Session } | { signupToken: string; invite: InviteInfo | null };

export interface AuthApi {
  /** فقط پیش‌نمایش: کد آزمایشی که روی صفحه نشان داده می‌شود. */
  demoCode?: string;
  /** devCode فقط وقتی سرور توسعه پیامک واقعی نمی‌فرستد (کد روی صفحه نشان داده می‌شود). */
  requestOtp(phone: string): Promise<{ retryAfter: number; devCode?: string }>;
  /** ورود اصلی: شماره و رمز عبور. شمارهٔ بی‌حساب و رمز اشتباه هر دو `wrong` می‌دهند. */
  login(phone: string, password: string, deviceName: string): Promise<Session>;
  verify(phone: string, code: string, deviceName: string): Promise<VerifyResult>;
  /** ورودی که به سقف دستگاه خورد: دستگاه انتخاب‌شده بیرون می‌رود و همین دستگاه وارد می‌شود. */
  replaceDevice(ticket: string, deviceId: string): Promise<Session>;
  signup(signupToken: string, name: string, officeName: string, password: string, deviceName: string): Promise<Session>;
  /** رمز تازه؛ `current` لازم نیست اگر این دستگاه همین چند دقیقه پیش با کد پیامکی وارد شده باشد. */
  setPassword(accessToken: string, password: string, current?: string): Promise<void>;
  refresh(refreshToken: string): Promise<Session>;
  logout(accessToken: string): Promise<void>;
  devices(accessToken: string): Promise<Device[]>;
  removeDevice(accessToken: string, id: string): Promise<void>;
  /** نام شما و نام دفتر روی سرور، تا دستگاه‌های دیگر دفتر هم ببینند. */
  updateProfile(accessToken: string, p: { name?: string; officeName?: string }): Promise<{ name: string; officeName: string }>;
  /** نظر کاربر برای تیم کلید (ابزار بتا). */
  sendFeedback(accessToken: string, f: { id: string; kind: string; body: string; page: string; appVersion: string; platform: string }): Promise<void>;
  /** خطاهای برنامه روی این دستگاه (تا ۱۰ تا در هر درخواست). */
  reportErrors(accessToken: string, errors: Array<{ message: string; stack: string; page: string; count: number; appVersion: string; platform: string }>): Promise<void>;
  /** شمارهٔ دعوت‌شده بعد از کد درست: نام و رمز، و عضو دفتر می‌شود. */
  join(signupToken: string, name: string, password: string, deviceName: string): Promise<Session>;
  /** کسی که دفتر خودش را دارد به دفتر دعوت‌کننده می‌رود (فقط اگر در دفتر فعلی‌اش تنهاست). */
  acceptInvite(accessToken: string): Promise<Session>;
  declineInvite(accessToken: string): Promise<void>;
  team(accessToken: string): Promise<Team>;
  invite(accessToken: string, i: NewInvite): Promise<void>;
  cancelInvite(accessToken: string, phone: string): Promise<void>;
  updateMember(accessToken: string, id: string, p: { role?: Role; seeOwnerPhones?: boolean }): Promise<void>;
  removeMember(accessToken: string, id: string): Promise<void>;
  /** اشتراک دفتر، پلن‌ها و رسیدها، با مجوز تازه. */
  billing(accessToken: string): Promise<Billing>;
  /** شروع پرداخت (فقط مدیر)؛ مبلغ را سرور از پلن حساب می‌کند. payUrl خالی = پیش‌نمایش بی‌درگاه. */
  checkout(accessToken: string, plan: PlanId, period: Period, seats?: number): Promise<{ id: string; payUrl: string }>;
  /** وضعیت یک پرداخت؛ بعد از پرداخت مجوز تازه هم دارد. */
  payment(accessToken: string, id: string): Promise<Receipt & { license: string | null }>;
  /** صحبت ضبط‌شده → متن و فیلدهای فرم (صدا base64؛ hints نام محله‌های دفتر برای املای درست). */
  voiceFill<F extends VoiceForm>(accessToken: string, v: { form: F; audio: string; mime: string; hints: string[] }): Promise<VoiceFill<F>>;
}

export interface VoiceFill<F extends VoiceForm = VoiceForm> {
  transcript: string;
  fields: VoiceDraft<F>;
}

const CODES: readonly string[] = [
  'bad_phone', 'bad_code', 'bad_name', 'bad_password', 'wrong', 'expired', 'too_many', 'sms_failed', 'unauthorized', 'not_found', 'bad_photo',
  'forbidden', 'no_seat', 'member', 'last_manager', 'self', 'not_alone',
  'subscription', 'too_small', 'no_gateway', 'gateway', 'device_limit', 'no_ai', 'ai_failed', 'bad_audio',
];

/** یک درخواست به سرور کلید؛ قطع اینترنت ApiError('offline') و 401 ApiError('unauthorized') می‌شود. */
export async function request<T>(root: string, method: 'GET' | 'POST' | 'DELETE', path: string, body?: object, token?: string, timeoutMs = 12_000): Promise<T> {
  let res: Response;
  try {
    res = await fetch(root + path, {
      method,
      headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      // درخواست آویزان روی اینترنت ضعیف نباید صفحه را منتظر نگه دارد.
      signal: AbortSignal.timeout(timeoutMs),
      credentials: 'omit',
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('offline');
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as { error?: string; retryAfter?: number; attemptsLeft?: number } & Partial<DeviceLimit>;
  if (res.ok) return data as T;
  if (res.status === 401) throw new ApiError('unauthorized');
  const code = (CODES.includes(data.error ?? '') ? data.error : 'server') as ApiErrorCode;
  const limit = code === 'device_limit' && data.ticket && Array.isArray(data.devices) ? { ticket: data.ticket, seats: data.seats ?? data.devices.length, devices: data.devices } : undefined;
  throw new ApiError(code, data.retryAfter, data.attemptsLeft, limit);
}

export function httpApi(base: string): AuthApi {
  const root = base.replace(/\/+$/, '');
  const call = <T>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: object, token?: string) => request<T>(root, method, path, body, token);

  return {
    login: (phone, password, deviceName) => call('POST', '/auth/login', { phone, password, deviceName }),
    requestOtp: (phone) => call('POST', '/auth/otp', { phone }),
    verify: async (phone, code, deviceName) => {
      const r = await call<Session | { signupToken: string; invite?: InviteInfo | null }>('POST', '/auth/verify', { phone, code, deviceName });
      return 'signupToken' in r ? { signupToken: r.signupToken, invite: r.invite ?? null } : { session: r };
    },
    replaceDevice: (ticket, deviceId) => call('POST', '/auth/devices/replace', { ticket, deviceId }),
    signup: (signupToken, name, officeName, password, deviceName) => call('POST', '/auth/signup', { signupToken, name, officeName, password, deviceName }),
    setPassword: (token, password, current) => call('POST', '/auth/password', { password, ...(current ? { current } : {}) }, token),
    refresh: (refreshToken) => call('POST', '/auth/refresh', { refreshToken }),
    logout: (token) => call('POST', '/auth/logout', {}, token),
    devices: (token) => call('GET', '/auth/devices', undefined, token),
    removeDevice: (token, id) => call('DELETE', `/auth/devices/${encodeURIComponent(id)}`, undefined, token),
    updateProfile: (token, p) => call('POST', '/auth/profile', p, token),
    sendFeedback: (token, f) => call('POST', '/beta/feedback', f, token),
    reportErrors: (token, errors) => call('POST', '/beta/errors', { errors }, token),
    join: (signupToken, name, password, deviceName) => call('POST', '/auth/join', { signupToken, name, password, deviceName }),
    acceptInvite: (token) => call('POST', '/auth/invite/accept', {}, token),
    declineInvite: (token) => call('POST', '/auth/invite/decline', {}, token),
    team: (token) => call('GET', '/team', undefined, token),
    invite: (token, i) => call('POST', '/team/invites', i, token),
    cancelInvite: (token, phone) => call('DELETE', `/team/invites/${encodeURIComponent(phone)}`, undefined, token),
    updateMember: (token, id, p) => call('POST', `/team/members/${encodeURIComponent(id)}`, p, token),
    removeMember: (token, id) => call('DELETE', `/team/members/${encodeURIComponent(id)}`, undefined, token),
    billing: (token) => call('GET', '/billing', undefined, token),
    checkout: (token, plan, period, seats) => call('POST', '/billing/checkout', { plan, period, ...(seats ? { seats } : {}) }, token),
    payment: (token, id) => call('GET', `/billing/payments/${encodeURIComponent(id)}`, undefined, token),
    // دو گام هوش مصنوعی (گفتار به متن، متن به فیلد) روی اینترنت کند بیشتر از ۱۲ ثانیه طول می‌کشد.
    voiceFill: async (token, v) => {
      const r = await request<VoiceFill>(root, 'POST', '/ai/voice', v, token, 90_000);
      // پاسخ سرور هم دوباره پاک‌سازی می‌شود تا فرم هیچ‌وقت مقدار عجیب نگیرد.
      return { transcript: r.transcript, fields: cleanVoiceDraft(v.form, r.fields) };
    },
  };
}

/**
 * سرور خیالی برای پیش‌نمایش و آزمایش رابط، بدون اینترنت (VITE_KELID_API_URL=demo).
 * کد همیشه ۱۲۳۴۵۶ است؛ شمارهٔ ۰۹۱۲۰۰۰۰۰۰۰ با رمز ۱۲۳۴۵۶۷۸ از قبل حساب دارد و هر شماره‌ای که ثبت‌نام کند در همین مرورگر به یاد می‌ماند.
 */
export function demoApi(): AuthApi {
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let tries = 0;
  let pwdFails = 0;
  // حساب‌های پیش‌نمایش در همین مرورگر می‌مانند تا «ثبت‌نام، خروج، ورود دوباره» مثل سرور واقعی کار کند.
  // فقط پیش‌نمایش: رمز ساده در حافظهٔ مرورگر می‌ماند؛ سرور واقعی فقط هش scrypt نگه می‌دارد.
  // officeId/role فقط برای همکارِ دعوت‌شده؛ بقیه مدیر دفتر خودشان‌اند.
  type Account = { name: string; office: string; password?: string; officeId?: string; role?: Role; seeOwnerPhones?: boolean };
  const KEY = 'kelid.demo.accounts';
  const SEED: Account = { name: 'علی رضایی', office: 'املاک پارسا', password: '12345678' };
  // دفتری که اشتراکش تمام شده، برای دیدن حالت فقط‌خواندنی.
  const EXPIRED: Account = { name: 'مینا کریمی', office: 'املاک آفتاب', password: '12345678' };
  const accounts = (): Record<string, Account> => {
    try {
      return { '09120000000': SEED, '09120000001': EXPIRED, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, Account>) };
    } catch {
      return { '09120000000': SEED, '09120000001': EXPIRED };
    }
  };
  const remember = (phone: string, a: Account) => {
    try {
      const mine = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, Account>;
      localStorage.setItem(KEY, JSON.stringify({ ...mine, [phone]: a }));
    } catch {
      // حافظهٔ مرورگر بسته است؛ پیش‌نمایش فقط تا بستن صفحه یادش می‌ماند.
    }
  };
  let verified = '';
  const devices: Device[] = [
    { id: 'd-phone', name: 'گوشی اندروید', createdAt: new Date(Date.now() - 864e5 * 12).toISOString(), lastSeenAt: new Date(Date.now() - 36e5 * 3).toISOString(), current: false },
    { id: 'd-laptop', name: 'لپ‌تاپ دفتر', createdAt: new Date(Date.now() - 864e5 * 30).toISOString(), lastSeenAt: new Date(Date.now() - 36e5 * 26).toISOString(), current: false },
  ];
  // دستگاه‌های همکاران دفتر نمونه؛ با دو دستگاه بالا دفتر پنج‌نفره پر است تا صفحهٔ سقف دستگاه دیده شود.
  const mateDevices: OfficeDevice[] = [
    { id: 'd-maryam-pc', name: 'Chrome روی ویندوز', owner: 'مریم احمدی', mine: false, locked: false, createdAt: new Date(Date.now() - 864e5 * 20).toISOString(), lastSeenAt: new Date(Date.now() - 36e5 * 1).toISOString() },
    { id: 'd-maryam-phone', name: 'گوشی اندروید', owner: 'مریم احمدی', mine: false, locked: false, createdAt: new Date(Date.now() - 864e5 * 9).toISOString(), lastSeenAt: new Date(Date.now() - 36e5 * 5).toISOString() },
    { id: 'd-reza', name: 'آیفون', owner: 'رضا کاظمی', mine: false, locked: false, createdAt: new Date(Date.now() - 864e5 * 40).toISOString(), lastSeenAt: new Date(Date.now() - 36e5 * 75).toISOString() },
  ];
  const officeOf = (phone: string) => accounts()[phone]?.officeId ?? (phone === '09120000000' ? 'o1' : `o${phone}`);
  const phoneOf = (token: string) => (token.startsWith('demo:') ? token.slice('demo:'.length) : '');
  // همکاران دفتر نمونه؛ فقط تا بستن صفحه. شمارهٔ ۰۹۱۳۰۰۰۰۰۰۰ دعوت شده و با کد پیامکی به دفتر می‌پیوندد.
  const ago = (h: number) => new Date(Date.now() - h * 36e5).toISOString();
  const teams: Record<string, Team> = {
    o1: {
      seats: 5,
      members: [
        { id: 'u09120000000', name: 'علی رضایی', phone: '09120000000', role: 'manager', seeOwnerPhones: true, lastSeenAt: ago(0) },
        { id: 'u09121234567', name: 'مریم احمدی', phone: '09121234567', role: 'agent', seeOwnerPhones: true, lastSeenAt: ago(2) },
        { id: 'u09351112233', name: 'رضا کاظمی', phone: '09351112233', role: 'agent', seeOwnerPhones: false, lastSeenAt: ago(75) },
      ],
      invites: [{ phone: '09130000000', name: 'سارا نوری', role: 'agent', seeOwnerPhones: false, invitedBy: 'علی رضایی', createdAt: ago(20) }],
    },
  };
  const teamOf = (phone: string): Team => {
    const office = officeOf(phone);
    const a = accounts()[phone];
    teams[office] ??= { seats: 5, members: [{ id: `u${phone}`, name: a?.name ?? '', phone, role: 'manager', seeOwnerPhones: true, lastSeenAt: ago(0) }], invites: [] };
    return teams[office]!;
  };
  const managerTeam = (token: string): Team => {
    const phone = phoneOf(token);
    if (!accounts()[phone]) throw new ApiError('unauthorized');
    const t = teamOf(phone);
    if (t.members.find((m) => m.phone === phone)?.role !== 'manager') throw new ApiError('forbidden');
    return t;
  };
  const inviteFor = (phone: string): { office: string; invite: Invite } | null => {
    for (const [office, t] of Object.entries(teams)) {
      const invite = t.invites.find((i) => i.phone === phone);
      if (invite) return { office, invite };
    }
    return null;
  };
  // سقف دستگاه دفتر نمونه، مثل سرور واقعی: دفتر پر است و اول باید یک دستگاه خارج شود.
  let waiting = '';
  const freeDevice = (phone: string) => {
    waiting = phone;
    if (officeOf(phone) !== 'o1') return;
    const owner = accounts()[phone]?.name ?? '';
    const live: OfficeDevice[] = [...devices.filter((d) => !d.current).map(({ current: _c, ...d }) => ({ ...d, owner, mine: true, locked: false })), ...mateDevices];
    const seats = teamOf(phone).seats;
    if (live.length >= seats) throw new ApiError('device_limit', undefined, undefined, { ticket: 'demo-device', seats, devices: live });
  };
  const session = (phone: string): Session => {
    const a = accounts()[phone] ?? { name: '', office: '' };
    if (!devices.some((d) => d.current)) devices.unshift({ id: 'd-this', name: deviceLabel(), createdAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(), current: true });
    return {
      accessToken: `demo:${phone}`,
      accessExpiresIn: 900,
      refreshToken: `demo-refresh:${phone}`,
      deviceId: 'd-this',
      user: { id: `u${phone}`, name: a.name, phone, hasPassword: !!a.password, role: a.role ?? 'manager', seeOwnerPhones: (a.role ?? 'manager') === 'manager' || !!a.seeOwnerPhones },
      // هر حساب دفتر خودش را دارد، مثل سرور واقعی.
      office: { id: officeOf(phone), name: a.office },
      invite: null,
      license: demoLicense(officeOf(phone)),
    };
  };

  // اشتراک پیش‌نمایش: دفتر نمونه پنج روز آزمایشی مانده دارد تا یادآوری دیده شود. در همین مرورگر می‌ماند.
  type DemoSub = { plan: PlanId; trial: boolean; expiresAt: string; seats: number; payments: Receipt[] };
  const BILL = 'kelid.demo.billing';
  const DAY = 864e5;
  const subs = (): Record<string, DemoSub> => {
    try {
      return JSON.parse(localStorage.getItem(BILL) ?? '{}') as Record<string, DemoSub>;
    } catch {
      return {};
    }
  };
  const subOf = (office: string): DemoSub => {
    const known = subs()[office];
    if (known) return known;
    const days = office === 'o1' ? 5 : office === 'o09120000001' ? -3 : TRIAL_DAYS;
    const sub: DemoSub = { plan: 'office', trial: office !== 'o09120000001', expiresAt: new Date(Date.now() + days * DAY).toISOString(), seats: 5, payments: [] };
    saveSub(office, sub);
    return sub;
  };
  const saveSub = (office: string, sub: DemoSub) => {
    try {
      localStorage.setItem(BILL, JSON.stringify({ ...subs(), [office]: sub }));
    } catch {
      /* فقط تا بستن صفحه */
    }
  };
  // پیش‌نمایش امضا ندارد؛ برنامه در حالت demo امضا را نمی‌سنجد.
  const demoLicense = (office: string) => {
    const s = subOf(office);
    const iat = Math.floor(Date.now() / 1000);
    return `${encodeLicense({ v: 1, off: office, plan: s.plan, seats: s.seats, trial: s.trial, exp: Math.floor(Date.parse(s.expiresAt) / 1000), iat, chk: iat + 14 * 86_400 })}.demo`;
  };
  const pending = new Map<string, { office: string; plan: PlanId; period: Period; seats: number; at: number; receipt?: Receipt }>();
  const userOf = (token: string) => {
    const phone = phoneOf(token);
    const a = accounts()[phone];
    if (!a) throw new ApiError('unauthorized');
    return { phone, office: officeOf(phone), manager: (a.role ?? 'manager') === 'manager' };
  };

  return {
    demoCode: '123456',
    async login(phone, password) {
      await wait(450);
      if (!/^09\d{9}$/.test(phone)) throw new ApiError('bad_phone');
      if (pwdFails >= 5) throw new ApiError('too_many', 900);
      const a = accounts()[phone];
      if (!a?.password || a.password !== password) {
        pwdFails++;
        throw new ApiError('wrong');
      }
      pwdFails = 0;
      freeDevice(phone);
      return session(phone);
    },
    async requestOtp(phone) {
      await wait(500);
      if (!/^09\d{9}$/.test(phone)) throw new ApiError('bad_phone');
      tries = 0;
      return { retryAfter: 60 };
    },
    async verify(phone, code) {
      await wait(450);
      if (code !== '123456') {
        tries++;
        if (tries >= 5) throw new ApiError('expired');
        throw new ApiError('wrong', undefined, 5 - tries);
      }
      verified = phone;
      if (accounts()[phone]) {
        freeDevice(phone);
        return { session: session(phone) };
      }
      const found = inviteFor(phone);
      const office = found ? (found.office === 'o1' ? 'املاک پارسا' : (Object.values(accounts()).find((a) => a.officeId === found.office)?.office ?? '')) : '';
      return { signupToken: 'demo-ticket', invite: found ? { officeName: office, invitedBy: found.invite.invitedBy, name: found.invite.name, role: found.invite.role } : null };
    },
    async signup(_t, name, officeName, password) {
      await wait(500);
      if (!verified) throw new ApiError('expired');
      if (password.length < 8) throw new ApiError('bad_password');
      remember(verified, { name, office: officeName, password });
      return session(verified);
    },
    async setPassword(token, password, current) {
      await wait(400);
      const phone = token.startsWith('demo:') ? token.slice('demo:'.length) : '';
      const a = accounts()[phone];
      if (!a) throw new ApiError('unauthorized');
      if (password.length < 8) throw new ApiError('bad_password');
      if (current !== undefined && a.password && a.password !== current) throw new ApiError('wrong');
      remember(phone, { ...a, password });
      pwdFails = 0;
    },
    async refresh(token) {
      await wait(200);
      const phone = token.startsWith('demo-refresh:') ? token.slice('demo-refresh:'.length) : '09120000000';
      if (!accounts()[phone]) throw new ApiError('unauthorized');
      return session(phone);
    },
    async replaceDevice(_t, id) {
      await wait(400);
      const i = devices.findIndex((d) => d.id === id && !d.current);
      if (i >= 0) devices.splice(i, 1);
      const j = mateDevices.findIndex((d) => d.id === id);
      if (j >= 0) mateDevices.splice(j, 1);
      freeDevice(waiting);
      return session(waiting);
    },
    async logout() {
      await wait(250);
      const i = devices.findIndex((d) => d.current);
      if (i >= 0) devices.splice(i, 1);
    },
    async devices() {
      await wait(250);
      return devices.slice();
    },
    async removeDevice(_t, id) {
      await wait(250);
      devices.splice(devices.findIndex((d) => d.id === id), 1);
    },
    async join(_t, name, password) {
      await wait(500);
      const found = verified ? inviteFor(verified) : null;
      if (!found) throw new ApiError('not_found');
      if (password.length < 8) throw new ApiError('bad_password');
      const { office, invite } = found;
      const t = teams[office]!;
      remember(verified, { name, office: office === 'o1' ? 'املاک پارسا' : '', password, officeId: office, role: invite.role, seeOwnerPhones: invite.seeOwnerPhones });
      t.invites = t.invites.filter((i) => i.phone !== verified);
      t.members.push({ id: `u${verified}`, name, phone: verified, role: invite.role, seeOwnerPhones: invite.seeOwnerPhones, lastSeenAt: new Date().toISOString() });
      return session(verified);
    },
    async acceptInvite() {
      await wait(400);
      throw new ApiError('not_found');
    },
    async declineInvite() {
      await wait(250);
    },
    async team(token) {
      await wait(300);
      const phone = phoneOf(token);
      if (!accounts()[phone]) throw new ApiError('unauthorized');
      return structuredClone(teamOf(phone));
    },
    async invite(token, i) {
      await wait(450);
      const t = managerTeam(token);
      const phone = phoneDigits(i.phone);
      if (!/^09\d{9}$/.test(phone)) throw new ApiError('bad_phone');
      if (!i.name.trim()) throw new ApiError('bad_name');
      if (t.members.some((m) => m.phone === phone)) throw new ApiError('member');
      const others = t.invites.filter((x) => x.phone !== phone);
      if (t.members.length + others.length >= t.seats) throw new ApiError('no_seat');
      t.invites = [...others, { phone, name: i.name.trim(), role: i.role, seeOwnerPhones: i.role === 'manager' || i.seeOwnerPhones, invitedBy: t.members.find((m) => m.phone === phoneOf(token))?.name ?? '', createdAt: new Date().toISOString() }];
    },
    async cancelInvite(token, phone) {
      await wait(250);
      const t = managerTeam(token);
      t.invites = t.invites.filter((x) => x.phone !== phone);
    },
    async updateMember(token, id, p) {
      await wait(300);
      const t = managerTeam(token);
      const m = t.members.find((x) => x.id === id);
      if (!m) throw new ApiError('not_found');
      if (m.role === 'manager' && p.role === 'agent' && t.members.filter((x) => x.role === 'manager').length <= 1) throw new ApiError('last_manager');
      if (p.role) m.role = p.role;
      if (p.seeOwnerPhones !== undefined) m.seeOwnerPhones = p.seeOwnerPhones;
      if (m.role === 'manager') m.seeOwnerPhones = true;
    },
    async removeMember(token, id) {
      await wait(300);
      const t = managerTeam(token);
      const m = t.members.find((x) => x.id === id);
      if (!m) throw new ApiError('not_found');
      if (m.phone === phoneOf(token)) throw new ApiError('self');
      if (m.role === 'manager' && t.members.filter((x) => x.role === 'manager').length <= 1) throw new ApiError('last_manager');
      t.members = t.members.filter((x) => x.id !== id);
    },
    async billing(token) {
      await wait(300);
      const { phone, office } = userOf(token);
      const s = subOf(office);
      const t = teamOf(phone);
      return { ...s, used: t.members.length + t.invites.length, plans: [...PLANS], canPay: true, payments: s.payments, license: demoLicense(office) };
    },
    async checkout(token, plan, period, seats) {
      await wait(500);
      const { phone, office, manager } = userOf(token);
      if (!manager) throw new ApiError('forbidden');
      const t = teamOf(phone);
      const n = seatsFor(planById(plan)!, seats);
      if (n < t.members.length + t.invites.length) throw new ApiError('too_small');
      const id = `pay-${Date.now()}`;
      pending.set(id, { office, plan, period, seats: n, at: Date.now() });
      return { id, payUrl: '' };
    },
    async payment(token, id) {
      await wait(200);
      const { office } = userOf(token);
      const p = pending.get(id);
      if (!p || p.office !== office) throw new ApiError('not_found');
      const plan = planById(p.plan)!;
      // پیش‌نمایش: «پرداخت» دو ثانیه و نیم بعد خودش انجام می‌شود.
      if (!p.receipt && Date.now() - p.at > 2500) {
        const s = subOf(office);
        const until = new Date(nextExpiry(s, plan, p.period, Date.now(), p.seats)).toISOString();
        p.receipt = { id, plan: plan.id, period: p.period, seats: p.seats, amount: priceOf(plan, p.period, p.seats), status: 'paid', refId: String(Math.floor(1e8 + Math.random() * 9e8)), card: '6037-99**-****-1234', createdAt: new Date(p.at).toISOString(), paidAt: new Date().toISOString(), expiresAt: until };
        saveSub(office, { plan: plan.id, trial: false, expiresAt: until, seats: p.seats, payments: [p.receipt, ...s.payments] });
      }
      if (p.receipt) return { ...p.receipt, license: demoLicense(office) };
      return { id, plan: plan.id, period: p.period, seats: p.seats, amount: priceOf(plan, p.period, p.seats), status: 'pending', refId: null, card: null, createdAt: new Date(p.at).toISOString(), paidAt: null, expiresAt: null, license: null };
    },
    async updateProfile(token, p) {
      await wait(300);
      const phone = token.startsWith('demo:') ? token.slice('demo:'.length) : '';
      const a = accounts()[phone];
      if (!a) throw new ApiError('unauthorized');
      const next = { ...a, name: p.name?.trim() || a.name, office: p.officeName?.trim() || a.office };
      remember(phone, next);
      return { name: next.name, officeName: next.office };
    },
    // پیش‌نمایش: نظر و خطا جایی نمی‌روند، فقط در کنسول دیده می‌شوند.
    async sendFeedback(_t, f) {
      await wait(400);
      console.info('[demo feedback]', f.kind, f.body);
    },
    async reportErrors(_t, errors) {
      await wait(100);
      console.info('[demo errors]', errors.length);
    },
    // پیش‌نمایش بی هوش مصنوعی: هر صحبتی یک نمونهٔ ثابت می‌دهد تا رابط دیده شود.
    async voiceFill(_t, v) {
      await wait(1400);
      const sample: Record<VoiceForm, { transcript: string; fields: unknown }> = {
        listing: {
          transcript: 'یه آپارتمان فروشی تو سعادت‌آباد، خیابون سرو، صد و بیست متر، دو خواب، طبقه سوم از پنج طبقه، ساخت ۹۸. پارکینگ و انباری و آسانسور داره. قیمتش هشت و نیم میلیارده، جای چونه داره. مالک آقای رضایی، شماره ۰۹۱۲۳۴۵۶۷۸۹، عصرها جواب میده.',
          fields: { deal: 'sale', kind: 'apartment', neighborhood: 'سعادت‌آباد', street: 'سرو', area: 120, bedrooms: 2, floor: 3, floorsTotal: 5, yearBuilt: 1398, features: ['پارکینگ', 'انباری', 'آسانسور'], total: 8_500_000_000, negotiable: true, ownerName: 'آقای رضایی', ownerPhone: '09123456789', ownerBestTime: 'عصرها' },
        },
        client: {
          transcript: 'خانم احمدی، شماره ۰۹۳۵۱۲۳۴۵۶۷، دنبال آپارتمان رهن و اجاره تو ونک یا جردنه، حدود هشتاد تا صد متر، دو خواب. تا پونصد میلیون رهن و ماهی پونزده میلیون اجاره می‌تونه بده. خیلی فوریه، آخر ماه باید جابه‌جا بشه.',
          fields: { name: 'خانم احمدی', phone: '09351234567', deal: 'rent', kinds: ['apartment'], neighborhoods: ['ونک', 'جردن'], areaMin: 80, areaMax: 100, bedroomsMin: 2, budget: 500_000_000, rent: 15_000_000, temperature: 'hot', waiting: true, notes: 'تا آخر ماه باید جابه‌جا شود.' },
        },
      };
      const s = sample[v.form];
      return { transcript: s.transcript, fields: cleanVoiceDraft(v.form, s.fields) };
    },
  };
}

export const API_URL = (import.meta.env.VITE_KELID_API_URL as string | undefined) || null;

export function apiFromEnv(): AuthApi | null {
  const url = API_URL;
  if (!url) return null;
  return url === 'demo' ? demoApi() : httpApi(url);
}

/** نامی که در فهرست «دستگاه‌های وارد شده» دیده می‌شود. */
export function deviceLabel(): string {
  if (typeof window !== 'undefined' && window.kelid) return 'کامپیوتر (برنامهٔ ویندوز)';
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  if (/iPhone/.test(ua)) return 'آیفون';
  if (/iPad/.test(ua)) return 'آیپد';
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'گوشی اندروید' : 'تبلت اندروید';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'مرورگر';
  const os = /Windows/.test(ua) ? 'ویندوز' : /Mac OS/.test(ua) ? 'مک' : /Linux/.test(ua) ? 'لینوکس' : '';
  return os ? `${browser} روی ${os}` : browser;
}
