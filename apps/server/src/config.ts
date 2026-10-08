// تنظیمات سرور فقط از متغیرهای محیطی (‎.env‎ در توسعه). مقدار اشتباه = توقف با پیام روشن.
export interface Config {
  port: number;
  host: string;
  /** اتصال روزمرهٔ سرور؛ باید نقشی بدون superuser و BYPASSRLS باشد. */
  databaseUrl: string;
  /** اتصال صاحب جدول‌ها برای migration؛ اگر نباشد همان databaseUrl. */
  migrationDatabaseUrl: string;
  logLevel: LogLevel;
  /** پشت پراکسی (nginx، لیارا…) تا IP واقعی کاربر برای محدودیت درخواست دیده شود. */
  trustProxy: boolean;
  /** امضای توکن‌های ورود و هش کدهای پیامکی؛ حداقل ۳۲ نویسهٔ تصادفی. */
  jwtSecret: string;
  sms: { provider: 'console' } | { provider: 'kavenegar'; apiKey: string; template: string };
  /** مبدأهایی که برنامهٔ وب/دسکتاپ از آن‌ها API را صدا می‌زند («null» = برنامهٔ ویندوز که از file:// باز می‌شود؛
   *  امن است چون ورود با توکن Bearer است نه کوکی). */
  corsOrigins: string[];
}

const levels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
type LogLevel = (typeof levels)[number];

export class ConfigError extends Error {}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const problems: string[] = [];

  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) problems.push('PORT باید عددی بین 1 و 65535 باشد');

  // آدرس دیتابیس رمز دارد؛ هرگز در پیام خطا چاپ نمی‌شود.
  const databaseUrl = env.DATABASE_URL ?? '';
  if (!isPostgresUrl(databaseUrl)) problems.push('DATABASE_URL تنظیم نشده یا آدرس postgres:// نیست');
  const migrationDatabaseUrl = env.MIGRATION_DATABASE_URL || databaseUrl;
  if (env.MIGRATION_DATABASE_URL && !isPostgresUrl(env.MIGRATION_DATABASE_URL)) problems.push('MIGRATION_DATABASE_URL آدرس postgres:// نیست');

  const logLevel = (env.LOG_LEVEL ?? 'info') as LogLevel;
  if (!levels.includes(logLevel)) problems.push(`LOG_LEVEL باید یکی از ${levels.join('، ')} باشد`);

  const trust = env.TRUST_PROXY ?? 'false';
  if (trust !== 'true' && trust !== 'false') problems.push('TRUST_PROXY باید true یا false باشد');

  const jwtSecret = env.JWT_SECRET ?? '';
  if (jwtSecret.length < 32) problems.push('JWT_SECRET باید دست‌کم ۳۲ نویسه باشد (مثلاً openssl rand -base64 48)');

  const production = env.NODE_ENV === 'production';
  const provider = env.SMS_PROVIDER ?? (production ? '' : 'console');
  let sms: Config['sms'] = { provider: 'console' };
  if (provider === 'kavenegar') {
    if (!env.KAVENEGAR_API_KEY || !env.KAVENEGAR_TEMPLATE) problems.push('KAVENEGAR_API_KEY و KAVENEGAR_TEMPLATE لازم‌اند');
    sms = { provider: 'kavenegar', apiKey: env.KAVENEGAR_API_KEY ?? '', template: env.KAVENEGAR_TEMPLATE ?? '' };
  } else if (provider !== 'console') {
    problems.push('SMS_PROVIDER باید kavenegar باشد (console فقط برای توسعه است)');
  } else if (production) {
    // کد ورود در لاگ = هرکس به لاگ دسترسی دارد وارد هر حسابی می‌شود.
    problems.push('SMS_PROVIDER=console در production مجاز نیست');
  }

  const corsOrigins = (env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  if (corsOrigins.some((o) => o !== 'null' && !/^[a-z][a-z0-9+.-]*:\/\/[^/\s]+$/i.test(o))) problems.push('CORS_ORIGINS باید فهرست مبدأهای کامل باشد (مثلاً https://app.kelid.ir)، نه *');

  if (problems.length) throw new ConfigError(`تنظیمات سرور ناقص است:\n- ${problems.join('\n- ')}`);
  return { port, host: env.HOST || '127.0.0.1', databaseUrl, migrationDatabaseUrl, logLevel, trustProxy: trust === 'true', jwtSecret, sms, corsOrigins };
}

function isPostgresUrl(url: string): boolean {
  return /^postgres(ql)?:\/\/./.test(url);
}
