import { useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getSyncTarget } from '../data';
import { startSync } from './state';

/** وقتی وارد حساب شده‌اید و دیتابیس ماندگار است، همگام‌سازی پشت صحنه کار می‌کند. چیزی نمایش نمی‌دهد. */
export function SyncRunner() {
  const { session, withToken } = useAuth();
  const token = useRef(withToken);
  useEffect(() => {
    token.current = withToken;
  }, [withToken]);
  const office = session?.office.id;

  useEffect(() => {
    const target = getSyncTarget();
    if (!office || !target) return;
    return startSync(target, (fn) => token.current(fn), office);
  }, [office]);
  return null;
}
