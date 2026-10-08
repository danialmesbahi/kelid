import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3-multiple-ciphers';
import { nodeSqliteDriver, openEncrypted } from './nodeDriver';
import { SqlStore } from './sqlStore';
import { seed } from '../seed';
import { MemoryStore, changedFields, type KelidStore } from '../store';

const dirs: string[] = [];
function tempFile() {
  const d = mkdtempSync(join(tmpdir(), 'kelid-edit-'));
  dirs.push(d);
  return join(d, 'kelid.db');
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** ویرایش فایل در هر دو پیاده‌سازی باید یکسان رفتار کند. */
async function editScenario(store: KelidStore) {
  const l = (await store.listListings({ query: '۰۲۷' }))[0]!;
  const edited = await store.updateListing(l.id, { street: 'ایران‌زمین', status: 'reserved', price: { total: 26_500_000_000 }, owner: { name: 'آقای تازه', phone: '09121111111' } });
  expect(edited.plaque).toBe(27);
  expect(edited.createdAt).toBe(l.createdAt);
  expect(edited.status).toBe('reserved');
  expect(edited.owner).toEqual({ name: 'آقای تازه', phone: '09121111111', bestTime: undefined });

  // جستجو باید نام تازهٔ خیابان را پیدا کند و نام قبلی را نه
  expect((await store.listListings({ query: 'ایران زمین' })).map((x) => x.id)).toEqual([l.id]);
  expect((await store.listListings({ query: 'سرو غربی' })).length).toBe(0);

  // تغییر نوع معامله: قیمت قبلی با undefined صریح پاک می‌شود
  const rent = await store.updateListing(l.id, { deal: 'rent', price: { total: undefined, deposit: 900_000_000, monthlyRent: 25_000_000 } });
  expect(rent.price).toEqual({ total: undefined, deposit: 900_000_000, monthlyRent: 25_000_000 });
  return l.id;
}

describe('editing a listing on SqlStore', () => {
  it('keeps the plaque, updates search and writes only changed fields to the outbox', async () => {
    const db = openEncrypted(Database as never, tempFile(), 'k');
    const store = await SqlStore.open(nodeSqliteDriver(db), seed);
    let calls = 0;
    store.subscribe(() => calls++);
    const id = await editScenario(store);

    const rows = (db.prepare("SELECT payload FROM outbox WHERE entity = 'listing' AND entity_id = ? ORDER BY seq").all(id) as Array<{ payload: string }>).map((r) => JSON.parse(r.payload) as Record<string, unknown>);
    expect(Object.keys(rows[0]!).sort()).toEqual(['owner', 'price', 'status', 'street']);
    expect(Object.keys(rows[1]!).sort()).toEqual(['deal', 'price']);

    // ذخیرهٔ بدون تغییر: نه نوشتن، نه outbox، نه اعلان
    const before = calls;
    const cur = (await store.getListing(id))!;
    await store.updateListing(id, { street: cur.street, price: { ...cur.price } });
    expect(calls).toBe(before);
    expect((db.prepare("SELECT COUNT(*) AS c FROM outbox WHERE entity_id = ?").get(id) as { c: number }).c).toBe(2);
    db.close();
  });

  it('writes cleared fields as null and leaves the photo count alone', async () => {
    const db = openEncrypted(Database as never, tempFile(), 'k');
    const store = await SqlStore.open(nodeSqliteDriver(db), seed);
    const l = (await store.listListings({ query: '۰۲۷' }))[0]!;
    await store.updateListing(l.id, { description: 'یادداشت' });
    // کار عکس هم‌زمان شمار عکس را عوض کرده؛ ویرایش نباید آن را به مقدار کهنه برگرداند
    db.prepare('UPDATE listings SET photo_count = 7 WHERE id = ?').run(l.id);
    await store.updateListing(l.id, { description: undefined });

    const last = db.prepare("SELECT payload FROM outbox WHERE entity_id = ? ORDER BY seq DESC LIMIT 1").get(l.id) as { payload: string };
    expect(JSON.parse(last.payload)).toEqual({ description: null });
    const after = (await store.getListing(l.id))!;
    expect(after.description).toBeUndefined();
    expect(after.photoCount).toBe(7);
    db.close();
  });

  it('keeps a map location, sends it with the sync log and clears it', async () => {
    const db = openEncrypted(Database as never, tempFile(), 'k');
    const store = await SqlStore.open(nodeSqliteDriver(db), seed);
    const [l, other] = [(await store.listListings({ query: '۰۲۷' }))[0]!, (await store.listListings({ query: '۰۵۲' }))[0]!];
    expect(l.location).toBeDefined();
    const at = { lat: 35.7512, lng: 51.4103 };
    expect((await store.updateListing(l.id, { location: at })).location).toEqual(at);
    const payload = () => JSON.parse((db.prepare('SELECT payload FROM outbox WHERE entity_id = ? ORDER BY seq DESC LIMIT 1').get(l.id) as { payload: string }).payload) as unknown;
    expect(payload()).toEqual({ location: at });
    await store.updateListing(l.id, { location: undefined });
    expect(payload()).toEqual({ location: null });
    expect((await store.getListing(l.id))!.location).toBeUndefined();

    // از دستگاه دیگر: نقطهٔ معتبر می‌نشیند، نقطهٔ بیرون از کرهٔ زمین نادیده گرفته می‌شود
    await store.applyRemote([{ kind: 'listing', id: other.id, fields: { location: { lat: 35.7, lng: 51.3 } } }], '1', null);
    expect((await store.getListing(other.id))!.location).toEqual({ lat: 35.7, lng: 51.3 });
    await store.applyRemote([{ kind: 'listing', id: other.id, fields: { location: { lat: 135, lng: 51.3 } } }], '2', null);
    expect((await store.getListing(other.id))!.location).toEqual({ lat: 35.7, lng: 51.3 });
    await store.applyRemote([{ kind: 'listing', id: other.id, fields: { location: null } }], '3', null);
    expect((await store.getListing(other.id))!.location).toBeUndefined();
    db.close();
  });

  it('persists edits after reopening', async () => {
    const file = tempFile();
    let db = openEncrypted(Database as never, file, 'k');
    const id = await editScenario(await SqlStore.open(nodeSqliteDriver(db), seed));
    db.close();
    db = openEncrypted(Database as never, file, 'k');
    const l = await (await SqlStore.open(nodeSqliteDriver(db), seed)).getListing(id);
    expect(l?.street).toBe('ایران‌زمین');
    expect(l?.deal).toBe('rent');
    expect(l?.plaque).toBe(27);
    db.close();
  });
});

describe('editing a listing on MemoryStore', () => {
  it('behaves like SqlStore', async () => {
    await editScenario(new MemoryStore(seed));
  });

  it('keeps and clears a map location', async () => {
    const store = new MemoryStore(seed);
    const l = (await store.listListings({ query: '۰۲۷' }))[0]!;
    expect((await store.updateListing(l.id, { location: { lat: 35.75, lng: 51.41 } })).location).toEqual({ lat: 35.75, lng: 51.41 });
    expect((await store.updateListing(l.id, { location: undefined })).location).toBeUndefined();
  });
});

describe('changedFields', () => {
  it('ignores identity and timestamps and compares nested objects by value', () => {
    const l = seed.listings[0]!;
    expect(changedFields(l, { ...l, updatedAt: 'x', features: [...l.features] })).toEqual({});
    expect(changedFields(l, { ...l, features: [...l.features, 'تازه'] })).toEqual({ features: [...l.features, 'تازه'] });
  });
});
