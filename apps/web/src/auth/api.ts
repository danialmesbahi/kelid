// ارتباط با سرور ورود (apps/server/src/auth/routes.ts). نشانی سرور در زمان ساخت: VITE_KELID_API_URL.
// بدون آن، برنامه مثل قبل فقط روی همین دستگاه کار می‌کند و صفحهٔ ورود نمی‌آید.

export interface Session {
  accessToken: string;
  accessExpiresIn: number;
  refreshToken: string;
  deviceId: string;
  user: { id: string; name: string; phone: string };
  office: { id: string; name: string };
}

export interface Device {
  id: string;
  name: string;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}

export type ApiErrorCode = 'bad_phone' | 'bad_code' | 'bad_name' | 'wrong' | 'expired' | 'too_many' | 'sms_failed' | 'unauthorized' | 'offline' | 'server';

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
  verify(phone: string, code: string, deviceName: string): Promise<VerifyResult>;
  signup(signupToken: string, name: string, officeName: string, deviceName: string): Promise<Session>;
  refresh(refreshToken: string): Promise<Session>;
  logout(accessToken: string): Promise<void>;
  devices(accessToken: string): Promise<Device[]>;
  removeDevice(accessToken: string, id: string): Promise<void>;
}

const CODES: readonly string[] = ['bad_phone', 'bad_code', 'bad_name', 'wrong', 'expired', 'too_many', 'sms_failed', 'unauthorized'];

export function httpApi(base: string): AuthApi {
  const root = base.replace(/\/+$/, '');
  async function call<T>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: object, token?: string): Promise<T> {
    let res: Response;
    try {
      res = await fetch(root + path, {
        method,
        headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        // درخواست آویزان روی اینترنت ضعیف نباید صفحه را منتظر نگه دارد.
        signal: AbortSignal.timeout(12_000),
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

  return {
    requestOtp: (phone) => call('POST', '/auth/otp', { phone }),
    verify: async (phone, code, deviceName) => {
      const r = await call<Session | { signupToken: string }>('POST', '/auth/verify', { phone, code, deviceName });
      return 'signupToken' in r ? r : { session: r };
    },
    signup: (signupToken, name, officeName, deviceName) => call('POST', '/auth/signup', { signupToken, name, officeName, deviceName }),
    refresh: (refreshToken) => call('POST', '/auth/refresh', { refreshToken }),
    logout: (token) => call('POST', '/auth/logout', {}, token),
    devices: (token) => call('GET', '/auth/devices', undefined, token),
    removeDevice: (token, id) => call('DELETE', `/auth/devices/${encodeURIComponent(id)}`, undefined, token),
  };
}

/**
 * سرور خیالی برای پیش‌نمایش و آزمایش رابط، بدون اینترنت (VITE_KELID_API_URL=demo).
 * کد همیشه ۱۲۳۴۵۶ است؛ شمارهٔ ۰۹۱۲۰۰۰۰۰۰۰ «کاربر قدیمی» است و بقیه دفتر تازه می‌سازند.
 */
export function demoApi(): AuthApi {
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let tries = 0;
  const devices: Device[] = [
    { id: 'd-phone', name: 'گوشی اندروید', createdAt: new Date(Date.now() - 864e5 * 12).toISOString(), lastSeenAt: new Date(Date.now() - 36e5 * 3).toISOString(), current: false },
  ];
  const session = (name: string, office: string, phone: string): Session => {
    if (!devices.some((d) => d.current)) devices.unshift({ id: 'd-this', name: deviceLabel(), createdAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(), current: true });
    return { accessToken: 'demo', accessExpiresIn: 900, refreshToken: 'demo-refresh', deviceId: 'd-this', user: { id: 'u1', name, phone }, office: { id: 'o1', name: office } };
  };
  return {
    demoCode: '123456',
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
      return phone === '09120000000' ? { session: session('علی رضایی', 'املاک پارسا', phone) } : { signupToken: 'demo-ticket' };
    },
    async signup(_t, name, officeName) {
      await wait(500);
      return session(name, officeName, '09121234567');
    },
    async refresh() {
      await wait(200);
      return session('علی رضایی', 'املاک پارسا', '09120000000');
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

export function apiFromEnv(): AuthApi | null {
  const url = import.meta.env.VITE_KELID_API_URL as string | undefined;
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
