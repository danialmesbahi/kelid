import { useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import { flushBeta, onQueued } from './beta';

const EVERY_MS = 5 * 60_000;
const SOON_MS = 4_000;

/** صف نظرها و خطاها را پشت صحنه به سرور کلید می‌فرستد: حالا، چند ثانیه بعد از هر مورد تازه، با برگشت اینترنت و هر چند دقیقه. */
export function BetaRunner() {
  const { api, withToken } = useAuth();
  const token = useRef(withToken);
  useEffect(() => {
    token.current = withToken;
  }, [withToken]);

  useEffect(() => {
    if (!api) return;
    let soon: ReturnType<typeof setTimeout> | undefined;
    const flush = () => void flushBeta(api, (fn) => token.current(fn));
    const later = () => {
      clearTimeout(soon);
      soon = setTimeout(flush, SOON_MS);
    };
    flush();
    const off = onQueued(later);
    const timer = setInterval(flush, EVERY_MS);
    addEventListener('online', flush);
    return () => {
      off();
      clearTimeout(soon);
      clearInterval(timer);
      removeEventListener('online', flush);
    };
  }, [api]);
  return null;
}
