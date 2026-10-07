// شمارهٔ موبایل ایران به یک شکل یکتا: 09xxxxxxxxx (ارقام فارسی/عربی، فاصله، +98 و 0098 پذیرفته می‌شوند).
export function normalizePhone(input: unknown): string | null {
  if (typeof input !== 'string' || input.length > 30) return null;
  let s = input.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  s = s.replace(/[\s\-()‌]/g, '');
  if (s.startsWith('+98')) s = '0' + s.slice(3);
  else if (s.startsWith('0098')) s = '0' + s.slice(4);
  else if (s.startsWith('98') && s.length === 12) s = '0' + s.slice(2);
  else if (s.startsWith('9') && s.length === 10) s = '0' + s;
  return /^09\d{9}$/.test(s) ? s : null;
}
