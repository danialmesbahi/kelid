import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3-multiple-ciphers';
import { nodeSqliteDriver, openEncrypted } from './nodeDriver';
import { SqlStore } from './sqlStore';
import { seed } from '../seed';
import type { NewListing } from '../store';

const dirs: string[] = [];
function tempFile() {
  const d = mkdtempSync(join(tmpdir(), 'kelid-test-'));
  dirs.push(d);
  return join(d, 'kelid.db');
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const sample: NewListing = {
  deal: 'sale', status: 'active', kind: 'apartment', neighborhood: 'ونک', street: 'ملاصدرا', area: 90, bedrooms: 2,
  features: ['پارکینگ'], price: { total: 20_000_000_000 }, negotiable: true, owner: { name: 'مالک', phone: '0912' }, cover: 'f', photoCount: 0,
};

describe('SqlStore on encrypted SQLite', () => {
  it('seeds sample data once and survives reopening', async () => {
    const file = tempFile();
    let db = openEncrypted(Database as never, file, 'k1');
    let store = await SqlStore.open(nodeSqliteDriver(db), seed);
    expect((await store.listListings()).length).toBe(seed.listings.length);
    const added = await store.addListing(sample);
    expect(added.plaque).toBe(53);
    db.close();

    db = openEncrypted(Database as never, file, 'k1');
    store = await SqlStore.open(nodeSqliteDriver(db), seed);
    const all = await store.listListings();
    expect(all.length).toBe(seed.listings.length + 1);
    expect(all[0]!.id).toBe(added.id);
    db.close();
  });

  it('rejects the wrong key', () => {
    const file = tempFile();
    const db = openEncrypted(Database as never, file, 'right');
    db.exec('CREATE TABLE x(a)');
    db.close();
    expect(() => openEncrypted(Database as never, file, 'wrong')).toThrow();
  });

  it('searches with Persian normalization, filters by deal, archives and restores', async () => {
    const db = openEncrypted(Database as never, tempFile(), 'k');
    const store = await SqlStore.open(nodeSqliteDriver(db), seed);
    expect((await store.listListings({ query: 'سعادت آباد' })).length).toBe(2);
    expect((await store.listListings({ query: '۰۲۷' })).map((l) => l.plaque)).toEqual([27]);
    expect((await store.listListings({ deal: 'full' })).every((l) => l.deal === 'full')).toBe(true);

    const l = (await store.listListings({ query: '۰۲۷' }))[0]!;
    await store.archiveListing(l.id);
    expect(await store.getListing(l.id)).toBeUndefined();
    await store.restoreListing(l.id);
    expect((await store.getListing(l.id))?.plaque).toBe(27);

    const updated = await store.updateListing(l.id, { price: { total: 27_000_000_000 } });
    expect(updated.price.total).toBe(27_000_000_000);
    db.close();
  });

  it('records every change in the sync outbox and notifies listeners', async () => {
    const db = openEncrypted(Database as never, tempFile(), 'k');
    const store = await SqlStore.open(nodeSqliteDriver(db), seed);
    let calls = 0;
    store.subscribe(() => calls++);
    const todos = await store.listTodos();
    await store.setTodoDone(todos[1]!.id, true);
    await store.addListing(sample);
    expect(calls).toBe(2);
    const rows = db.prepare('SELECT entity, op FROM outbox ORDER BY seq').all();
    expect(rows).toEqual([{ entity: 'todo', op: 'upsert' }, { entity: 'listing', op: 'upsert' }]);
    db.close();
  });

  it('clears sample data on request', async () => {
    const db = openEncrypted(Database as never, tempFile(), 'k');
    const store = await SqlStore.open(nodeSqliteDriver(db), seed);
    await store.addListing(sample);
    expect(await store.hasSampleData()).toBe(true);
    await store.clearSampleData();
    expect(await store.hasSampleData()).toBe(false);
    expect((await store.listListings()).length).toBe(1);
    db.close();
  });
});
