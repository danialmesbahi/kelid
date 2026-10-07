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

  if (problems.length) throw new ConfigError(`تنظیمات سرور ناقص است:\n- ${problems.join('\n- ')}`);
  return { port, host: env.HOST || '127.0.0.1', databaseUrl, migrationDatabaseUrl, logLevel, trustProxy: trust === 'true' };
}

function isPostgresUrl(url: string): boolean {
  return /^postgres(ql)?:\/\/./.test(url);
}
