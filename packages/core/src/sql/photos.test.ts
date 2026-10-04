import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3-multiple-ciphers';
import { nodeSqliteDriver, openEncrypted } from './nodeDriver';
import { SqlStore } from './sqlStore';
import { seed } from '../seed';
import { MemoryStore, type KelidStore, type NewPhoto } from '../store';

const dirs: string[] = [];
function tempFile() {
  const d = mkdtempSync(join(tmpdir(), 'kelid-photos-'));
  dirs.push(d);
  return join(d, 'kelid.db');
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const photo = (n: number): NewPhoto => ({ mime: 'image/webp', width: 1600, height: 1200, bytes: new Uint8Array([n, n, n, n]), thumb: new Uint8Array([n]) });

/** سناریوی مشترک؛ هر دو پیاده‌سازی KelidStore باید دقیقاً همین رفتار را داشته باشند. */
async function photoScenario(store: KelidStore) {
  const listingId = seed.listings[0]!.id;
  const added = await store.addPhotos(listingId, [photo(1), photo(2), photo(3)]);
  expect(added.map((p) => p.ord)).toEqual([0, 1, 2]);

  let list = await store.listPhotos(listingId);
  expect(list.map((p) => p.id)).toEqual(added.map((p) => p.id));
  expect(Array.from(list[1]!.thumb)).toEqual([2]);
  expect((await store.getListing(listingId))?.photoCount).toBe(3);

  const full = await store.getPhoto(added[2]!.id);
  expect(full?.mime).toBe('image/webp');
  expect(Array.from(full!.bytes)).toEqual([3, 3, 3, 3]);

  // عکس سوم کاور می‌شود
  await store.reorderPhotos(listingId, [added[2]!.id, added[0]!.id, added[1]!.id]);
  list = await store.listPhotos(listingId);
  expect(list.map((p) => p.id)).toEqual([added[2]!.id, added[0]!.id, added[1]!.id]);
  const cover = (await store.coverThumbs())[listingId]!;
  expect(cover.photoId).toBe(added[2]!.id);
  expect(Array.from(cover.thumb)).toEqual([3]);

  await store.deletePhoto(added[0]!.id);
  expect((await store.listPhotos(listingId)).length).toBe(2);
  expect(await store.getPhoto(added[0]!.id)).toBeUndefined();
  expect((await store.getListing(listingId))?.photoCount).toBe(2);

  await store.restorePhoto(added[0]!.id);
  expect((await store.listPhotos(listingId)).length).toBe(3);
  expect((await store.getListing(listingId))?.photoCount).toBe(3);

  // عکس تازه بعد از حذف و برگرداندن، ترتیب تکراری نمی‌گیرد
  const [extra] = await store.addPhotos(listingId, [photo(4)]);
  expect(new Set((await store.listPhotos(listingId)).map((p) => p.ord)).size).toBe(4);
  expect(extra!.ord).toBeGreaterThan(2);

  // فایل بدون عکس در کاورها نیست
  expect(Object.keys(await store.coverThumbs())).toEqual([listingId]);
  return { listingId, added };
}

/** حذف کاور، جابه‌جایی بقیه و بعد برگرداندن: کاور نباید بین دو عکس با ord یکسان دوپهلو شود. */
async function deleteReorderUndo(store: KelidStore) {
  const listingId = seed.listings[2]!.id;
  const [a, b, c] = await store.addPhotos(listingId, [photo(1), photo(2), photo(3)]);
  await store.deletePhoto(a!.id);
  await store.reorderPhotos(listingId, [c!.id, b!.id]);
  await store.restorePhoto(a!.id);
  const list = await store.listPhotos(listingId);
  expect(list.map((p) => p.id)).toEqual([c!.id, b!.id, a!.id]);
  expect(new Set(list.map((p) => p.ord)).size).toBe(3);
  expect((await store.coverThumbs())[listingId]?.photoId).toBe(c!.id);

  // برگرداندن بلافاصله بعد از حذف، عکس را سر جای خودش (حتی کاور) برمی‌گرداند
  await store.deletePhoto(c!.id);
  await store.restorePhoto(c!.id);
  expect((await store.listPhotos(listingId))[0]?.id).toBe(c!.id);
}

describe('photos on SqlStore (encrypted SQLite)', () => {
  it('adds, orders, deletes and restores photos', async () => {
    const db = openEncrypted(Database as never, tempFile(), 'k');
    await photoScenario(await SqlStore.open(nodeSqliteDriver(db), seed));
    db.close();
  });

  it('keeps the cover unambiguous after delete, reorder and undo', async () => {
    const db = openEncrypted(Database as never, tempFile(), 'k');
    await deleteReorderUndo(await SqlStore.open(nodeSqliteDriver(db), seed));
    db.close();
  });

  it('keeps photo bytes after reopening and writes outbox rows without the bytes', async () => {
    const file = tempFile();
    let db = openEncrypted(Database as never, file, 'k');
    const store = await SqlStore.open(nodeSqliteDriver(db), seed);
    const listingId = seed.listings[1]!.id;
    const [p] = await store.addPhotos(listingId, [photo(9)]);
    await store.deletePhoto(p!.id);
    await store.restorePhoto(p!.id);
    const rows = db.prepare("SELECT op, payload FROM outbox WHERE entity = 'photo' ORDER BY seq").all() as Array<{ op: string; payload: string }>;
    expect(rows.map((r) => r.op)).toEqual(['upsert', 'delete', 'upsert']);
    expect(rows[0]!.payload).not.toContain('bytes');
    db.close();

    db = openEncrypted(Database as never, file, 'k');
    const reopened = await SqlStore.open(nodeSqliteDriver(db), seed);
    expect(Array.from((await reopened.getPhoto(p!.id))!.bytes)).toEqual([9, 9, 9, 9]);
    expect((await reopened.getListing(listingId))?.photoCount).toBe(1);
    db.close();
  });

  it('removes photos of sample listings when sample data is cleared', async () => {
    const db = openEncrypted(Database as never, tempFile(), 'k');
    const store = await SqlStore.open(nodeSqliteDriver(db), seed);
    await store.addPhotos(seed.listings[0]!.id, [photo(1)]);
    await store.clearSampleData();
    expect((db.prepare('SELECT COUNT(*) AS c FROM photos').get() as { c: number }).c).toBe(0);
    db.close();
  });
});

describe('photos on MemoryStore', () => {
  it('behaves like SqlStore', async () => {
    await photoScenario(new MemoryStore(seed));
  });

  it('keeps the cover unambiguous after delete, reorder and undo', async () => {
    await deleteReorderUndo(new MemoryStore(seed));
  });
});
