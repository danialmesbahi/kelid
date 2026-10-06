import { useEffect, useState } from 'react';
import { addDays, formatJalaliDay, minutesToHhmm, tehranDayKey, toFaDigits, type VisitKind } from '@kelid/core';
import type { IconName } from '@kelid/ui';

/** ساعت فعلی که هر دقیقه به‌روز می‌شود؛ برای خط «اکنون» و عوض شدن روز بعد از نیمه‌شب. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export const KIND: Record<VisitKind, { label: string; icon: IconName }> = {
  visit: { label: 'بازدید', icon: 'key' },
  call: { label: 'تماس', icon: 'phone' },
  signing: { label: 'قرارداد', icon: 'doc' },
  task: { label: 'کار', icon: 'check' },
};

/** «امروز»، «فردا»، «دیروز» یا «یکشنبه ۱۲ مهر» */
export function dayName(key: string, today = tehranDayKey()): string {
  if (key === today) return 'امروز';
  if (key === addDays(today, 1)) return 'فردا';
  if (key === addDays(today, -1)) return 'دیروز';
  return formatJalaliDay(key);
}

export const faTime = (min: number) => toFaDigits(minutesToHhmm(min));

/** کلید روز معتبر از نشانی؛ هر چیز دیگری نادیده گرفته می‌شود. */
export function validDay(v: string | null): string | undefined {
  // Date.parse روزهای ناممکن مثل ۳۱ فوریه را هم می‌پذیرد؛ رفت‌وبرگشت آن‌ها را می‌گیرد
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && addDays(v, 0) === v ? v : undefined;
}
