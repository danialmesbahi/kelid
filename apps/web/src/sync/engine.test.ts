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
    const dropped = new SyncEngine(a.target, noPhotos, token, 'o1');
    await dropped.run();
    dropped.stop(); // دور دوبارهٔ زمان‌بندی‌شده بعد از بسته شدن دیتابیس اجرا نشود
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

  it('brings every thumbnail first, then full photos a few per round or right away when one is opened', async () => {
    const api = demoSyncApi();
    const a = await device();
    const b = await device();
    const l = await a.sql.addListing(listing);
    const img = (n: number) => ({ mime: 'image/webp', width: 4, height: 3, bytes: new Uint8Array([n, n, n]), thumb: new Uint8Array([n]) });
    const added = await a.sql.addPhotos(l.id, Array.from({ length: 14 }, (_, i) => img(i + 1)));
    await new SyncEngine(a.target, api, token, 'o1').run();
    const asked: string[] = [];
    // بی تأخیر ساختگی سرور نمایشی، تا آزمون کند نشود
    const thumbs = new Map((await a.sql.listPhotos(l.id)).map((x) => [x.id, x.thumb]));
    const counting: SyncApi = {
      ...api,
      downloadPhoto: async (_t, id, part) => {
        asked.push(`${part}:${id}`);
        const full = await a.sql.getPhoto(id);
        return full ? { mime: full.mime, bytes: part === 'full' ? full.bytes : thumbs.get(id)! } : null;
      },
    };
    const eb = new SyncEngine(b.target, counting, token, 'o1');
    await eb.run();
    eb.stop();
    // همهٔ بندانگشتی‌ها پیش از هر عکس کامل
    expect(asked.slice(0, 14).every((x) => x.startsWith('thumb:'))).toBe(true);
    expect(asked.filter((x) => x.startsWith('full:'))).toHaveLength(12);
    expect(await b.sql.listPhotos(l.id)).toHaveLength(14);
    const left = await b.sql.fullPhotosToDownload(10);
    expect(left).toHaveLength(2);
    expect(await b.sql.getPhoto(left[0]!)).toBeUndefined();

    // نمایشگر عکس همان را خواست؛ دو درخواست هم‌زمان یک دریافت‌اند
    const live = new SyncEngine(b.target, counting, token, 'o1');
    asked.length = 0;
    expect(await Promise.all([live.fetchFull(left[0]!), live.fetchFull(left[0]!)])).toEqual([true, true]);
    expect(asked).toEqual([`full:${left[0]}`]);
    const n = added.findIndex((x) => x.id === left[0]) + 1;
    expect([...((await b.sql.getPhoto(left[0]!))?.bytes ?? [])]).toEqual([n, n, n]);
    // عکسی که سرور ندارد، یا خطای شبکه، فقط false است
    expect(await live.fetchFull('nope')).toBe(false);
    const offline = new SyncEngine(b.target, { ...api, downloadPhoto: () => Promise.reject(new ApiError('offline')) }, token, 'o1');
    expect(await offline.fetchFull(left[1]!)).toBe(false);
    live.stop();
    expect(await live.fetchFull(left[1]!)).toBe(false);
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

  it('pulls right away when the server says another device changed something', async () => {
    const api = demoSyncApi();
    const a = await device();
    const b = await device();
    const ea = new SyncEngine(a.target, api, token, 'o1');
    const eb = new SyncEngine(b.target, api, token, 'o1');
    void eb.listen();
    const made = await a.sql.addListing(listing);
    await ea.run();
    for (let i = 0; i < 100 && !(await b.sql.getListing(made.id)); i++) await new Promise((r) => setTimeout(r, 20));
    expect((await b.sql.getListing(made.id))?.neighborhood).toBe('ونک');
    eb.stop();
    // دوری که هنوز در راه است پیش از بسته شدن دیتابیس تمام شود
    await eb.run();
  });

  it('drops owner phones when the permission is taken away, and gets them back when it is given', async () => {
    const base = demoSyncApi();
    let phones = true;
    const api: SyncApi = {
      ...base,
      pull: async (t, cursor, limit) => {
        const page = await base.pull(t, cursor, limit);
        const hide = (f: Record<string, unknown>) => ({ ...f, owner: { ...(f.owner as object), phone: '' } });
        return { ...page, entities: page.entities.map((e) => (phones || e.kind !== 'listing' ? e : { ...e, fields: hide(e.fields) })), ownerPhones: phones };
      },
    };
    const a = await device();
    const b = await device();
    const made = await a.sql.addListing(listing);
    await new SyncEngine(a.target, api, token, 'o1').run();
    const eb = new SyncEngine(b.target, api, token, 'o1');
    await eb.run();
    expect((await b.sql.getListing(made.id))?.owner.phone).toBe('0912');

    phones = false;
    await eb.run();
    expect((await b.sql.getListing(made.id))?.owner).toEqual({ name: 'مالک', phone: '' });

    phones = true;
    await eb.run();
    expect((await b.sql.getListing(made.id))?.owner.phone).toBe('0912');
  });

  it('sends nothing with a token of another office', async () => {
    const a = await device();
    await a.sql.addListing(listing);
    let pushed = 0;
    const api: SyncApi = { ...demoSyncApi(), push: async () => (pushed++, { hlc: null }) };
    const jwt = `h.${btoa(JSON.stringify({ sub: 'u', off: 'o2', dev: 'd' })).replace(/=+$/, '')}.s`;
    const e = new SyncEngine(a.target, api, (fn) => fn(jwt), 'o1');
    await e.run();
    expect(e.getStatus().phase).toBe('blocked');
    expect(pushed).toBe(0);
  });
});
