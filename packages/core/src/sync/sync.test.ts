import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3-multiple-ciphers';
import { nodeSqliteDriver, openEncrypted } from '../sql/nodeDriver';
import { SqlStore } from '../sql/sqlStore';
import type { NewListing } from '../store';
import { Hlc, decodeHlc, encodeHlc } from './hlc';
import { mergeChange, type EntityState } from './merge';
import { applyServerChange } from './server';
import type { IncomingEntity, OutgoingChange } from './types';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
async function device(): Promise<SqlStore> {
  const d = mkdtempSync(join(tmpdir(), 'kelid-sync-'));
  dirs.push(d);
  return SqlStore.open(nodeSqliteDriver(openEncrypted(Database as never, join(d, 'k.db'), 'k')));
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
    await a.updateListing(l.id, { area: 99 }); // دیرتر
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

  it('never sends sample data, and skips malformed remote fields', async () => {
    const server = new FakeServer();
    const d = mkdtempSync(join(tmpdir(), 'kelid-sync-'));
    dirs.push(d);
    const { seed } = await import('../seed');
    const a = await SqlStore.open(nodeSqliteDriver(openEncrypted(Database as never, join(d, 'k.db'), 'k')), seed);
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
});
