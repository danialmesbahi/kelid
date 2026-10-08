import { useEffect, useState, useSyncExternalStore } from 'react';
import { ApiError } from './api';
import { useAuth } from './auth';

export type LiveState = 'connecting' | 'live' | 'offline';

// خبرها بیرون از React تا هر صفحه فقط همان چیزی را که نشان می‌دهد تازه کند.
const subs = new Set<(offices: string[]) => void>();
const stateSubs = new Set<() => void>();
let state: LiveState = 'connecting';

function setState(next: LiveState) {
  if (next === state) return;
  state = next;
  stateSubs.forEach((f) => f());
}

/** «این دفترها عوض شدند»؛ فهرست خالی یعنی همه‌چیز را تازه کن (مثلاً بعد از قطع و وصل). */
export function onLiveChange(fn: (offices: string[]) => void): () => void {
  subs.add(fn);
  return () => void subs.delete(fn);
}

export function useLiveState(): LiveState {
  return useSyncExternalStore(
    (f) => (stateSubs.add(f), () => void stateSubs.delete(f)),
    () => state,
  );
}

const RETRY_MS = [500, 2_000, 5_000, 15_000];

/**
 * اتصال زندهٔ پنل تا وقتی واردید. قطع شد ⇒ با فاصلهٔ کم (و با برگشت اینترنت همان لحظه) دوباره وصل می‌شود
 * و بعد از وصل شدن یک بار همه‌چیز تازه می‌شود تا چیزی که وسط قطعی عوض شده جا نماند.
 */
export function useLiveConnection() {
  const { call } = useAuth();
  useEffect(() => {
    const ctl = new AbortController();
    const { signal } = ctl;
    let first = true;
    const wait = (ms: number) =>
      new Promise<void>((done) => {
        const finish = () => {
          clearTimeout(t);
          removeEventListener('online', finish);
          signal.removeEventListener('abort', finish);
          done();
        };
        const t = setTimeout(finish, ms);
        addEventListener('online', finish);
        signal.addEventListener('abort', finish);
      });

    void (async () => {
      let fails = 0;
      while (!signal.aborted) {
        const began = Date.now();
        try {
          await call((a, t) =>
            a.listen(
              t,
              {
                open: () => {
                  setState('live');
                  if (!first) subs.forEach((f) => f([]));
                  first = false;
                },
                changed: (ids) => subs.forEach((f) => f(ids)),
              },
              signal,
            ),
          );
          fails = Date.now() - began < 5_000 ? fails + 1 : 0;
        } catch (e) {
          // ورود دیگر معتبر نیست: call خودش بیرون می‌برد.
          if (e instanceof ApiError && e.code === 'unauthorized') return;
          fails++;
        }
        if (signal.aborted) return;
        setState(navigator.onLine === false || fails > 1 ? 'offline' : 'connecting');
        await wait(fails ? RETRY_MS[Math.min(fails - 1, RETRY_MS.length - 1)]! : 200);
      }
    })();
    return () => {
      ctl.abort();
      setState('connecting');
    };
  }, [call]);
}

/** دفترهایی که همین حالا عوض شدند، تا ردیفشان یک لحظه روشن شود و چشم بفهمد چه چیزی تازه است. */
export function useFlash(): ReadonlySet<string> {
  const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = onLiveChange((changed) => {
      if (!changed.length) return;
      clearTimeout(t);
      setIds(new Set(changed));
      t = setTimeout(() => setIds(new Set()), 1_800);
    });
    return () => {
      off();
      clearTimeout(t);
    };
  }, []);
  return ids;
}
