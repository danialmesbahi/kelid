// پاسخ‌های API فقط JSON‌اند؛ هیچ مرورگری نباید آن‌ها را اجرا، قاب یا ذخیره کند.
export const securityHeaders = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'cache-control': 'no-store',
};
