// تست روی PostgreSQL واقعی. محلی: npm run db:up و دو متغیر زیر (‎.env.example‎)؛ در CI کار server آن‌ها را می‌دهد.
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertSafeRole, createPool, withOffice, type Pool, type Queryable } from './db';
import { migrate, migrations } from './migrations';

const rootEnv = new URL('../../../.env', import.meta.url);
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
const appUrl = process.env.KELID_TEST_DATABASE_URL;
const ownerUrl = process.env.KELID_TEST_MIGRATION_DATABASE_URL;
if (process.env.KELID_REQUIRE_TEST_DB && !(appUrl && ownerUrl)) {
  throw new Error('KELID_TEST_DATABASE_URL and KELID_TEST_MIGRATION_DATABASE_URL are required here');
}

// جدول‌هایی که عمداً مال هیچ دفتری نیستند؛ هر جدول دیگری بدون RLS اجباری خطاست.
const SHARED_TABLES = ['schema_migrations'];

describe.skipIf(!appUrl || !ownerUrl)('database (PostgreSQL)', () => {
  let owner: Pool;
  let app: Pool;

  beforeAll(async () => {
    owner = createPool(ownerUrl!);
    app = createPool(appUrl!);
    // دیتابیس تست از صفر: فقط چیزهایی که migrationها ساخته‌اند پاک می‌شوند، نه دسترسی‌های init.sql.
    await owner.query(`do $$ declare r record; begin
      for r in select tablename from pg_tables where schemaname = 'public' loop
        execute format('drop table if exists %I cascade', r.tablename);
      end loop;
      for r in select p.oid::regprocedure as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' loop
        execute format('drop function if exists %s cascade', r.f);
      end loop;
    end $$`);
    expect(await migrate(owner)).toBe(migrations.length);
  });

  afterAll(async () => {
    await app?.end();
    await owner?.end();
  });

  it('applies migrations once', async () => {
    expect(await migrate(owner)).toBe(0);
    const { rows } = await owner.query('select max(version)::int as v from schema_migrations');
    expect(rows[0].v).toBe(migrations.length);
  });

  it('forces row-level security on every office table', async () => {
    const { rows } = await owner.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity, c.relforcerowsecurity from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'`,
    );
    const unsafe = rows.filter((r) => !SHARED_TABLES.includes(r.relname) && !(r.relrowsecurity && r.relforcerowsecurity));
    expect(unsafe.map((r) => r.relname)).toEqual([]);
    expect(rows.some((r) => r.relname === 'offices')).toBe(true);
  });

  it('office A cannot read or change office B', async () => {
    const a = randomUUID();
    const b = randomUUID();
    await withOffice(app, a, (db) => db.query('insert into offices (id, name) values ($1, $2)', [a, 'املاک الف']));
    await withOffice(app, b, (db) => db.query('insert into offices (id, name) values ($1, $2)', [b, 'املاک ب']));

    const seen = await withOffice(app, a, async (db) => (await db.query('select id from offices')).rows.map((r) => r.id));
    expect(seen).toEqual([a]);

    const changed = await withOffice(app, a, async (db) => {
      const up = await db.query("update offices set name = 'هک' where id = $1", [b]);
      const del = await db.query('delete from offices where id = $1', [b]);
      return (up.rowCount ?? 0) + (del.rowCount ?? 0);
    });
    expect(changed).toBe(0);

    // ساختن یا جابه‌جا کردن ردیف به نام دفتر دیگر هم ممنوع است.
    await expect(withOffice(app, a, (db) => db.query('insert into offices (id, name) values ($1, $2)', [randomUUID(), 'جعلی']))).rejects.toThrow(/row-level security/);
    await expect(withOffice(app, a, (db) => db.query('update offices set id = $1 where id = $2', [b, a]))).rejects.toThrow();

    const bName = await withOffice(app, b, async (db) => (await db.query('select name from offices')).rows[0]?.name);
    expect(bName).toBe('املاک ب');
  });

  it('sees nothing without an office, and the office does not leak to the next query', async () => {
    const a = randomUUID();
    await withOffice(app, a, (db) => db.query('insert into offices (id, name) values ($1, $2)', [a, 'املاک ج']));
    expect((await app.query('select id from offices')).rowCount).toBe(0);
    // چند بار پشت هم، تا اتصال‌هایی که قبلاً در تراکنش دفتر بوده‌اند هم آزموده شوند.
    for (let i = 0; i < 12; i++) expect((await app.query('select kelid_office() as o')).rows[0].o).toBeNull();
  });

  it('rolls back the whole transaction on error', async () => {
    const a = randomUUID();
    await expect(
      withOffice(app, a, async (db) => {
        await db.query('insert into offices (id, name) values ($1, $2)', [a, 'نیمه‌کاره']);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await withOffice(app, a, async (db) => (await db.query('select 1 from offices')).rowCount)).toBe(0);
  });

  it('rejects a malformed office id before touching the database', async () => {
    await expect(withOffice(app, "x'; drop table offices; --", async () => 1)).rejects.toThrow('شناسهٔ دفتر نامعتبر است');
  });

  it('the server role cannot switch row-level security off or change the schema', async () => {
    await expect(app.query('alter table offices disable row level security')).rejects.toThrow(/owner/);
    await expect(app.query('drop table offices')).rejects.toThrow(/owner/);
    await expect(app.query('create table evil (id int)')).rejects.toThrow(/permission denied/);
  });

  it('accepts the server role and refuses roles that bypass RLS', async () => {
    expect(await assertSafeRole(app)).toEqual({ ownsTables: false });
    expect(await assertSafeRole(owner)).toEqual({ ownsTables: true });
    const fake = (row: object) => ({ query: async () => ({ rows: [row] }) }) as unknown as Queryable;
    await expect(assertSafeRole(fake({ rolsuper: true, rolbypassrls: false, owns: false }))).rejects.toThrow(/superuser/);
    await expect(assertSafeRole(fake({ rolsuper: false, rolbypassrls: true, owns: false }))).rejects.toThrow(/BYPASSRLS/);
  });
});
