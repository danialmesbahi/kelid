import { describe, expect, it } from 'vitest';
import { buildApp } from './app';
import type { Queryable } from './db';

const okDb = { query: async () => ({ rows: [] }) } as unknown as Queryable;
const downDb = { query: async () => Promise.reject(new Error('connect ECONNREFUSED')) } as unknown as Queryable;

describe('server app', () => {
  it('reports health and sends security headers', async () => {
    const app = buildApp({ db: okDb, logLevel: 'silent' });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    await app.close();
  });

  it('returns 503 without leaking the database error', async () => {
    const app = buildApp({ db: downDb, logLevel: 'silent' });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(503);
    expect(res.body).not.toContain('ECONNREFUSED');
    await app.close();
  });

  it('hides internal error details', async () => {
    const app = buildApp({ db: okDb, logLevel: 'silent' });
    app.get('/boom', async () => {
      throw new Error('relation "secret_table" does not exist');
    });
    const res = await app.inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: 'internal' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    await app.close();
  });

  it('answers unknown routes with 404 JSON', async () => {
    const app = buildApp({ db: okDb, logLevel: 'silent' });
    const res = await app.inject({ method: 'GET', url: '/nope' });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
