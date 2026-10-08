import type { DealType, Listing } from './model';
import { toFaDigits } from './persian';

const MILLION = 1_000_000;
const BILLION = 1_000_000_000;

function trimDecimal(n: number): string {
  const s = n.toFixed(1).replace(/\.0$/, '');
  return toFaDigits(s).replace('.', '٫');
}

/** مبلغ تومانی را به شکل «۲۸ میلیارد» یا «۸۰۰ میلیون» می‌نویسد. */
export function formatToman(amount: number, short = false): string {
  if (amount >= BILLION) return `${trimDecimal(amount / BILLION)} ${short ? 'م‌د' : 'میلیارد'}`;
  if (amount >= MILLION) return `${trimDecimal(amount / MILLION)} ${short ? 'م' : 'میلیون'}`;
  return formatGrouped(amount);
}

export const dealLabel: Record<DealType, string> = {
  sale: 'فروش',
  rent: 'رهن و اجاره',
  full: 'رهن کامل',
};

/** قیمت اصلی هر فایل، همان چیزی که درشت نشان داده می‌شود. */
export function headlinePrice(l: Listing, short = false): string {
  if (l.deal === 'sale') return formatToman(l.price.total ?? 0, short);
  if (l.deal === 'rent') return `ودیعه ${formatToman(l.price.deposit ?? 0, short)}`;
  return `رهن ${formatToman(l.price.deposit ?? 0, short)}`;
}

/** خط دوم قیمت: متری برای فروش، اجاره برای رهن و اجاره. */
export function secondaryPrice(l: Listing): string {
  if (l.deal === 'sale' && l.price.total && l.area) {
    return `متری ${formatToman(Math.round(l.price.total / l.area))}`;
  }
  if (l.deal === 'rent') return `اجاره ${formatToman(l.price.monthlyRent ?? 0)}`;
  return 'بدون اجاره';
}

export function listingTitle(l: Listing): string {
  const kind = l.kind === 'villa' ? 'خانهٔ ویلایی' : l.kind === 'shop' ? 'مغازه' : l.kind === 'office' ? 'دفتر کار' : l.kind === 'land' ? 'زمین' : 'آپارتمان';
  return `${kind} ${toFaDigits(l.area)} متری`;
}

export function floorLabel(l: Listing): string {
  if (l.floor === undefined) return '—';
  if (l.floorsTotal) return `${toFaDigits(l.floor)} از ${toFaDigits(l.floorsTotal)}`;
  return toFaDigits(l.floor);
}

/** ساعت به وقت تهران، مثل ۱۰:۳۰ */
// ساختن Intl.DateTimeFormat گران است (ده‌ها برابر خود format)؛ یک بار ساخته و بارها استفاده می‌شود.
const timeFmt = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tehran' });
const longFmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Tehran' });
const groupFmt = new Intl.NumberFormat('en-US');

/** عدد با جداکنندهٔ هزارگان فارسی، مثل ۱۲٬۵۰۰٬۰۰۰ */
export function formatGrouped(n: number): string {
  return toFaDigits(groupFmt.format(n)).replace(/,/g, '٬');
}

export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}

/** تاریخ جلالی، مثل «یکشنبه، ۱۲ مهر ۱۴۰۵» */
export function formatLongDate(date: Date): string {
  // ترتیب خروجی Intl بین مرورگرها فرق دارد؛ اجزا را جدا می‌گیریم و خودمان می‌چینیم.
  const parts = longFmt.formatToParts(date);
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('weekday')}، ${get('day')} ${get('month')} ${get('year')}`;
}

/** تاریخ جلالی بی روز هفته، مثل «۱۲ مهر ۱۴۰۵» */
export function formatDate(date: Date): string {
  const parts = longFmt.formatToParts(date);
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('day')} ${get('month')} ${get('year')}`;
}
