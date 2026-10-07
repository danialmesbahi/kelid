import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, apiFromEnv, type AuthApi, type Session } from './api';
import { clearProfileQueue } from './profile';
import { clearSession, loadSession, saveSession, type SavedSession } from './storage';

export type AuthStatus = 'off' | 'loading' | 'signedOut' | 'signedIn';

interface AuthValue {
  status: AuthStatus;
  session: SavedSession | null;
  api: AuthApi | null;
  signIn(s: Session): Promise<void>;
  signOut(): Promise<void>;
  /** رمز گذاشته شد؛ نشست ذخیره‌شده هم باخبر می‌شود تا تنظیمات درست نشانش دهد. */
  markPassword(): Promise<void>;
  /** نام‌ها همان که سرور دارد (بعد از ویرایش در تنظیمات). */
  setNames(name: string, officeName: string): Promise<void>;
  /** کاری که توکن دسترسی می‌خواهد؛ توکن کهنه خودکار تمدید و یک بار دوباره امتحان می‌شود. */
  withToken<T>(fn: (token: string) => Promise<T>): Promise<T>;
}

const API = apiFromEnv();
const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error('AuthProvider missing');
  return v;
}

/**
 * ورود آفلاین‌محور: اگر قبلاً وارد شده باشد برنامه همان لحظه باز می‌شود و تمدید توکن بی‌صدا پشت صحنه است.
 * فقط وقتی سرور صریحاً بگوید این دستگاه بیرون شده (۴۰۱)، صفحهٔ ورود برمی‌گردد؛ نبودِ اینترنت هرگز.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(API ? 'loading' : 'off');
  const [session, setSession] = useState<SavedSession | null>(null);
  const saved = useRef<SavedSession | null>(null);
  const access = useRef<{ token: string; exp: number } | null>(null);
  const inflight = useRef<Promise<string> | null>(null);

  const adopt = useCallback(async (s: Session) => {
    // توکن تمدید یک‌بارمصرف است: اول ذخیره، بعد استفاده؛ وگرنه بستن برنامه وسط کار یعنی ورود دوباره.
    const keep: SavedSession = { refreshToken: s.refreshToken, deviceId: s.deviceId, user: s.user, office: s.office };
    await saveSession(keep);
    saved.current = keep;
    access.current = { token: s.accessToken, exp: Date.now() + s.accessExpiresIn * 1000 };
    setSession(keep);
  }, []);

  const dropSession = useCallback(async () => {
    saved.current = null;
    access.current = null;
    await clearSession();
    clearProfileQueue();
    setSession(null);
    setStatus('signedOut');
  }, []);

  const refresh = useCallback((): Promise<string> => {
    // چند درخواست هم‌زمان فقط یک تمدید می‌سازند.
    inflight.current ??= (async () => {
      const cur = saved.current;
      if (!API || !cur) throw new ApiError('unauthorized');
      try {
        const s = await API.refresh(cur.refreshToken);
        await adopt(s);
        return s.accessToken;
      } catch (e) {
        if (e instanceof ApiError && e.code === 'unauthorized') await dropSession();
        throw e;
      }
    })().finally(() => (inflight.current = null));
    return inflight.current;
  }, [adopt, dropSession]);

  useEffect(() => {
    if (!API) return;
    let live = true;
    void loadSession().then((s) => {
      if (!live) return;
      saved.current = s;
      setSession(s);
      setStatus(s ? 'signedIn' : 'signedOut');
      if (s && navigator.onLine) refresh().catch(() => {});
    });
    // برگشت اینترنت = تمدید بی‌صدا، تا اولین درخواست بعدی منتظر نماند.
    const online = () => {
      if (saved.current && !access.current) refresh().catch(() => {});
    };
    addEventListener('online', online);
    return () => {
      live = false;
      removeEventListener('online', online);
    };
  }, [refresh]);

  const value = useMemo<AuthValue>(
    () => ({
      status,
      session,
      api: API,
      signIn: async (s) => {
        await adopt(s);
        setStatus('signedIn');
      },
      signOut: async () => {
        const token = access.current?.token;
        // خروج روی همین دستگاه حتی بدون اینترنت انجام می‌شود؛ سرور اگر در دسترس بود باخبر می‌شود.
        if (API && token) await API.logout(token).catch(() => {});
        await dropSession();
      },
      markPassword: async () => {
        const cur = saved.current;
        if (!cur) return;
        const keep = { ...cur, user: { ...cur.user, hasPassword: true } };
        await saveSession(keep);
        saved.current = keep;
        setSession(keep);
      },
      setNames: async (name, officeName) => {
        const cur = saved.current;
        if (!cur) return;
        const keep = { ...cur, user: { ...cur.user, name }, office: { ...cur.office, name: officeName } };
        await saveSession(keep);
        saved.current = keep;
        setSession(keep);
      },
      withToken: async (fn) => {
        const a = access.current;
        const token = a && a.exp - 30_000 > Date.now() ? a.token : await refresh();
        try {
          return await fn(token);
        } catch (e) {
          if (!(e instanceof ApiError) || e.code !== 'unauthorized') throw e;
          access.current = null;
          return fn(await refresh());
        }
      },
    }),
    [status, session, adopt, dropSession, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
