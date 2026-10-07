import { useEffect, useRef } from 'react';
import { usePrefsContext } from '../App';
import { useAuth } from '../auth/AuthContext';
import { flushProfile, pendingProfile } from '../auth/profile';
import { getSyncTarget, useStore } from '../data';
import { startSync } from './state';

/** وقتی وارد حساب شده‌اید و دیتابیس ماندگار است، همگام‌سازی پشت صحنه کار می‌کند. چیزی نمایش نمی‌دهد. */
export function SyncRunner() {
  const { session, withToken, api, setNames } = useAuth();
  const { setUserName, setOfficeName } = usePrefsContext();
  const store = useStore();
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

  // دادهٔ نمونه مال حالت بی‌حساب است؛ در حساب دفتر فقط دادهٔ واقعی دیده می‌شود (نمونه‌ها هرگز فرستاده هم نمی‌شوند).
  useEffect(() => {
    void store.hasSampleData().then((has) => {
      if (has) return store.clearSampleData();
    });
  }, [store]);

  // نام‌ها از سرور؛ مگر ویرایشی از همین دستگاه هنوز در راه باشد.
  const userName = session?.user.name;
  const officeName = session?.office.name;
  useEffect(() => {
    if (pendingProfile()) return;
    if (userName) setUserName(userName);
    if (officeName) setOfficeName(officeName);
  }, [userName, officeName, setUserName, setOfficeName]);

  // ویرایش نام بی‌اینترنت: با برگشت اینترنت می‌رود.
  useEffect(() => {
    if (!api) return;
    const flush = () => void flushProfile(api, (fn) => token.current(fn), (r) => void setNames(r.name, r.officeName));
    flush();
    addEventListener('online', flush);
    return () => removeEventListener('online', flush);
  }, [api, setNames]);
  return null;
}
