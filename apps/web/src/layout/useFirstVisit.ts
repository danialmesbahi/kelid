import { useEffect, useState } from 'react';

const seen = new Set<string>();

/**
 * انیمیشن ورود فقط بار اول که صفحه در این اجرا باز می‌شود پخش می‌شود. برگشتن به صفحه‌ای که دیده شده
 * باید فوری باشد، نه اینکه محتوا دوباره از صفر جلوی چشم ساخته شود.
 */
export function useFirstVisit(key: string): boolean {
  const [first] = useState(() => !seen.has(key));
  useEffect(() => {
    seen.add(key);
  }, [key]);
  return first;
}
