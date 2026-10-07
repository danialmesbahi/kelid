// ارتباط با سرور ورود (apps/server/src/auth/routes.ts). نشانی سرور در زمان ساخت: VITE_KELID_API_URL.
// بدون آن، برنامه مثل قبل فقط روی همین دستگاه کار می‌کند و صفحهٔ ورود نمی‌آید.

export interface Session {
  accessToken: string;
  accessExpiresIn: number;
  refreshToken: string;
  deviceId: string;
  // نشست‌های ذخیره‌شده از پیش از رمز عبور این را ندارند.
  user: { id: string; name: string; phone: string; hasPassword?: boolean };
  office: { id: string; name: string };
}

export interface Device {
  id: string;
  name: string;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}

export type ApiErrorCode = 'bad_phone' | 'bad_code' | 'bad_name' | 'bad_password' | 'wrong' | 'expired' | 'too_many' | 'sms_failed' | 'unauthorized' | 'offline' | 'server';

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly retryAfter?: number,
    readonly attemptsLeft?: number,
  ) {
    super(code);
  }
}

export type VerifyResult = { session: Session } | { signupToken: string };

export interface AuthApi {
  /** فقط پیش‌نمایش: کد آزمایشی که روی صفحه نشان داده می‌شود. */
  demoCode?: string;
  requestOtp(phone: string): Promise<{ retryAfter: number }>;
  /** ورود اصلی: شماره و رمز عبور. شمارهٔ بی‌حساب و رمز اشتباه هر دو `wrong` می‌دهند. */
  login(phone: string, password: string, deviceName: string): Promise<Session>;
  verify(phone: string, code: string, deviceName: string): Promise<VerifyResult>;
  signup(signupToken: string, name: string, officeName: string, password: string, deviceName: string): Promise<Session>;
  /** رمز تازه؛ `current` لازم نیست اگر این دستگاه همین چند دقیقه پیش با کد پیامکی وارد شده باشد. */
  setPassword(accessToken: string, password: string, current?: string): Promise<void>;
  refresh(refreshToken: string): Promise<Session>;
  logout(accessToken: string): Promise<void>;
  devices(accessToken: string): Promise<Device[]>;
  removeDevice(accessToken: string, id: string): Promise<void>;
}

const CODES: readonly string[] = ['bad_phone', 'bad_code', 'bad_name', 'bad_password', 'wrong', 'expired', 'too_many', 'sms_failed', 'unauthorized'];

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
  const data = (await res.json().catch(() => ({}))) as { error?: string; retryAfter?: number; attemptsLeft?: number };
  if (res.ok) return data as T;
  if (res.status === 401) throw new ApiError('unauthorized');
  const code = (CODES.includes(data.error ?? '') ? data.error : 'server') as ApiErrorCode;
  throw new ApiError(code, data.retryAfter, data.attemptsLeft);
}

export function httpApi(base: string): AuthApi {
  const root = base.replace(/\/+$/, '');
  const call = <T>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: object, token?: string) => request<T>(root, method, path, body, token);

  return {
    login: (phone, password, deviceName) => call('POST', '/auth/login', { phone, password, deviceName }),
    requestOtp: (phone) => call('POST', '/auth/otp', { phone }),
    verify: async (phone, code, deviceName) => {
      const r = await call<Session | { signupToken: string }>('POST', '/auth/verify', { phone, code, deviceName });
      return 'signupToken' in r ? r : { session: r };
    },
    signup: (signupToken, name, officeName, password, deviceName) => call('POST', '/auth/signup', { signupToken, name, officeName, password, deviceName }),
    setPassword: (token, password, current) => call('POST', '/auth/password', { password, ...(current ? { current } : {}) }, token),
    refresh: (refreshToken) => call('POST', '/auth/refresh', { refreshToken }),
    logout: (token) => call('POST', '/auth/logout', {}, token),
    devices: (token) => call('GET', '/auth/devices', undefined, token),
    removeDevice: (token, id) => call('DELETE', `/auth/devices/${encodeURIComponent(id)}`, undefined, token),
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
  type Account = { name: string; office: string; password?: string };
  const KEY = 'kelid.demo.accounts';
  const SEED: Account = { name: 'علی رضایی', office: 'املاک پارسا', password: '12345678' };
  const accounts = (): Record<string, Account> => {
    try {
      return { '09120000000': SEED, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, Account>) };
    } catch {
      return { '09120000000': SEED };
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
  ];
  const session = (phone: string): Session => {
    const a = accounts()[phone] ?? { name: '', office: '' };
    if (!devices.some((d) => d.current)) devices.unshift({ id: 'd-this', name: deviceLabel(), createdAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(), current: true });
    return {
      accessToken: `demo:${phone}`,
      accessExpiresIn: 900,
      refreshToken: `demo-refresh:${phone}`,
      deviceId: 'd-this',
      user: { id: `u${phone}`, name: a.name, phone, hasPassword: !!a.password },
      office: { id: 'o1', name: a.office },
    };
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
      return accounts()[phone] ? { session: session(phone) } : { signupToken: 'demo-ticket' };
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
    async logout() {
      await wait(250);
    },
    async devices() {
      await wait(250);
      return devices.slice();
    },
    async removeDevice(_t, id) {
      await wait(250);
      devices.splice(devices.findIndex((d) => d.id === id), 1);
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
