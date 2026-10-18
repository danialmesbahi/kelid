import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from './config';
import { DEV_LICENSE_SEED } from './billing/license';

const url = 'postgres://kelid_app:secret@localhost:5432/kelid';
const base = { DATABASE_URL: url, JWT_SECRET: 'j'.repeat(40) };
// بقیهٔ چیزهایی که production لازم دارد، تا هر تست فقط یک مشکل را بسنجد.
const prodBilling = { LICENSE_PRIVATE_KEY: 'k'.repeat(43), PUBLIC_URL: 'https://api.kelid.ir' };

describe('loadConfig', () => {
  it('fills safe defaults', () => {
    expect(loadConfig(base)).toEqual({
      port: 3000,
      host: '127.0.0.1',
      databaseUrl: url,
      migrationDatabaseUrl: url,
      logLevel: 'info',
      trustProxy: false,
      jwtSecret: 'j'.repeat(40),
      sms: { provider: 'console' },
      corsOrigins: [],
      s3: null,
      billing: { licenseSeed: DEV_LICENSE_SEED, gateway: { provider: 'dev' }, publicUrl: 'http://localhost:3000' },
      ai: null,
    });
  });

  it('turns voice filling on with an API key', () => {
    expect(loadConfig({ ...base, AI_API_KEY: 'k', AI_BASE_URL: 'https://api.avalai.ir/v1/' }).ai).toEqual({
      apiKey: 'k',
      baseUrl: 'https://api.avalai.ir/v1',
      transcribeModel: 'gpt-4o-transcribe',
      extractModel: 'gpt-4.1',
    });
    expect(() => loadConfig({ ...base, AI_API_KEY: 'k', AI_BASE_URL: 'ftp://x' })).toThrow(ConfigError);
  });

  it('uses a separate migration role when given', () => {
    const owner = 'postgresql://kelid_owner:x@db/kelid';
    expect(loadConfig({ ...base, MIGRATION_DATABASE_URL: owner }).migrationDatabaseUrl).toBe(owner);
  });

  it('lists every problem and never echoes the database password', () => {
    const run = () => loadConfig({ DATABASE_URL: 'mysql://u:secret@h/db', PORT: '99999', LOG_LEVEL: 'loud', TRUST_PROXY: 'yes' });
    expect(run).toThrow(ConfigError);
    try {
      run();
    } catch (e) {
      const msg = (e as Error).message;
      for (const key of ['PORT', 'DATABASE_URL', 'LOG_LEVEL', 'TRUST_PROXY']) expect(msg).toContain(key);
      expect(msg).not.toContain('secret');
    }
  });

  it('requires DATABASE_URL and a long JWT_SECRET', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
    expect(() => loadConfig({ DATABASE_URL: url, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });

  it('never allows the console SMS adapter in production', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'production' })).toThrow(/SMS_PROVIDER/);
    expect(() => loadConfig({ ...base, NODE_ENV: 'production', SMS_PROVIDER: 'console' })).toThrow(/production/);
    expect(() => loadConfig({ ...base, NODE_ENV: 'production', SMS_PROVIDER: 'kavenegar' })).toThrow(/KAVENEGAR/);
    const ok = loadConfig({ ...base, ...prodBilling, NODE_ENV: 'production', SMS_PROVIDER: 'kavenegar', KAVENEGAR_API_KEY: 'k', KAVENEGAR_TEMPLATE: 't' });
    expect(ok.sms).toEqual({ provider: 'kavenegar', apiKey: 'k', template: 't' });
  });

  it('takes photo storage only when fully and safely configured', () => {
    const s3 = { S3_ENDPOINT: 'https://s3.ir-thr-at1.arvanstorage.ir/', S3_BUCKET: 'kelid-photos', S3_ACCESS_KEY_ID: 'a', S3_SECRET_ACCESS_KEY: 'topsecret' };
    expect(loadConfig({ ...base, ...s3, S3_REGION: 'ir-thr-at1' }).s3).toEqual({
      endpoint: 'https://s3.ir-thr-at1.arvanstorage.ir',
      region: 'ir-thr-at1',
      bucket: 'kelid-photos',
      accessKeyId: 'a',
      secretAccessKey: 'topsecret',
    });
    expect(() => loadConfig({ ...base, S3_ENDPOINT: s3.S3_ENDPOINT })).toThrow(/S3_SECRET_ACCESS_KEY/);
    expect(() => loadConfig({ ...base, ...s3, S3_BUCKET: 'Bad_Bucket' })).toThrow(/S3_BUCKET/);
    expect(loadConfig({ ...base, ...s3, S3_ENDPOINT: 'http://localhost:9000' }).s3?.endpoint).toBe('http://localhost:9000');
    const prod = { ...base, NODE_ENV: 'production', SMS_PROVIDER: 'kavenegar', KAVENEGAR_API_KEY: 'k', KAVENEGAR_TEMPLATE: 't' };
    expect(() => loadConfig({ ...prod, ...s3, S3_ENDPOINT: 'http://minio:9000' })).toThrow(/https/);
    try {
      loadConfig({ ...base, ...s3, S3_ENDPOINT: 'nope' });
    } catch (e) {
      expect((e as Error).message).not.toContain('topsecret');
    }
  });

  it('accepts explicit CORS origins only', () => {
    expect(loadConfig({ ...base, CORS_ORIGINS: 'https://app.kelid.ir, null' }).corsOrigins).toEqual(['https://app.kelid.ir', 'null']);
    expect(() => loadConfig({ ...base, CORS_ORIGINS: '*' })).toThrow(/CORS_ORIGINS/);
    expect(() => loadConfig({ ...base, CORS_ORIGINS: 'https://a.ir/path' })).toThrow(/CORS_ORIGINS/);
  });

  it('keeps billing safe in production', () => {
    const prod = { ...base, ...prodBilling, NODE_ENV: 'production', SMS_PROVIDER: 'kavenegar', KAVENEGAR_API_KEY: 'k', KAVENEGAR_TEMPLATE: 't' };
    // بدون درگاه: پرداخت خاموش، مجوز روشن.
    expect(loadConfig(prod).billing).toEqual({ licenseSeed: 'k'.repeat(43), gateway: null, publicUrl: 'https://api.kelid.ir' });
    expect(() => loadConfig({ ...prod, LICENSE_PRIVATE_KEY: undefined })).toThrow(/LICENSE_PRIVATE_KEY/);
    expect(() => loadConfig({ ...prod, LICENSE_PRIVATE_KEY: DEV_LICENSE_SEED })).toThrow(/LICENSE_PRIVATE_KEY/);
    expect(() => loadConfig({ ...prod, PAYMENT_GATEWAY: 'dev' })).toThrow(/PAYMENT_GATEWAY/);
    expect(() => loadConfig({ ...prod, PUBLIC_URL: 'http://api.kelid.ir' })).toThrow(/PUBLIC_URL/);
    expect(() => loadConfig({ ...prod, PAYMENT_GATEWAY: 'zarinpal', ZARINPAL_MERCHANT_ID: 'x' })).toThrow(/ZARINPAL_MERCHANT_ID/);
    const zp = loadConfig({ ...prod, PAYMENT_GATEWAY: 'zarinpal', ZARINPAL_MERCHANT_ID: '1344b5d4-0048-11e8-94db-005056a205be' });
    expect(zp.billing.gateway).toEqual({ provider: 'zarinpal', merchantId: '1344b5d4-0048-11e8-94db-005056a205be', sandbox: false });
  });
});
