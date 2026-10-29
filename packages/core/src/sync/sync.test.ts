import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3-multiple-ciphers';
import { nodeSqliteDriver, openEncrypted } from '../sql/nodeDriver';
import { SqlStore } from '../sql/sqlStore';
import { bestMatches } from '../match';
import type { NewListing } from '../store';
import { Hlc, decodeHlc, encodeHlc } from './hlc';
import { mergeChange, type EntityState } from './merge';
import { applyServerChange } from './server';
import type { IncomingEntity, OutgoingChange, PhotoBlob } from './types';

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
async function device(): Promise<SqlStore> {
  const d = mkdtempSync(join(tmpdir(), 'kelid-sync-'));
  dirs.push(d);
  return SqlStore.open(nodeSqliteDriver(track(openEncrypted(Database as never, join(d, 'k.db'), 'k'))));
}

/** همان رفتار سرور، در حافظه: ادغام، شمارهٔ نسخه برای دریافت، و پلاک یکتا در دفتر. */
class FakeServer {
  rows = new Map<string, { state: EntityState; version: number; kind: IncomingEntity['kind']; id: string }>();
  version = 0;
  push(changes: OutgoingChange[]) {
    for (const c of changes) {
      const key = `${c.kind}:${c.id}`;
      const cur = this.rows.get(key);
      const taken = new Set([...this.rows.values()].filter((r) => r.kind === 'listing').map((r) => r.state.fields.plaque));
      const { state, changed } = applyServerChange(cur?.state, c, (p) => {
        if (p !== null && !taken.has(p)) return p;
        return Math.max(0, ...[...taken].map(Number)) + 1;
      });
      if (changed) this.rows.set(key, { state, version: ++this.version, kind: c.kind, id: c.id });
    }
  }
  pull(cursor: string, limit: number) {
    const list = [...this.rows.values()].filter((r) => r.version > Number(cursor)).sort((a, b) => a.version - b.version).slice(0, limit);
    return { entities: list.map((r) => ({ kind: r.kind, id: r.id, fields: r.state.fields })), cursor: String(list.at(-1)?.version ?? cursor), more: list.length === limit };
  }
}

async function sync(store: SqlStore, server: FakeServer, batch = 3) {
  for (;;) {
    const { changes, lastSeq } = await store.pendingChanges(batch);
    if (!lastSeq) break;
    server.push(changes);
    await store.ackChanges(lastSeq);
  }
  for (;;) {
    const { cursor } = await store.syncInfo();
    const page = server.pull(cursor, batch);
    await store.applyRemote(page.entities, page.cursor, null);
    if (!page.more) break;
  }
}

const listing = (n: number): NewListing => ({
  deal: 'sale', status: 'active', kind: 'apartment', neighborhood: `محله ${n}`, street: '', area: 50 + n, bedrooms: 1,
  features: [], price: { total: n * 1000 }, negotiable: true, owner: { name: 'مالک', phone: '0912' }, cover: 'f', photoCount: 0,
});

describe('HLC', () => {
  it('orders lexically and never goes backwards', () => {
    let t = 1000;
    const h = new Hlc('a', () => t);
    const a = h.now();
    t = 500; // ساعت دستگاه عقب رفت
    const b = h.now();
    expect(b > a).toBe(true);
    h.receive(encodeHlc({ wall: 9_000_000, count: 3, node: 'z' }));
    const c = h.now();
    expect(c > encodeHlc({ wall: 9_000_000, count: 3, node: 'z' })).toBe(true);
    expect(decodeHlc(c)).toEqual({ wall: 9_000_000, count: 4, node: 'a' });
    expect(decodeHlc('nope')).toBeNull();
  });
});

describe('mergeChange', () => {
  it('keeps the newest write per field and ignores replays', () => {
    let s = mergeChange(undefined, { a: 1, b: 1 }, 'h2').state;
    s = mergeChange(s, { a: 2 }, 'h1').state; // قدیمی‌تر
    s = mergeChange(s, { b: 3 }, 'h3').state;
    expect(s.fields).toEqual({ a: 1, b: 3 });
    expect(mergeChange(s, { b: 3 }, 'h3').changed).toBe(false);
  });
});

