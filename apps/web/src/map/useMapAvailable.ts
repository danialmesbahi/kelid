import { useEffect, useState } from 'react';
import { mapOff } from './provider';

let known = false;
/** نقشه فقط وقتی دیده می‌شود که فایل نقشه (از سرور یا کش دستگاه) در دسترس باشد؛ وگرنه فرم‌ها همان فرم سادهٔ همیشه‌اند. */
export function useMapAvailable(): boolean {
  const [ok, setOk] = useState(known);
  useEffect(() => {
    if (mapOff) return;
    let live = true;
    // کتابخانهٔ نقشه در بستهٔ اصلی برنامه نمی‌آید؛ فقط با اولین نقشه بار می‌شود
    const check = () =>
      void import('./tileCache')
        .then((m) => m.mapAvailable())
        .then((v) => {
          known = v;
          if (live) setOk(v);
        });
    check();
    // اینترنت که برگشت، اگر قبلاً نقشه نبود دوباره امتحان می‌کنیم
    window.addEventListener('online', check);
    return () => {
      live = false;
      window.removeEventListener('online', check);
    };
  }, []);
  return ok;
}
