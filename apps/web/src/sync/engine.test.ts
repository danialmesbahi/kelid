import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3-multiple-ciphers';
import { SqlStore, type NewListing } from '@kelid/core';
import { nodeSqliteDriver, openEncrypted } from '@kelid/core/node';
import { ApiError } from '../auth/api';
import type { SyncTarget } from '../data';
import { demoSyncApi, type SyncApi } from './api';
import { SyncEngine } from './engine';

const dirs: string[] = [];
const handles: Array<{ close(): void }> = [];
afterEach(() => {
  // ویندوز فایل باز را پاک نمی‌کند؛ اول دیتابیس‌ها بسته می‌شوند.
  for (const db of handles.splice(0)) db.close();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
function track<T extends { close(): void }>(db: T): T {
  handles.push(db);
  return db;
}
async function device(): Promise<{ sql: SqlStore; target: SyncTarget }> {
  const d = mkdtempSync(join(tmpdir(), 'kelid-engine-'));
  dirs.push(d);
  const sql = await SqlStore.open(nodeSqliteDriver(track(openEncrypted(Database as never, join(d, 'k.db'), 'k'))));
  return { sql, target: { store: sql, subscribe: (fn) => sql.subscribe(fn), refresh: () => sql.notifyChanged() } };
}
const token = <T,>(fn: (t: string) => Promise<T>) => fn('t');
const listing: NewListing = {
  deal: 'rent', status: 'active', kind: 'apartment', neighborhood: 'ونک', street: '', area: 90, bedrooms: 2,
  features: [], price: { deposit: 500, monthlyRent: 20 }, negotiable: true, owner: { name: 'مالک', phone: '0912' }, cover: 'f', photoCount: 0,
};

describe('SyncEngine', () => {
  it('moves a new listing from one device to another and settles idle', async () => {
    const api = demoSyncApi();
    const a = await device();
    const b = await device();
    const ea = new SyncEngine(a.target, api, token, 'o1');
    const eb = new SyncEngine(b.target, api, token, 'o1');
    const made = await a.sql.addListing(listing);
    let refreshed = 0;
    b.sql.subscribe(() => refreshed++);

    await ea.run();
    expect(ea.getStatus()).toMatchObject({ phase: 'idle', pending: 0 });
    await eb.run();
    const got = await b.sql.getListing(made.id);
    expect(got?.neighborhood).toBe('ونک');
    expect(got?.plaque).toBe(made.plaque);
    expect(refreshed).toBeGreaterThan(0);
    expect(eb.getStatus().lastSync).not.toBeNull();
  });

  it('carries photo bytes across devices, and retries a photo that is not uploaded yet', async () => {
    const api = demoSyncApi();
    const a = await device();
    const b = await device();
    const l = await a.sql.addListing(listing);
    const [p] = await a.sql.addPhotos(l.id, [{ mime: 'image/webp', width: 4, height: 3, bytes: new Uint8Array([7, 7, 7]), thumb: new Uint8Array([7]) }]);
    // a فقط مشخصات را فرستاد و پیش از بالا رفتن عکس افتاد
    const noPhotos: SyncApi = { ...api, uploadPhoto: () => Promise.reject(new ApiError('offline')) };
    await new SyncEngine(a.target, noPhotos, token, 'o1').run();
    const eb = new SyncEngine(b.target, api, token, 'o1');
    await eb.run();
    expect(eb.getStatus().phase).toBe('idle');
    expect(await b.sql.listPhotos(l.id)).toEqual([]);
    expect(await b.sql.photosToDownload(10)).toEqual([p!.id]);

    await new SyncEngine(a.target, api, token, 'o1').run();
    await eb.run();
    expect([...((await b.sql.getPhoto(p!.id))?.bytes ?? [])]).toEqual([7, 7, 7]);
    expect((await b.sql.getListing(l.id))?.photoCount).toBe(1);
  });

  it('stops for a database that belongs to another office', async () => {
    const a = await device();
    await a.sql.bindOffice('o1');
    await a.sql.addListing(listing);
    let pushed = 0;
    const api: SyncApi = { ...demoSyncApi(), push: async () => (pushed++, { hlc: null }) };
    const e = new SyncEngine(a.target, api, token, 'o2');
    await e.run();
    expect(e.getStatus().phase).toBe('blocked');
    expect(pushed).toBe(0);
  });

  it('keeps the queue when the server is unreachable', async () => {
    const a = await device();
    await a.sql.addListing(listing);
    const api: SyncApi = { ...demoSyncApi(), push: () => Promise.reject(new ApiError('offline')) };
    const e = new SyncEngine(a.target, api, token, 'o1');
    await e.run();
    e.stop();
    expect(e.getStatus()).toMatchObject({ phase: 'offline', pending: 1 });
  });
});
