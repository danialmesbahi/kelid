import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3-multiple-ciphers';
import { nodeSqliteDriver, openEncrypted } from './nodeDriver';
import { SqlStore } from './sqlStore';
import { seed } from '../seed';
import { MemoryStore, type KelidStore } from '../store';
import { addDays, addJalaliMonths, formatJalaliDay, jalaliMonthDays, jalaliOf, startOfJalaliMonth, tehranIso, tehranTimeOf, weekdayIndex } from '../jalali';

const dirs: string[] = [];
function tempFile() {
  const d = mkdtempSync(join(tmpdir(), 'kelid-visits-'));
  dirs.push(d);
  return join(d, 'kelid.db');
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** قرار و کار در هر دو پیاده‌سازی یکسان رفتار می‌کنند. */
async function scenario(store: KelidStore) {
  const day = '2026-10-05';
  const v = await store.addVisit({ kind: 'visit', title: 'بازدید با آقای کریمی', startsAt: tehranIso(day, '16:30'), endsAt: tehranIso(day, '17:30'), listingId: 'l-027', clientId: 'c-1', done: false });
  const inDay = await store.listVisits(tehranIso(day, '00:00'), tehranIso(addDays(day, 1), '00:00'));
  expect(inDay.map((x) => x.id)).toContain(v.id);
  expect(tehranTimeOf(inDay.find((x) => x.id === v.id)!.startsAt)).toBe('16:30');

  const moved = await store.updateVisit(v.id, { startsAt: tehranIso(day, '18:00'), endsAt: tehranIso(day, '19:00'), done: true });
  expect(moved.done).toBe(true);
  expect((await store.getVisit(v.id))?.startsAt).toBe(tehranIso(day, '18:00'));

  const before = (await store.listTodos()).length;
  const t = await store.addTodo({ title: 'قرارداد ۰۳۱ را چاپ کن' });
  const todos = await store.listTodos();
  expect(todos.length).toBe(before + 1);
  expect(todos.at(-1)).toEqual({ id: t.id, title: 'قرارداد ۰۳۱ را چاپ کن', detail: '', action: undefined, done: false });
  await store.deleteTodo(t.id);
  expect((await store.listTodos()).some((x) => x.id === t.id)).toBe(false);
  await store.restoreTodo(t.id);
  expect((await store.listTodos()).at(-1)?.id).toBe(t.id);
  return { visitId: v.id, todoId: t.id };
}

describe('visits and todos on SqlStore', () => {
  it('adds and edits visits and todos, writing outbox rows', async () => {
    const db = openEncrypted(Database as never, tempFile(), 'k');
    const store = await SqlStore.open(nodeSqliteDriver(db), seed);
    const { visitId, todoId } = await scenario(store);
    const rows = db.prepare('SELECT entity, entity_id, op, payload FROM outbox ORDER BY seq').all() as Array<{ entity: string; entity_id: string; op: string; payload: string }>;
    expect(rows.filter((r) => r.entity_id === visitId).map((r) => r.op)).toEqual(['upsert', 'upsert']);
    expect(Object.keys(JSON.parse(rows.filter((r) => r.entity_id === visitId)[1]!.payload) as object).sort()).toEqual(['done', 'endsAt', 'startsAt']);
    expect(rows.filter((r) => r.entity_id === todoId).map((r) => r.op)).toEqual(['upsert', 'delete', 'upsert']);
    db.close();
  });

  it('records a cleared listing as null in the outbox', async () => {
    const db = openEncrypted(Database as never, tempFile(), 'k');
    const store = await SqlStore.open(nodeSqliteDriver(db), seed);
    const day = '2026-10-05';
    const v = await store.addVisit({ kind: 'visit', title: 'بازدید', startsAt: tehranIso(day, '10:00'), endsAt: tehranIso(day, '11:00'), listingId: 'l-027', done: false });
    await store.updateVisit(v.id, { listingId: undefined });
    expect((await store.getVisit(v.id))?.listingId).toBeUndefined();
    const last = db.prepare('SELECT payload FROM outbox WHERE entity_id = ? ORDER BY seq DESC LIMIT 1').get(v.id) as { payload: string };
    expect(last.payload).toBe('{"listingId":null}');
    db.close();
  });

  it('keeps the SMS reminder flag, sends it with the sync log and takes it from other devices', async () => {
    const db = openEncrypted(Database as never, tempFile(), 'k');
    const store = await SqlStore.open(nodeSqliteDriver(db), seed);
    const day = '2026-10-05';
    const v = await store.addVisit({ kind: 'visit', title: 'بازدید', startsAt: tehranIso(day, '16:30'), endsAt: tehranIso(day, '17:30'), clientId: 'c-1', done: false, remind: true });
    expect((await store.getVisit(v.id))?.remind).toBe(true);
    const last = () => JSON.parse((db.prepare('SELECT payload FROM outbox WHERE entity_id = ? ORDER BY seq DESC LIMIT 1').get(v.id) as { payload: string }).payload) as Record<string, unknown>;
    expect(last().remind).toBe(true);
    await store.updateVisit(v.id, { remind: false });
    expect(last()).toEqual({ remind: false });
    expect((await store.getVisit(v.id))?.remind).toBeUndefined();

    const other = await store.addVisit({ kind: 'visit', title: 'دیگری', startsAt: tehranIso(day, '10:00'), endsAt: tehranIso(day, '11:00'), done: false });
    db.prepare("DELETE FROM outbox WHERE entity_id = ?").run(other.id);
    await store.applyRemote([{ kind: 'visit', id: other.id, fields: { remind: true } }], '1', null);
    expect((await store.getVisit(other.id))?.remind).toBe(true);
    await store.applyRemote([{ kind: 'visit', id: other.id, fields: { remind: 'yes' } }], '2', null);
    expect((await store.getVisit(other.id))?.remind).toBe(true);
    db.close();
  });

  it('keeps visits and todos after reopening', async () => {
    const file = tempFile();
    let db = openEncrypted(Database as never, file, 'k');
    const { visitId, todoId } = await scenario(await SqlStore.open(nodeSqliteDriver(db), seed));
    db.close();
    db = openEncrypted(Database as never, file, 'k');
    const store = await SqlStore.open(nodeSqliteDriver(db), seed);
    expect((await store.getVisit(visitId))?.clientId).toBe('c-1');
    expect((await store.listTodos()).some((t) => t.id === todoId)).toBe(true);
    db.close();
  });
});

describe('visits and todos on MemoryStore', () => {
  it('behaves like SqlStore', async () => {
    await scenario(new MemoryStore(seed));
  });
});

describe('jalali calendar', () => {
  it('converts days and builds months', () => {
    expect(jalaliOf('2026-10-04')).toEqual({ y: 1405, m: 7, d: 12 });
    expect(formatJalaliDay('2026-10-04')).toBe('یکشنبه ۱۲ مهر');
    expect(weekdayIndex('2026-10-04')).toBe(1); // یکشنبه
    expect(startOfJalaliMonth('2026-10-04')).toBe('2026-09-23');
    expect(jalaliMonthDays('2026-10-04')).toHaveLength(30);
    expect(jalaliMonthDays('2026-03-21')).toHaveLength(31); // فروردین
    expect(addJalaliMonths('2026-10-04', 1)).toBe('2026-10-23'); // ۱ آبان
    expect(addJalaliMonths('2026-10-04', -1)).toBe('2026-08-23'); // ۱ شهریور
  });

  it('handles Tehran time', () => {
    expect(tehranIso('2026-10-04', '10:30')).toBe('2026-10-04T07:00:00.000Z');
    expect(tehranTimeOf('2026-10-04T07:00:00.000Z')).toBe('10:30');
  });
});
