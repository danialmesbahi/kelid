import { buildApp } from './app';
import { ConfigError, loadConfig } from './config';
import { assertSafeRole, createPool } from './db';
import { migrate } from './migrations';
import { ConsoleSms, KavenegarSms } from './auth/sms';
import { licenseKey } from './billing/license';
import { DevGateway, ZarinpalGateway } from './billing/gateway';
import { describeAi, voiceAi } from './ai/voice';

async function main() {
  const config = loadConfig();

  const owner = createPool(config.migrationDatabaseUrl);
  const applied = await migrate(owner).finally(() => owner.end());

  const pool = createPool(config.databaseUrl);
  const { ownsTables } = await assertSafeRole(pool);

  const sms = config.sms.provider === 'kavenegar' ? new KavenegarSms(config.sms.apiKey, config.sms.template) : new ConsoleSms();
  const b = config.billing;
  const gateway =
    b.gateway?.provider === 'zarinpal'
      ? new ZarinpalGateway(b.gateway.merchantId, b.gateway.sandbox)
      : b.gateway?.provider === 'dev'
        ? new DevGateway()
        : null;
  const app = buildApp({
    db: pool,
    logLevel: config.logLevel,
    trustProxy: config.trustProxy,
    corsOrigins: config.corsOrigins,
    s3: config.s3,
    billing: { licenseKey: licenseKey(b.licenseSeed), gateway, publicUrl: b.publicUrl },
    voice: config.ai ? voiceAi(config.ai) : null,
    // پیامک console فقط در توسعه ممکن است (config در production ردش می‌کند)؛ کد در پاسخ هم می‌آید تا پیش‌نمایش بی‌پیامک کار کند.
    auth: { pool, sms, jwtSecret: config.jwtSecret, devCodes: config.sms.provider === 'console' && process.env.NODE_ENV !== 'production' },
  });
  if (applied) app.log.info(`${applied} migration(s) applied`);
  app.log.info(config.s3 ? `photos are stored in bucket ${config.s3.bucket}` : 'photos are stored in the database (set S3_* for object storage)');
  app.log.info(gateway ? `payments go through the ${gateway.name} gateway` : 'payments are off (set PAYMENT_GATEWAY)');
  app.log.info(config.ai ? `voice form filling uses ${describeAi(config.ai)}` : 'voice form filling is off (set STT_PROVIDER=avanegar or AI_API_KEY)');
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
