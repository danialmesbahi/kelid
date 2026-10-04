import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3-multiple-ciphers';
import { nodeSqliteDriver, openEncrypted } from './nodeDriver';
import { SqlStore } from './sqlStore';
import { migrations } from './schema';
import { seed } from '../seed';
import { matchListing } from '../match';
import { MemoryStore, normalizePhone, type KelidStore, type NewClient } from '../store';

const dirs: string[] = [];
function tempFile() {
  const d = mkdtempSync(join(tmpdir(), 'kelid-clients-'));
  dirs.push(d);
  return join(d, 'kelid.db');
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const tenant: NewClient = {
  name: 'خانم رضایی', phone: '۰۹۱۲ ۳۴۵ ۶۷۸۹', temperature: 'hot', waitingForNews: true, notes: 'فقط طبقهٔ بالا',
  need: { deal: 'rent', kinds: ['apartment'], neighborhoods: ['پونک'], areaMin: 75, bedroomsMin: 2, budgetMax: 1_000_000_000, rentMax: 25_000_000 },
};

/** رفتار مشترک هر دو پیاده‌سازی برای مشتری. */
async function clientScenario(store: KelidStore) {
  const c = await store.addClient(tenant);
  expect((await store.listClients()).some((x) => x.id === c.id)).toBe(true);
  expect((await store.getClient(c.id))?.notes).toBe('فقط طبقهٔ بالا');

  const edited = await store.updateClient(c.id, { name: 'خانم رضایی‌نژاد', need: { ...tenant.need, neighborhoods: ['پونک', 'شهران'] } });
  expect(edited.createdAt).toBe(c.createdAt);
  expect(edited.need.neighborhoods).toEqual(['پونک', 'شهران']);

  await store.archiveClient(c.id);
  expect(await store.getClient(c.id)).toBeUndefined();
  expect((await store.listClients()).some((x) => x.id === c.id)).toBe(false);
  await store.restoreClient(c.id);
  expect((await store.getClient(c.id))?.name).toBe('خانم رضایی‌نژاد');
  return c.id;
}

describe('clients on SqlStore', () => {
  it('adds, edits, archives and restores with outbox rows of only changed fields', async () => {
    const db = openEncrypted(Database as never, tempFile(), 'k');
    const store = await SqlStore.open(nodeSqliteDriver(db), seed);
    const id = await clientScenario(store);
    const rows = db.prepare("SELECT op, payload FROM outbox WHERE entity = 'client' AND entity_id = ? ORDER BY seq").all(id) as Array<{ op: string; payload: string }>;
    expect(rows.map((r) => r.op)).toEqual(['upsert', 'upsert', 'delete', 'upsert']);
    expect(Object.keys(JSON.parse(rows[1]!.payload) as object).sort()).toEqual(['name', 'need']);

    // ذخیرهٔ بدون تغییر چیزی نمی‌نویسد
    const cur = (await store.getClient(id))!;
    await store.updateClient(id, { name: cur.name });
    expect((db.prepare('SELECT COUNT(*) AS c FROM outbox WHERE entity_id = ?').get(id) as { c: number }).c).toBe(4);

    // جستجو با نام تازه و با شماره (ارقام فارسی و فاصله‌دار)
    const search = db.prepare('SELECT search FROM clients WHERE id = ?').get(id) as { search: string };
    expect(search.search).toContain('09123456789');
    db.close();
  });

  it('records a cleared note as null in the outbox', async () => {
    const db = openEncrypted(Database as never, tempFile(), 'k');
    const store = await SqlStore.open(nodeSqliteDriver(db), seed);
    const c = await store.addClient(tenant);
    await store.updateClient(c.id, { notes: undefined });
    expect((await store.getClient(c.id))?.notes).toBeUndefined();
    const last = db.prepare("SELECT payload FROM outbox WHERE entity_id = ? ORDER BY seq DESC LIMIT 1").get(c.id) as { payload: string };
    expect(last.payload).toBe('{"notes":null}');
    db.close();
  });

  it('keeps notes after reopening an existing database (migration adds the column)', async () => {
    const file = tempFile();
    let db = openEncrypted(Database as never, file, 'k');
    const store = await SqlStore.open(nodeSqliteDriver(db), seed);
    const c = await store.addClient(tenant);
    expect((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(migrations.length);
    db.close();
    db = openEncrypted(Database as never, file, 'k');
    const reopened = await SqlStore.open(nodeSqliteDriver(db), seed);
    expect((await reopened.getClient(c.id))?.notes).toBe('فقط طبقهٔ بالا');
    expect((await reopened.getClient('c-1'))?.notes).toBeUndefined();
    db.close();
  });
});

describe('clients on MemoryStore', () => {
  it('behaves like SqlStore', async () => {
    await clientScenario(new MemoryStore(seed));
  });
});

describe('client helpers', () => {
  it('normalizes phone numbers for duplicate checks', () => {
    expect(normalizePhone('۰۹۱۲ ۳۴۵-۶۷۸۹')).toBe('09123456789');
    expect(normalizePhone('+98 912 345 6789')).toBe('09123456789');
    expect(normalizePhone('00989123456789')).toBe('09123456789');
    expect(normalizePhone('912 345 6789')).toBe('09123456789');
    expect(normalizePhone('+98 0912 345 6789')).toBe('09123456789');
    expect(normalizePhone('0098 0912 345 6789')).toBe('09123456789');
    expect(normalizePhone('021 4455 6677')).toBe('02144556677');
  });

  it('matches rent budgets on deposit and monthly rent', () => {
    const l031 = seed.listings.find((l) => l.plaque === 31)!; // ودیعه ۸۰۰ میلیون، اجاره ۲۲ میلیون
    expect(matchListing(l031, tenant.need).reasons).toContain('قیمت');
    expect(matchListing(l031, { ...tenant.need, rentMax: 15_000_000 }).reasons).not.toContain('قیمت');
    expect(matchListing(l031, { ...tenant.need, rentMax: 21_000_000 }).misses).toContain('قیمت کمی بالاتر');
  });
});
