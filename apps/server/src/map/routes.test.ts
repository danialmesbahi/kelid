import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import type { Queryable } from '../db';

const db = { query: async () => ({ rows: [] }) } as unknown as Queryable;
const root = mkdtempSync(join(tmpdir(), 'kelid-map-'));
const dir = join(root, 'map');
mkdirSync(dir);
const bytes = Buffer.from(Array.from({ length: 1000 }, (_, i) => i % 251));
writeFileSync(join(dir, 'kelid.pmtiles'), bytes);
writeFileSync(join(root, 'secret.pmtiles'), 'nope');
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('map tiles', () => {
  const app = buildApp({ db, logLevel: 'silent', mapDir: dir, corsOrigins: ['null'] });
  afterAll(() => app.close());

  it('serves byte ranges that the browser may cache', async () => {
    const res = await app.inject({ method: 'GET', url: '/map/kelid.pmtiles', headers: { range: 'bytes=10-19', origin: 'null' } });
    expect(res.statusCode).toBe(206);
    expect(res.rawPayload).toEqual(bytes.subarray(10, 20));
    expect(res.headers['content-range']).toBe('bytes 10-19/1000');
    expect(res.headers['cache-control']).toBe('public, max-age=3600');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['access-control-expose-headers']).toContain('etag');
    // تکهٔ آخر فایل، حتی اگر بیشتر خواسته شود
    const tail = await app.inject({ method: 'GET', url: '/map/kelid.pmtiles', headers: { range: 'bytes=990-5000' } });
    expect(tail.rawPayload).toEqual(bytes.subarray(990));
  });

  it('tells the app when the file changed under it', async () => {
    const first = await app.inject({ method: 'GET', url: '/map/kelid.pmtiles', headers: { range: 'bytes=0-9' } });
    const etag = String(first.headers.etag);
    const same = await app.inject({ method: 'GET', url: '/map/kelid.pmtiles', headers: { range: 'bytes=0-9', 'if-match': etag } });
    expect(same.statusCode).toBe(206);
    const changed = await app.inject({ method: 'GET', url: '/map/kelid.pmtiles', headers: { range: 'bytes=0-9', 'if-match': '"old"' } });
    expect(changed.statusCode).toBe(412);
  });

  it('refuses bad ranges and anything outside the map folder', async () => {
    expect((await app.inject({ method: 'GET', url: '/map/kelid.pmtiles', headers: { range: 'bytes=2000-' } })).statusCode).toBe(416);
    expect((await app.inject({ method: 'GET', url: '/map/kelid.pmtiles' })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/map/..%2Fsecret.pmtiles', headers: { range: 'bytes=0-1' } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/map/other.pmtiles', headers: { range: 'bytes=0-1' } })).statusCode).toBe(404);
  });

  it('is off without a map folder', async () => {
    const plain = buildApp({ db, logLevel: 'silent' });
    expect((await plain.inject({ method: 'GET', url: '/map/kelid.pmtiles', headers: { range: 'bytes=0-1' } })).statusCode).toBe(404);
    await plain.close();
  });
});
