import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, type Admin, type AdminApi } from './api';

// ورود فقط برای همین برگهٔ مرورگر (sessionStorage): با بستن برگه یا بعد از هشت ساعت دوباره رمز و کد لازم است.
const KEY = 'kelid.admin.session';

interface Stored {
  token: string;
  admin: Admin;
  /** میلی‌ثانیه */
  exp: number;
}

interface AuthValue {
  admin: Admin | null;
  /** چرا بیرون آمد (زمان ورود تمام شد)، برای پیام صفحهٔ ورود */
  reason: string | null;
  signIn: (phone: string, password: string, code: string) => Promise<void>;
  signOut: (reason?: string) => void;
  /** تماس با سرور با توکن همین ورود؛ اگر سرور ورود را نپذیرفت، بیرون می‌آید. */
  call: <T>(fn: (api: AdminApi, token: string) => Promise<T>) => Promise<T>;
}

const Ctx = createContext<AuthValue | null>(null);

function read(): Stored | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Stored | null;
    return s && s.exp > Date.now() ? s : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Stored | null>(read);
  const [reason, setReason] = useState<string | null>(null);

  const signOut = useCallback((why?: string) => {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* فقط حافظهٔ همین صفحه */
    }
    setSession(null);
    setReason(why ?? null);
  }, []);

  // پایان عمر توکن: بی‌صدا بیرون، با پیام روشن روی صفحهٔ ورود.
  useEffect(() => {
    if (!session) return;
    const t = setTimeout(() => signOut('زمان ورود تمام شد؛ دوباره وارد شوید.'), Math.max(0, session.exp - Date.now()));
    return () => clearTimeout(t);
  }, [session, signOut]);

  const signIn = useCallback(async (phone: string, password: string, code: string) => {
    if (!api) throw new ApiError('server');
    const r = await api.login(phone, password, code);
    const s = { token: r.token, admin: r.admin, exp: Date.now() + r.expiresIn * 1000 - 30_000 };
    try {
      sessionStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* بدون حافظه هم تا بستن صفحه کار می‌کند */
    }
    setReason(null);
    setSession(s);
  }, []);

  const call = useCallback(
    async <T,>(fn: (a: AdminApi, token: string) => Promise<T>): Promise<T> => {
      if (!api || !session) throw new ApiError('unauthorized');
      try {
        return await fn(api, session.token);
      } catch (e) {
        if (e instanceof ApiError && e.code === 'unauthorized') signOut('ورود شما دیگر معتبر نیست؛ دوباره وارد شوید.');
        throw e;
      }
    },
    [session, signOut],
  );

  const value = useMemo<AuthValue>(() => ({ admin: session?.admin ?? null, reason, signIn, signOut, call }), [session, reason, signIn, signOut, call]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('AuthProvider missing');
  return v;
}
