import { useSyncExternalStore } from 'react';

/** همان مرز CSS چیدمان گوشی در app.css؛ هر دو باید با هم عوض شوند. */
const PHONE = '(max-width: 767px)';

function subscribe(onChange: () => void) {
  const mq = matchMedia(PHONE);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/** آیا صفحه به اندازهٔ گوشی است؟ با چرخاندن گوشی یا تغییر اندازهٔ پنجره به‌روز می‌شود. */
export function usePhone(): boolean {
  return useSyncExternalStore(subscribe, () => matchMedia(PHONE).matches, () => false);
}
