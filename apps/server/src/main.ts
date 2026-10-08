import { buildApp } from './app';
import { ConfigError, loadConfig } from './config';
import { assertSafeRole, createPool } from './db';
import { migrate } from './migrations';
import { ConsoleSms, KavenegarSms } from './auth/sms';

async function main() {
  const config = loadConfig();

  const owner = createPool(config.migrationDatabaseUrl);
  const applied = await migrate(owner).finally(() => owner.end());

  const pool = createPool(config.databaseUrl);
  const { ownsTables } = await assertSafeRole(pool);

  const sms = config.sms.provider === 'kavenegar' ? new KavenegarSms(config.sms.apiKey, config.sms.template) : new ConsoleSms();
  const app = buildApp({
    db: pool,
    logLevel: config.logLevel,
    trustProxy: config.trustProxy,
    corsOrigins: config.corsOrigins,
    auth: { pool, sms, jwtSecret: config.jwtSecret },
  });
  if (applied) app.log.info(`${applied} migration(s) applied`);
  if (ownsTables) app.log.warn('DATABASE_URL owns the tables; use a separate MIGRATION_DATABASE_URL role in production');

  await app.listen({ port: config.port, host: config.host });

  const stop = async () => {
    await app.close();
    await pool.end();
    process.exit(0);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

main().catch((e: unknown) => {
  // خطای تنظیمات پیام فارسی روشن دارد؛ بقیه کامل چاپ می‌شوند.
  console.error(e instanceof ConfigError ? e.message : e);
  process.exit(1);
});
