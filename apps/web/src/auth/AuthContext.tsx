import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, apiFromEnv, type AuthApi, type Session } from './api';
import { clearProfileQueue } from './profile';
import { clearBetaQueues } from '../beta/beta';
import { adoptLicense, bindLicense, clearLicense } from '../billing/license';
import { clearSession, loadSession, markJoining, pendingLogouts, saveSession, setPendingLogouts, type SavedSession } from './storage';

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
  /** دعوت دفتر دیگر رد شد؛ تا تمدید بعدی هم دیگر نشان داده نمی‌شود. */
  dropInvite(): Promise<void>;
  /** پیوستن به دفتری که دعوت کرده؛ نشست تازه (دفتر تازه) جای قبلی را می‌گیرد. */
  acceptInvite(): Promise<void>;
  /** کاری که توکن دسترسی می‌خواهد؛ توکن کهنه خودکار تمدید و یک بار دوباره امتحان می‌شود. */
  withToken<T>(fn: (token: string) => Promise<T>): Promise<T>;
}

const API = apiFromEnv();

/** خروج‌هایی که سرور نشنیده بود؛ تا سرور جواب ندهد در صف می‌مانند. ۴۰۱ هم یعنی آن دستگاه از قبل بیرون است. */
let flushing: Promise<void> | null = null;
function flushLogouts(): Promise<void> {
  flushing ??= (async () => {
    const done = new Set<string>();
    for (const t of pendingLogouts()) {
      try {
        await API?.logout(t);
        done.add(t);
      } catch (e) {
        if (e instanceof ApiError && e.code === 'unauthorized') done.add(t);
      }
    }
    // فقط همان‌هایی که رسید برداشته می‌شوند؛ خروجی که همین وسط اضافه شد می‌ماند.
    if (done.size) await setPendingLogouts(pendingLogouts().filter((t) => !done.has(t))).catch(() => {});
  })().finally(() => (flushing = null));
  return flushing;
}

const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error('AuthProvider missing');
  return v;
}

/**
 * نقش شما در دفتر. بدون حساب (برنامهٔ تک‌دستگاهی) و در نشست‌های قدیمی همه‌کاره‌اید.
 * ownerPhones فقط رابط را راهنمایی می‌کند؛ خود شماره‌ها را سرور به دستگاه مشاورِ بی‌اجازه نمی‌فرستد.
 */
export function useMember(): { manager: boolean; ownerPhones: boolean } {
  const { session } = useAuth();
  const manager = (session?.user.role ?? 'manager') === 'manager';
  return { manager, ownerPhones: manager || session?.user.seeOwnerPhones !== false };
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
    const keep: SavedSession = { refreshToken: s.refreshToken, deviceId: s.deviceId, user: s.user, office: s.office, invite: s.invite ?? null };
    await saveSession(keep);
    await adoptLicense(s.license, s.office.id);
    saved.current = keep;
    access.current = { token: s.accessToken, exp: Date.now() + s.accessExpiresIn * 1000 };
    setSession(keep);
  }, []);

  const dropSession = useCallback(async () => {
    saved.current = null;
    access.current = null;
    await clearSession();
    clearProfileQueue();
    // نظر و خطای این حساب نباید با حساب بعدی (شاید دفتر دیگر) فرستاده شود.
    clearBetaQueues();
    clearLicense();
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
    void loadSession().then(async (s) => {
      // وضعیت اشتراک پیش از باز شدن برنامه؛ وگرنه دفتر تمام‌شده یک لحظه قابل ویرایش دیده می‌شد.
      await bindLicense(s?.office.id ?? null);
      if (!live) return;
      saved.current = s;
      setSession(s);
      setStatus(s ? 'signedIn' : 'signedOut');
      if (s && navigator.onLine) refresh().catch(() => {});
      if (navigator.onLine) void flushLogouts();
    });
    // برگشت اینترنت = تمدید بی‌صدا، تا اولین درخواست بعدی منتظر نماند.
    const online = () => {
      void flushLogouts();
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
        void flushLogouts();
      },
      signOut: async () => {
        // تمدیدِ در راه اول تمام شود تا توکنی که می‌فرستیم همان آخرین باشد.
        await inflight.current?.catch(() => {});
        const token = saved.current?.refreshToken;
        // خروج روی همین دستگاه حتی بدون اینترنت انجام می‌شود؛ اگر سرور نشنید، بعداً خودکار به او می‌رسد
        // تا دستگاه بیرون‌رفته جای یکی از دستگاه‌های دفتر را نگیرد.
        if (API && token) {
          await API.logout(token).catch(async (e: unknown) => {
            if (!(e instanceof ApiError) || e.code !== 'unauthorized') await setPendingLogouts([...pendingLogouts(), token]).catch(() => {});
          });
        }
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
      acceptInvite: async () => {
        if (!API) throw new ApiError('server');
        // تمدیدی که در راه است اول تمام شود؛ بعد خود پیوستن جای «تمدید در راه» می‌نشیند تا درخواست دیگری
        // (مثلاً همگام‌سازی که با توکن قدیمی ۴۰۱ گرفته) توکن تمدید را هم‌زمان نچرخاند و دستگاه بیرون نیفتد.
        await inflight.current?.catch(() => {});
        const a = access.current;
        const token = a && a.exp - 30_000 > Date.now() ? a.token : await refresh();
        const run = (async () => {
          const s = await API.acceptInvite(token);
          markJoining(s.office.id);
          await adopt(s);
          return s.accessToken;
        })();
        const wrapped: Promise<string> = run.finally(() => {
          if (inflight.current === wrapped) inflight.current = null;
        });
        inflight.current = wrapped;
        await wrapped;
      },
      dropInvite: async () => {
        const cur = saved.current;
        if (!cur) return;
        const keep = { ...cur, invite: null };
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
