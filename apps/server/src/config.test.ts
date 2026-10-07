import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from './config';

const url = 'postgres://kelid_app:secret@localhost:5432/kelid';

describe('loadConfig', () => {
  it('fills safe defaults', () => {
    expect(loadConfig({ DATABASE_URL: url })).toEqual({
      port: 3000,
      host: '127.0.0.1',
      databaseUrl: url,
      migrationDatabaseUrl: url,
      logLevel: 'info',
      trustProxy: false,
    });
  });

  it('uses a separate migration role when given', () => {
    const owner = 'postgresql://kelid_owner:x@db/kelid';
    expect(loadConfig({ DATABASE_URL: url, MIGRATION_DATABASE_URL: owner }).migrationDatabaseUrl).toBe(owner);
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

  it('requires DATABASE_URL', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });
});
