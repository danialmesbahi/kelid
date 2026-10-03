const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** ارقام لاتین را فارسی می‌کند. */
export function toFaDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => FA_DIGITS[Number(d)] ?? d);
}

/** ارقام فارسی و عربی را لاتین می‌کند (برای ذخیره و مقایسه). */
export function toEnDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
}

/**
 * متن را برای جستجو یکسان می‌کند تا «سعادت آباد»، «سعادت‌آباد» و «سعادتاباد»
 * و «ي/ی» یا «ك/ک» با هم جور شوند.
 */
export function normalizeForSearch(input: string): string {
  return toEnDigits(input)
    .replace(/ي/g, 'ی')
    .replace(/ى/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[ۀة]/g, 'ه')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/[‌‍\s]+/g, '')
    .toLowerCase();
}

/** شمارهٔ پلاک سه‌رقمی، مثل ۰۲۷. پلاک موقت (آفلاین) با «؟» نشان داده می‌شود. */
export function formatPlaque(plaque: number | null): string {
  if (plaque === null) return '؟';
  return toFaDigits(String(plaque).padStart(3, '0'));
}