describe('sync between two offline devices', () => {
  it('converges after random offline edits on both', async () => {
    // تولید عدد شبه‌تصادفی با بذر ثابت، تا هر شکست دوباره قابل تکرار باشد.
    for (const seedValue of [1, 7, 42]) {
      let x = seedValue;
      const rnd = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
      const pick = <T>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)]!;
      const server = new FakeServer();
      const a = await device();
      const b = await device();
      for (let step = 0; step < 120; step++) {
        const d = rnd() < 0.5 ? a : b;
        const listings = await d.listListings();
        const clients = await d.listClients();
        const r = rnd();
        if (r < 0.15 || listings.length === 0) await d.addListing(listing(step));
        else if (r < 0.4) await d.updateListing(pick(listings).id, { area: Math.floor(rnd() * 300), price: { total: step } });
        else if (r < 0.48) await d.archiveListing(pick(listings).id);
        else if (r < 0.58) await d.addClient({ name: `مشتری ${step}`, phone: '', need: { deal: 'rent', kinds: [], neighborhoods: [] }, temperature: 'warm', waitingForNews: false });
        else if (r < 0.7 && clients.length) await d.updateClient(pick(clients).id, { name: `نام ${step}`, temperature: pick(['hot', 'cold'] as const) });
        else if (r < 0.78) await d.addTodo({ title: `کار ${step}` });
        else if (r < 0.85) {
          const todos = await d.listTodos();
          if (todos.length) await d.setTodoDone(pick(todos).id, rnd() < 0.5);
        } else await sync(d, server, 1 + Math.floor(rnd() * 4));
      }
      // دو دور کامل: هر کدام بفرستد و بگیرد
      for (let i = 0; i < 2; i++) {
        await sync(a, server);
        await sync(b, server);
      }
      const view = async (s: SqlStore) => ({
        listings: (await s.listListings()).map(({ photoCount: _p, updatedAt: _u, ...l }) => l).sort((p, q) => p.id.localeCompare(q.id)),
        clients: (await s.listClients()).map(({ lastContactAt: _l, ...c }) => c).sort((p, q) => p.id.localeCompare(q.id)),
        todos: (await s.listTodos()).sort((p, q) => p.id.localeCompare(q.id)),
      });
      const va = await view(a);
      expect(va).toEqual(await view(b));
      expect(va.listings.length).toBeGreaterThan(3);
      // پلاک‌ها در دفتر یکتا و همه داده شده‌اند
      const plaques = va.listings.map((l) => l.plaque);
      expect(new Set(plaques).size).toBe(plaques.length);
      expect(plaques.every((p) => typeof p === 'number')).toBe(true);
      expect((await a.syncInfo()).pending).toBe(0);
    }
  });

  it('keeps an unsent local edit when the server sends an older value', async () => {
    const server = new FakeServer();
    const a = await device();
    const b = await device();
    const l = await a.addListing(listing(1));
    await sync(a, server);
    await sync(b, server);
    await b.updateListing(l.id, { area: 77 });
    // «دیرتر» یعنی یک میلی‌ثانیه بعد؛ در همان میلی‌ثانیه برنده را شناسهٔ دستگاه تعیین می‌کند (درست، ولی تصادفی برای تست).
    await new Promise((r) => setTimeout(r, 5));
    await a.updateListing(l.id, { area: 99 });
    await sync(b, server); // b می‌فرستد و می‌گیرد
    await a.applyRemote(server.pull('0', 100).entities, '999', null); // a هنوز نفرستاده
    expect((await a.getListing(l.id))?.area).toBe(99);
    await sync(a, server);
    await sync(b, server);
    expect((await b.getListing(l.id))?.area).toBe(99);
  });

  it('a lost acknowledgement just resends; nothing is lost or doubled', async () => {
    const server = new FakeServer();
    const a = await device();
    await a.addListing(listing(1));
    await a.addTodo({ title: 'زنگ به مالک' });
    const first = await a.pendingChanges(10);
    server.push(first.changes); // پاسخ سرور نرسید؛ چیزی پاک نشد
    await sync(a, server);
    expect(server.rows.size).toBe(2);
    expect((await a.listTodos()).map((t) => t.title)).toEqual(['زنگ به مالک']);
  });

  it('reads a synced client need with nulls as empty, so matching still works', async () => {
    const b = await device();
    const need = { deal: 'sale', kinds: ['apartment'], neighborhoods: ['محله 3'], areaMin: null, areaMax: null, bedroomsMin: null, budgetMax: null, rentMax: null };
    await b.applyRemote([{ kind: 'client', id: 'c1', fields: { name: 'مشتری', phone: '', need, createdAt: '2026-01-01T00:00:00Z' } }], '1', null);
    const c = (await b.getClient('c1'))!;
    expect(c.need.budgetMax).toBeUndefined();
    expect(bestMatches([{ ...listing(3), id: 'l1', plaque: 1, createdAt: '', updatedAt: '' }], c.need)).toHaveLength(1);
  });

  it('skips a remote client need without kinds or neighborhoods instead of stopping the sync', async () => {
    const b = await device();
    const good = { deal: 'rent', kinds: ['apartment'], neighborhoods: [] };
    await b.applyRemote(
      [
        { kind: 'client', id: 'bad', fields: { name: 'ناقص', phone: '', need: { deal: 'rent', budgetMax: 5 }, createdAt: '2026-01-01T00:00:00Z' } },
        { kind: 'client', id: 'ok', fields: { name: 'سالم', phone: '', need: good, createdAt: '2026-01-01T00:00:00Z' } },
      ],
      '1',
      null,
    );
    expect((await b.listClients()).map((c) => c.id)).toEqual(['ok']);
    // مشتری‌ای که از قبل هست نیاز سالمش را نگه می‌دارد
    await b.applyRemote([{ kind: 'client', id: 'ok', fields: { need: { deal: 'sale' } } }], '2', null);
    expect((await b.getClient('ok'))!.need).toEqual(good);
  });

  it('never sends sample data, and skips malformed remote fields', async () => {
    const server = new FakeServer();
    const d = mkdtempSync(join(tmpdir(), 'kelid-sync-'));
    dirs.push(d);
    const { seed } = await import('../seed');
    const a = await SqlStore.open(nodeSqliteDriver(track(openEncrypted(Database as never, join(d, 'k.db'), 'k'))), seed);
    const sampleListing = (await a.listListings())[0]!;
    await a.updateListing(sampleListing.id, { area: 1 });
    const { changes, lastSeq } = await a.pendingChanges(10);
    expect(changes).toEqual([]);
    expect(lastSeq).toBeGreaterThan(0);

    const b = await device();
    await b.applyRemote([{ kind: 'listing', id: 'x1', fields: { ...listing(3), area: 'big', createdAt: '2026-01-01T00:00:00Z', plaque: 5 } }], '1', null);
    expect(await b.getListing('x1')).toBeUndefined(); // area لازم بود و خراب بود
    await b.applyRemote([{ kind: 'listing', id: 'x1', fields: { ...listing(3), features: 'nope', createdAt: '2026-01-01T00:00:00Z', plaque: 5 } }], '2', null);
    expect((await b.getListing('x1'))?.features).toEqual([]);
    void server;
  });

  it('moves photo bytes too: metadata first, bytes after, deletes and order follow', async () => {
    const server = new FakeServer();
    const blobs = new Map<string, PhotoBlob>();
    const a = await device();
    const b = await device();
    const l = await a.addListing(listing(1));
    const img = (n: number) => ({ mime: 'image/webp', width: 800, height: 600, bytes: new Uint8Array([n, 1, 2, 3]), thumb: new Uint8Array([n, 9]) });
    const [p1, p2] = await a.addPhotos(l.id, [img(1), img(2)]);
    await sync(a, server);
    for (const x of await a.photosToUpload(10)) blobs.set(x.id, x);
    await a.markPhotosUploaded([...blobs.keys()]);
    expect(await a.photosToUpload(10)).toEqual([]);

    await sync(b, server);
    // مشخصات رسیده، بایت‌ها نه: عکس هنوز دیده نمی‌شود و شمرده نمی‌شود.
    expect(await b.listPhotos(l.id)).toEqual([]);
    expect((await b.getListing(l.id))?.photoCount).toBe(0);
    const want = await b.photosToDownload(10);
    expect(want.sort()).toEqual([p1!.id, p2!.id].sort());
    for (const id of want) await b.savePhotoThumb(id, blobs.get(id)!.thumb);
    // بندانگشتی رسید: عکس در فهرست هست و شمرده می‌شود، ولی عکس کامل هنوز نه.
    expect((await b.listPhotos(l.id)).map((p) => [p.id, [...p.thumb]])).toEqual([[p1!.id, [1, 9]], [p2!.id, [2, 9]]]);
    expect((await b.getListing(l.id))?.photoCount).toBe(2);
    expect(await b.photosToDownload(10)).toEqual([]);
    expect(await b.getPhoto(p2!.id)).toBeUndefined();
    expect((await b.fullPhotosToDownload(10)).sort()).toEqual([p1!.id, p2!.id].sort());
    await b.savePhotoFull(p2!.id, 'image/webp', blobs.get(p2!.id)!.bytes);
    expect([...((await b.getPhoto(p2!.id))?.bytes ?? [])]).toEqual([2, 1, 2, 3]);
    expect([...((await b.listPhotos(l.id))[1]?.thumb ?? [])]).toEqual([2, 9]);
    expect(await b.fullPhotosToDownload(10)).toEqual([p1!.id]);
    // عکس کامل تکراری یا عکسی که بندانگشتی‌اش نرسیده چیزی را عوض نمی‌کند
    await b.savePhotoFull(p2!.id, 'image/webp', new Uint8Array([0]));
    expect([...((await b.getPhoto(p2!.id))?.bytes ?? [])]).toEqual([2, 1, 2, 3]);
    await b.savePhotoFull(p1!.id, 'image/webp', blobs.get(p1!.id)!.bytes);
    expect(await b.fullPhotosToDownload(10)).toEqual([]);
    expect((await b.getListing(l.id))?.photoCount).toBe(2);
    expect(await b.photosToUpload(10)).toEqual([]); // از سرور آمده؛ دوباره فرستاده نمی‌شود

    await a.reorderPhotos(l.id, [p2!.id, p1!.id]);
    await a.deletePhoto(p1!.id);
    await sync(a, server);
    await sync(b, server);
    expect((await b.listPhotos(l.id)).map((p) => p.id)).toEqual([p2!.id]);
    expect((await b.getListing(l.id))?.photoCount).toBe(1);
  });

  it('never uploads photos of sample listings, and a reset clears the office from the device', async () => {
    const d = mkdtempSync(join(tmpdir(), 'kelid-sync-'));
    dirs.push(d);
    const { seed } = await import('../seed');
    const a = await SqlStore.open(nodeSqliteDriver(track(openEncrypted(Database as never, join(d, 'k.db'), 'k'))), seed);
    const sampleListing = (await a.listListings())[0]!;
    await a.addPhotos(sampleListing.id, [{ mime: 'image/jpeg', width: 1, height: 1, bytes: new Uint8Array([1]), thumb: new Uint8Array([1]) }]);
    expect(await a.photosToUpload(10)).toEqual([]);
    expect((await a.pendingChanges(50)).changes.filter((c) => c.kind === 'photo')).toEqual([]);
    // نمونه‌ها پاک شدند: صفِ ویرایش‌هایشان هم دیگر به دفتر نمی‌رود (پیش‌تر عکس بی‌صاحب به سرور می‌رسید)
    await a.clearSampleData();
    expect((await a.pendingChanges(500)).changes).toEqual([]);
    // عکسی از سرور که فایلش روی این دستگاه نیست، هر دور دوباره پرسیده نمی‌شود
    await a.applyRemote([{ kind: 'photo', id: 'p-orphan', fields: { listingId: 'l-gone', ord: 0, mime: 'image/jpeg', width: 1, height: 1, createdAt: '2026-01-01T00:00:00Z' } }], '1', null);
    expect(await a.photosToDownload(10)).toEqual([]);

    await a.bindOffice('office-a');
    await a.addTodo({ title: 'کار' });
    await a.resetLocalData();
    expect(await a.listListings()).toEqual([]);
    expect(await a.listTodos()).toEqual([]);
    expect(await a.syncInfo()).toEqual({ office: null, cursor: '0', pending: 0 });
  });
});
