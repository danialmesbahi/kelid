// پاسخ‌های API فقط JSON‌اند؛ هیچ مرورگری نباید آن‌ها را اجرا، قاب یا ذخیره کند.
export const securityHeaders = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'cache-control': 'no-store',
};

/** صفحه‌های HTML سرور (برگشت از درگاه): فقط استایل درون‌خطی و فونت همین سرور، بی اسکریپت، بی فرم، بی قاب. */
export const pageCsp = "default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
