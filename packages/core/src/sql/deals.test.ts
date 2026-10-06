import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3-multiple-ciphers';
import { nodeSqliteDriver, openEncrypted } from './nodeDriver';
import { SqlStore } from './sqlStore';
import { seed } from '../seed';
import { MemoryStore, type KelidStore } from '../store';
import { checklistFor, suggestedCommission } from '../deals';

const dirs: string[] = [];
function tempFile() {
  const d = mkdtempSync(join(tmpdir(), 'kelid-deals-'));
  dirs.push(d);
  return join(d, 'kelid.db');
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** معامله در هر دو پیاده‌سازی یکسان رفتار می‌کند. */
async function scenario(store: KelidStore) {
  const before = (await store.listDeals()).length;
  const d = await store.addDeal({ listingId: 'l-027', clientId: 'c-1', stage: 'talking', price: 27_500_000_000, checklist: [] });
  expect((await store.listDeals()).length).toBe(before + 1);
  expect((await store.listDeals())[0]?.id).toBe(d.id);
  expect(d.closedAt).toBeUndefined();

  const done = await store.updateDeal(d.id, { stage: 'done', checklist: ['ids', 'deed'], commissionBuyer: 137_500_000 });
  expect(done.closedAt).toBeTruthy();
  expect(done.checklist).toEqual(['ids', 'deed']);
  // برگشت از «تمام شد» زمان بسته شدن را پاک می‌کند
  const back = await store.updateDeal(d.id, { stage: 'signed' });
  expect(back.closedAt).toBeUndefined();
  // «برگرداندن» روز بستن قبلی را نگه می‌دارد، نه امروز را
  const undone = await store.updateDeal(d.id, { stage: 'done', closedAt: done.closedAt });
  expect(undone.closedAt).toBe(done.closedAt);
  await store.updateDeal(d.id, { stage: 'signed' });
  expect((await store.listDeals()).find((x) => x.id === d.id)?.commissionBuyer).toBe(137_500_000);

  await store.archiveDeal(d.id);
  expect((await store.listDeals()).some((x) => x.id === d.id)).toBe(false);
  await store.restoreDeal(d.id);
  expect((await store.listDeals()).find((x) => x.id === d.id)?.stage).toBe('signed');
  return d.id;
}

describe('deals', () => {
  it('works on SqlStore, writes the outbox and survives reopening', async () => {
    const file = tempFile();
    let db = openEncrypted(Database as never, file, 'k');
    const id = await scenario(await SqlStore.open(nodeSqliteDriver(db), seed));
    const rows = db.prepare('SELECT op, payload FROM outbox WHERE entity = ? AND entity_id = ? ORDER BY seq').all('deal', id) as Array<{ op: string; payload: string }>;
    expect(rows.map((r) => r.op)).toEqual(['upsert', 'upsert', 'upsert', 'upsert', 'upsert', 'delete', 'upsert']);
    expect(Object.keys(JSON.parse(rows[1]!.payload) as object).sort()).toEqual(['checklist', 'closedAt', 'commissionBuyer', 'stage']);
    expect(JSON.parse(rows[2]!.payload)).toEqual({ stage: 'signed', closedAt: null });
    db.close();
    db = openEncrypted(Database as never, file, 'k');
    const store = await SqlStore.open(nodeSqliteDriver(db), seed);
    expect((await store.listDeals()).find((x) => x.id === id)?.price).toBe(27_500_000_000);
    expect((await store.listDeals()).find((x) => x.id === 'd-1')?.checklist).toEqual(['ids', 'deed', 'payment']);
    await store.clearSampleData();
    expect((await store.listDeals()).map((x) => x.id)).toEqual([id]);
    db.close();
  });

  it('behaves the same on MemoryStore', async () => {
    const store = new MemoryStore(seed);
    const id = await scenario(store);
    await store.clearSampleData();
    expect((await store.listDeals()).map((x) => x.id)).toEqual([id]);
  });

  it('suggests a commission per side', () => {
    expect(suggestedCommission('sale', 28_000_000_000)).toBe(140_000_000);
    // ودیعهٔ ۸۰۰ میلیون = ۲۴ میلیون اجاره؛ (۲۲ + ۲۴) ÷ ۴
    expect(suggestedCommission('rent', 800_000_000, 22_000_000)).toBe(11_500_000);
    expect(suggestedCommission('full', 2_200_000_000)).toBe(16_500_000);
    expect(checklistFor('full')).toBe(checklistFor('rent'));
  });
});
