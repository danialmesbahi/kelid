// تست روی PostgreSQL واقعی. محلی: npm run db:up و دو متغیر زیر (‎.env.example‎)؛ در CI کار server آن‌ها را می‌دهد.
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app';
import type { SmsSender } from './auth/sms';
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
const SHARED_TABLES = ['schema_migrations', 'users', 'devices', 'otp_codes', 'signup_tickets'];

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

  const codes = new Map<string, string>();
  const sms: SmsSender = { sendOtp: async (phone, code) => void codes.set(phone, code) };
  const newApp = () => buildApp({ db: app, logLevel: 'silent', auth: { pool: app, sms, jwtSecret: 's'.repeat(48) } });
  let n = 0;
  const freshPhone = () => `0912${String(Date.now() % 10_000_000).padStart(7, '0').slice(0, 5)}${String(n++ % 100).padStart(2, '0')}`;
  const post = (a: ReturnType<typeof newApp>, url: string, payload: object, token?: string) =>
    a.inject({ method: 'POST', url, payload, headers: token ? { authorization: `Bearer ${token}` } : {} });
  const allowResend = (phone: string) => owner.query("update otp_codes set last_sent_at = now() - interval '2 minutes' where phone = $1", [phone]);

  async function signUp(a: ReturnType<typeof newApp>, phone: string) {
    expect((await post(a, '/auth/otp', { phone })).statusCode).toBe(200);
    const v = await post(a, '/auth/verify', { phone, code: codes.get(phone)!, deviceName: 'لپ‌تاپ' });
    expect(v.statusCode).toBe(200);
    const s = await post(a, '/auth/signup', { signupToken: v.json().signupToken, name: 'علی رضایی', officeName: 'املاک پارسا', deviceName: 'لپ‌تاپ' });
    expect(s.statusCode).toBe(200);
    return s.json();
  }

  describe('phone login', () => {
    it('signs up a new office, then logs the same phone straight in', async () => {
      const a = newApp();
      const phone = freshPhone();
      const s = await signUp(a, phone);
      expect(s.user).toMatchObject({ name: 'علی رضایی', phone });
      expect(s.office.name).toBe('املاک پارسا');
      expect(s.accessExpiresIn).toBe(15 * 60);

      // دفتر تازه پشت RLS است: فقط با شناسهٔ خودش دیده می‌شود.
      expect(await withOffice(app, s.office.id, async (db) => (await db.query('select name from offices')).rows)).toEqual([{ name: 'املاک پارسا' }]);

      await allowResend(phone);
      expect((await post(a, '/auth/otp', { phone: phone.replace(/^0/, '+98') })).statusCode).toBe(200);
      const again = await post(a, '/auth/verify', { phone, code: codes.get(phone)!, deviceName: 'گوشی' });
      expect(again.json()).toMatchObject({ user: { id: s.user.id }, office: { id: s.office.id } });

      const devices = await a.inject({ method: 'GET', url: '/auth/devices', headers: { authorization: `Bearer ${again.json().accessToken}` } });
      expect(devices.json().map((d: { name: string; current: boolean }) => [d.name, d.current])).toEqual([['گوشی', true], ['لپ‌تاپ', false]]);
      await a.close();
    });

    it('stores only hashes of codes and tokens', async () => {
      const a = newApp();
      const phone = freshPhone();
      const s = await signUp(a, phone);
      const { rows } = await owner.query("select encode(refresh_hash, 'hex') as h from devices where id = $1", [s.deviceId]);
      expect(rows[0].h).not.toContain(Buffer.from(s.refreshToken).toString('hex'));
      expect(rows[0].h).toHaveLength(64);
      await a.close();
    });

    it('throttles resends and caps codes per phone per hour', async () => {
      const a = newApp();
      const phone = freshPhone();
      expect((await post(a, '/auth/otp', { phone })).statusCode).toBe(200);
      const soon = await post(a, '/auth/otp', { phone });
      expect(soon.statusCode).toBe(429);
      expect(soon.json().retryAfter).toBeGreaterThan(50);
      for (let i = 0; i < 4; i++) {
        await allowResend(phone);
        expect((await post(a, '/auth/otp', { phone })).statusCode).toBe(200);
      }
      await allowResend(phone);
      const capped = await post(a, '/auth/otp', { phone });
      expect(capped.statusCode).toBe(429);
      expect(capped.json().retryAfter).toBeGreaterThan(3000);
      await a.close();
    });

    it('limits code requests per IP', async () => {
      const a = newApp();
      for (let i = 0; i < 10; i++) expect((await post(a, '/auth/otp', { phone: freshPhone() })).statusCode).toBe(200);
      expect((await post(a, '/auth/otp', { phone: freshPhone() })).statusCode).toBe(429);
      await a.close();
    });

    it('burns the code after five wrong guesses', async () => {
      const a = newApp();
      const phone = freshPhone();
      await post(a, '/auth/otp', { phone });
      const right = codes.get(phone)!;
      const wrong = right === '000000' ? '111111' : '000000';
      const first = await post(a, '/auth/verify', { phone, code: wrong, deviceName: 'x' });
      expect(first.json()).toEqual({ error: 'wrong', attemptsLeft: 4 });
      for (let i = 0; i < 4; i++) await post(a, '/auth/verify', { phone, code: wrong, deviceName: 'x' });
      const late = await post(a, '/auth/verify', { phone, code: right, deviceName: 'x' });
      expect(late.statusCode).toBe(400);
      expect(late.json().error).toBe('expired');
      await a.close();
    });

    it('rejects an expired code and a reused signup ticket', async () => {
      const a = newApp();
      const phone = freshPhone();
      await post(a, '/auth/otp', { phone });
      await owner.query("update otp_codes set expires_at = now() - interval '1 second' where phone = $1", [phone]);
      expect((await post(a, '/auth/verify', { phone, code: codes.get(phone)!, deviceName: 'x' })).json().error).toBe('expired');

      await allowResend(phone);
      await post(a, '/auth/otp', { phone });
      const v = await post(a, '/auth/verify', { phone, code: codes.get(phone)!, deviceName: 'x' });
      const body = { signupToken: v.json().signupToken, name: 'م', officeName: 'د', deviceName: 'x' };
      expect((await post(a, '/auth/signup', body)).statusCode).toBe(200);
      expect((await post(a, '/auth/signup', body)).statusCode).toBe(400);
      await a.close();
    });

    it('rotates refresh tokens and revokes a device whose old token is replayed', async () => {
      const a = newApp();
      const s = await signUp(a, freshPhone());
      const r1 = await post(a, '/auth/refresh', { refreshToken: s.refreshToken });
      expect(r1.statusCode).toBe(200);
      expect(r1.json().refreshToken).not.toBe(s.refreshToken);
      // پاسخ گم شد و برنامه همان توکن قبلی را دوباره فرستاد: در مهلت کوتاه پذیرفته می‌شود.
      const retry = await post(a, '/auth/refresh', { refreshToken: s.refreshToken });
      expect(retry.statusCode).toBe(200);
      // بعد از مهلت، توکن کهنه یعنی دزدی: دستگاه بیرون می‌افتد و توکن تازه هم دیگر کار نمی‌کند.
      await owner.query("update devices set rotated_at = now() - interval '5 minutes' where id = $1", [s.deviceId]);
      expect((await post(a, '/auth/refresh', { refreshToken: r1.json().refreshToken })).statusCode).toBe(401);
      expect((await post(a, '/auth/refresh', { refreshToken: retry.json().refreshToken })).statusCode).toBe(401);
      const me = await a.inject({ method: 'GET', url: '/auth/devices', headers: { authorization: `Bearer ${retry.json().accessToken}` } });
      expect(me.statusCode).toBe(401);
      await a.close();
    });

    it('logs out, and a user cannot remove another user\'s device', async () => {
      const a = newApp();
      const s1 = await signUp(a, freshPhone());
      const s2 = await signUp(a, freshPhone());
      const other = await a.inject({ method: 'DELETE', url: `/auth/devices/${s2.deviceId}`, headers: { authorization: `Bearer ${s1.accessToken}` } });
      expect(other.statusCode).toBe(404);
      expect((await post(a, '/auth/logout', {}, s1.accessToken)).statusCode).toBe(204);
      expect((await a.inject({ method: 'GET', url: '/auth/devices', headers: { authorization: `Bearer ${s1.accessToken}` } })).statusCode).toBe(401);
      expect((await post(a, '/auth/refresh', { refreshToken: s1.refreshToken })).statusCode).toBe(401);
      expect((await a.inject({ method: 'GET', url: '/auth/devices', headers: { authorization: `Bearer ${s2.accessToken}` } })).statusCode).toBe(200);
      await a.close();
    });

    it('validates input', async () => {
      const a = newApp();
      expect((await post(a, '/auth/otp', { phone: '123' })).json().error).toBe('bad_phone');
      expect((await post(a, '/auth/verify', { phone: '09121234567', code: '12', deviceName: 'x' })).json().error).toBe('bad_code');
      expect((await a.inject({ method: 'GET', url: '/auth/devices' })).statusCode).toBe(401);
      expect((await a.inject({ method: 'GET', url: '/auth/devices', headers: { authorization: 'Bearer nope' } })).statusCode).toBe(401);
      await a.close();
    });
  });

  describe('sync', () => {
    const hlc = (wall: number, count = 0, node = 'dev') => `${wall.toString(36).padStart(10, '0')}-${count.toString(36).padStart(5, '0')}-${node}`;
    const t0 = Date.now() - 60_000;
    const listing = (extra: object = {}) => ({ deal: 'sale', status: 'active', kind: 'apartment', neighborhood: 'ونک', area: 90, createdAt: '2026-10-07T10:00:00Z', ...extra });
    const push = (a: ReturnType<typeof newApp>, token: string, changes: object[]) => post(a, '/sync/push', { changes }, token);
    const pull = (a: ReturnType<typeof newApp>, token: string, cursor = '0', limit?: number) =>
      a.inject({ method: 'GET', url: `/sync/pull?cursor=${cursor}${limit ? `&limit=${limit}` : ''}`, headers: { authorization: `Bearer ${token}` } });

    it('merges per field by HLC and replays are harmless', async () => {
      const a = newApp();
      const s = await signUp(a, freshPhone());
      const id = randomUUID();
      expect((await push(a, s.accessToken, [{ seq: 1, kind: 'listing', id, fields: listing({ plaque: 7 }), hlc: hlc(t0) }])).statusCode).toBe(200);
      // دستگاه دیگر: یکی جدیدتر برای area، یکی قدیمی‌تر برای neighborhood
      await push(a, s.accessToken, [
        { seq: 1, kind: 'listing', id, fields: { area: 120 }, hlc: hlc(t0 + 10, 0, 'b') },
        { seq: 2, kind: 'listing', id, fields: { neighborhood: 'قدیمی' }, hlc: hlc(t0 - 10, 0, 'b') },
      ]);
      // همان دسته دوباره رسید (پاسخ گم شده بود)
      await push(a, s.accessToken, [{ seq: 1, kind: 'listing', id, fields: listing({ plaque: 7 }), hlc: hlc(t0) }]);
      const r = (await pull(a, s.accessToken)).json();
      expect(r.entities).toHaveLength(1);
      expect(r.entities[0].fields).toMatchObject({ area: 120, neighborhood: 'ونک', plaque: 7 });
      expect(r.more).toBe(false);
      // بعد از نشانگر، چیزی تازه نیست
      expect((await pull(a, s.accessToken, r.cursor)).json().entities).toEqual([]);
      await a.close();
    });

    it('gives each listing a unique plaque in the office, keeping a free proposed one', async () => {
      const a = newApp();
      const s = await signUp(a, freshPhone());
      const [x, y, z] = [randomUUID(), randomUUID(), randomUUID()];
      await push(a, s.accessToken, [{ seq: 1, kind: 'listing', id: x, fields: listing({ plaque: 3 }), hlc: hlc(t0) }]);
      await push(a, s.accessToken, [
        { seq: 1, kind: 'listing', id: y, fields: listing({ plaque: 3 }), hlc: hlc(t0, 0, 'b') },
        { seq: 2, kind: 'listing', id: z, fields: listing(), hlc: hlc(t0, 1, 'b') },
        // پلاک بعداً از دستگاه عوض نمی‌شود
        { seq: 3, kind: 'listing', id: x, fields: { plaque: 99 }, hlc: hlc(t0 + 5, 0, 'b') },
      ]);
      const byId = Object.fromEntries((await pull(a, s.accessToken)).json().entities.map((e: { id: string; fields: { plaque: number } }) => [e.id, e.fields.plaque]));
      expect(byId).toEqual({ [x]: 3, [y]: 4, [z]: 5 });
      await a.close();
    });

    it('keeps offices apart even with the same record id', async () => {
      const a = newApp();
      const s1 = await signUp(a, freshPhone());
      const s2 = await signUp(a, freshPhone());
      const id = randomUUID();
      await push(a, s1.accessToken, [{ seq: 1, kind: 'client', id, fields: { name: 'مشتری الف', need: {}, createdAt: 'x' }, hlc: hlc(t0) }]);
      expect((await pull(a, s2.accessToken)).json().entities).toEqual([]);
      await push(a, s2.accessToken, [{ seq: 1, kind: 'client', id, fields: { name: 'جعلی' }, hlc: hlc(t0 + 99) }]);
      expect((await pull(a, s1.accessToken)).json().entities[0].fields.name).toBe('مشتری الف');
      await a.close();
    });

    it('pages through changes in order', async () => {
      const a = newApp();
      const s = await signUp(a, freshPhone());
      const changes = Array.from({ length: 7 }, (_, i) => ({ seq: i + 1, kind: 'todo', id: `t${i}`, fields: { title: `کار ${i}` }, hlc: hlc(t0, i) }));
      await push(a, s.accessToken, changes);
      const seen: string[] = [];
      let cursor = '0';
      for (;;) {
        const page = (await pull(a, s.accessToken, cursor, 3)).json();
        seen.push(...page.entities.map((e: { id: string }) => e.id));
        cursor = page.cursor;
        if (!page.more) break;
      }
      expect(seen).toEqual(changes.map((c) => c.id));
      await a.close();
    });

    it('does not let a device with a clock in the future win forever', async () => {
      const a = newApp();
      const s = await signUp(a, freshPhone());
      await push(a, s.accessToken, [{ seq: 1, kind: 'todo', id: 'clock', fields: { title: 'آینده' }, hlc: hlc(Date.now() + 365 * 864e5) }]);
      await push(a, s.accessToken, [{ seq: 2, kind: 'todo', id: 'clock', fields: { title: 'اکنون' }, hlc: hlc(Date.now() + 5_000, 0, 'b') }]);
      expect((await pull(a, s.accessToken)).json().entities[0].fields.title).toBe('اکنون');
      await a.close();
    });

    it('rejects bad input and missing auth', async () => {
      const a = newApp();
      const s = await signUp(a, freshPhone());
      expect((await push(a, '', [])).statusCode).toBe(401);
      expect((await push(a, s.accessToken, [{ seq: 1, kind: 'secret', id: 'x', fields: {}, hlc: hlc(t0) }])).statusCode).toBe(400);
      expect((await push(a, s.accessToken, [{ seq: 1, kind: 'todo', id: '../x', fields: {}, hlc: hlc(t0) }])).statusCode).toBe(400);
      expect((await push(a, s.accessToken, [{ seq: 1, kind: 'todo', id: 'x', fields: { 'bad key': 1 }, hlc: hlc(t0) }])).statusCode).toBe(400);
      expect((await push(a, s.accessToken, [{ seq: 1, kind: 'todo', id: 'x', fields: {}, hlc: 'yesterday' }])).statusCode).toBe(400);
      expect((await pull(a, s.accessToken, "1;drop")).statusCode).toBe(400);
      await a.close();
    });
  });
});
