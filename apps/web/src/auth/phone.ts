import { toEnDigits, toFaDigits } from '@kelid/core';

/** فقط رقم‌های انگلیسی؛ ‎+98‎ و ‎0098‎ و ۹۱۲… هم به ۰۹… برمی‌گردند. */
export function phoneDigits(input: string): string {
  let d = toEnDigits(input).replace(/\D/g, '');
  if (d.startsWith('0098')) d = '0' + d.slice(4);
  else if (d.startsWith('98') && d.length >= 12) d = '0' + d.slice(2);
  else if (d.startsWith('9')) d = '0' + d;
  return d.slice(0, 11);
}

/** ۰۹۱۲ ۳۴۵ ۶۷۸۹ — همان گروه‌بندی که روی کارت ویزیت‌ها دیده می‌شود. */
export function formatPhone(d: string): string {
  return toFaDigits([d.slice(0, 4), d.slice(4, 7), d.slice(7, 11)].filter(Boolean).join(' '));
}
