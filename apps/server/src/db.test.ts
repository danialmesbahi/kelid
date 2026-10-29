// تست روی PostgreSQL واقعی. محلی: npm run db:up و دو متغیر زیر (‎.env.example‎)؛ در CI کار server آن‌ها را می‌دهد.
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app';
import type { SmsSender } from './auth/sms';
import { assertSafeRole, createPool, withOffice, type Pool, type Queryable } from './db';
import { migrate, migrations } from './migrations';
import { DEV_LICENSE_SEED, licenseKey, publicKeyOf, verifyLicense } from './billing/license';
import { DevGateway } from './billing/gateway';
import { decodeLicense, planById, priceOf, termDays } from '@kelid/core/plans';
import { hashPassword } from './auth/password';
import { newTotpSecret, totpAt, totpStep } from './admin/totp';
import { withVendor } from './db';
import { kickVendor } from './sync/live';

const rootEnv = new URL('../../../.env', import.meta.url);
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
const appUrl = process.env.KELID_TEST_DATABASE_URL;
const ownerUrl = process.env.KELID_TEST_MIGRATION_DATABASE_URL;
if (process.env.KELID_REQUIRE_TEST_DB && !(appUrl && ownerUrl)) {
  throw new Error('KELID_TEST_DATABASE_URL and KELID_TEST_MIGRATION_DATABASE_URL are required here');
}

// جدول‌هایی که عمداً مال هیچ دفتری نیستند؛ هر جدول دیگری بدون RLS اجباری خطاست.
const SHARED_TABLES = ['schema_migrations', 'users', 'devices', 'otp_codes', 'signup_tickets', 'invites', 'device_tickets'];

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
      for r in select sequencename from pg_sequences where schemaname = 'public' loop
        execute format('drop sequence if exists %I cascade', r.sequencename);
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
    const s = await post(a, '/auth/signup', { signupToken: v.json().signupToken, name: 'علی رضایی', officeName: 'املاک پارسا', city: 'بوشهر', deviceName: 'لپ‌تاپ', password: 'parsa-1404' });
    expect(s.statusCode).toBe(200);
    return s.json();
  }

  describe('phone login', () => {
    it('signs up a new office, then logs the same phone straight in', async () => {
      const a = newApp();
      const phone = freshPhone();
      const s = await signUp(a, phone);
      expect(s.user).toMatchObject({ name: 'علی رضایی', phone });
      expect(s.office).toMatchObject({ name: 'املاک پارسا', city: 'بوشهر' });
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

    it('caps signed-in devices of an office at its seats; a login past it must sign one out first', async () => {
      const a = newApp();
      const phone = freshPhone();
      const s = await signUp(a, phone);
      await withOffice(owner, s.office.id, (db) => db.query('update offices set seats = 2 where id = $1', [s.office.id]));
      // یک حساب می‌تواند چند دستگاه داشته باشد، تا سقف نفرات دفتر
      const second = await post(a, '/auth/login', { phone, password: 'parsa-1404', deviceName: 'گوشی' });
      expect(second.statusCode).toBe(200);

      // رمز اشتباه هنوز همان جواب همیشگی است؛ فهرست دستگاه‌ها فقط بعد از رمز درست دیده می‌شود.
      expect((await post(a, '/auth/login', { phone, password: 'nope-nope', deviceName: 'تبلت' })).json()).toEqual({ error: 'wrong' });
      const full = await post(a, '/auth/login', { phone, password: 'parsa-1404', deviceName: 'تبلت' });
      expect(full.statusCode).toBe(409);
      const limit = full.json();
      expect(limit).toMatchObject({ error: 'device_limit', seats: 2 });
      expect(limit.devices.map((d: { name: string; owner: string; mine: boolean }) => [d.name, d.owner, d.mine]).sort()).toEqual([
        ['گوشی', 'علی رضایی', true],
        ['لپ‌تاپ', 'علی رضایی', true],
      ].sort());
      expect((await owner.query('select count(*)::int as n from devices where user_id = $1 and revoked_at is null', [s.user.id])).rows[0].n).toBe(2);

      // با کد پیامکی هم همین است
      await allowResend(phone);
      await post(a, '/auth/otp', { phone });
      expect((await post(a, '/auth/verify', { phone, code: codes.get(phone)!, deviceName: 'تبلت' })).statusCode).toBe(409);

      expect((await post(a, '/auth/devices/replace', { ticket: 'nope', deviceId: s.deviceId })).json().error).toBe('expired');
      const ok = await post(a, '/auth/devices/replace', { ticket: limit.ticket, deviceId: s.deviceId });
      expect(ok.statusCode).toBe(200);
      expect(ok.json()).toMatchObject({ user: { id: s.user.id }, office: { id: s.office.id } });
      // دستگاه قبلی همان لحظه بیرون است و بلیت یک‌بار مصرف است
      expect((await post(a, '/auth/refresh', { refreshToken: s.refreshToken })).statusCode).toBe(401);
      expect((await post(a, '/auth/devices/replace', { ticket: limit.ticket, deviceId: second.json().deviceId })).json().error).toBe('expired');
      const devices = await a.inject({ method: 'GET', url: '/auth/devices', headers: { authorization: `Bearer ${ok.json().accessToken}` } });
      expect(devices.json().map((d: { name: string; current: boolean }) => [d.name, d.current]).sort()).toEqual([['تبلت', true], ['گوشی', false]].sort());

      // همکار دفتر هم در همین سقف است؛ دستگاه مدیر را نمی‌تواند بیرون کند، دستگاه‌های خودش را می‌تواند
      const mate = freshPhone();
      await owner.query(
        "insert into users (id, office_id, phone, name, password_hash, role) select $2, office_id, $3, 'همکار', password_hash, 'agent' from users where id = $1",
        [s.user.id, randomUUID(), mate],
      );
      const blocked = (await post(a, '/auth/login', { phone: mate, password: 'parsa-1404', deviceName: 'x' })).json();
      expect(blocked.devices.every((d: { locked: boolean }) => d.locked)).toBe(true);
      expect((await post(a, '/auth/devices/replace', { ticket: blocked.ticket, deviceId: ok.json().deviceId })).statusCode).toBe(409);
      expect((await post(a, '/auth/refresh', { refreshToken: ok.json().refreshToken })).statusCode).toBe(200);

      // دستگاهی که دیگر تمدید نمی‌شود (۱۸۰ روز سر نزده) جا نمی‌گیرد
      await owner.query("update devices set last_seen_at = now() - interval '181 days' where user_id = $1", [s.user.id]);
      expect((await post(a, '/auth/login', { phone: mate, password: 'parsa-1404', deviceName: 'x' })).statusCode).toBe(200);
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
      const body = { signupToken: v.json().signupToken, name: 'م', officeName: 'د', deviceName: 'x', password: '12345678' };
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
      // خروجِ عقب‌افتاده با توکن تمدید (بدون توکن دسترسی)؛ تکرارش هم همان جواب را می‌گیرد.
      expect((await post(a, '/auth/signout', { refreshToken: s2.refreshToken })).statusCode).toBe(204);
      expect((await post(a, '/auth/refresh', { refreshToken: s2.refreshToken })).statusCode).toBe(401);
      expect((await post(a, '/auth/signout', { refreshToken: s2.refreshToken })).statusCode).toBe(204);
      await a.close();
    });

    it('logs in with the password; a wrong password and an unknown phone get the same answer', async () => {
      const a = newApp();
      const phone = freshPhone();
      const s = await signUp(a, phone);
      expect(s.user.hasPassword).toBe(true);
      const { rows } = await owner.query('select password_hash from users where id = $1', [s.user.id]);
      expect(rows[0].password_hash).toMatch(/^scrypt\$/);
      expect(rows[0].password_hash).not.toContain('parsa-1404');

      const ok = await post(a, '/auth/login', { phone: phone.replace(/^0/, '+98'), password: 'parsa-1404', deviceName: 'گوشی' });
      expect(ok.statusCode).toBe(200);
      expect(ok.json()).toMatchObject({ user: { id: s.user.id, hasPassword: true }, office: { id: s.office.id } });
      const wrong = await post(a, '/auth/login', { phone, password: 'parsa-1403', deviceName: 'x' });
      const nobody = await post(a, '/auth/login', { phone: freshPhone(), password: 'parsa-1404', deviceName: 'x' });
      expect([wrong.statusCode, wrong.json()]).toEqual([400, { error: 'wrong' }]);
      expect([nobody.statusCode, nobody.json()]).toEqual([400, { error: 'wrong' }]);
      await a.close();
    });

    it('locks a phone for a while after five wrong passwords', async () => {
      const a = newApp();
      const phone = freshPhone();
      await signUp(a, phone);
      for (let i = 0; i < 5; i++) expect((await post(a, '/auth/login', { phone, password: 'nope-nope', deviceName: 'x' })).json().error).toBe('wrong');
      const locked = await post(a, '/auth/login', { phone, password: 'parsa-1404', deviceName: 'x' });
      expect(locked.statusCode).toBe(429);
      expect(locked.json().retryAfter).toBeGreaterThan(14 * 60);
      await owner.query("update users set locked_until = now() - interval '1 second' where phone = $1", [phone]);
      expect((await post(a, '/auth/login', { phone, password: 'parsa-1404', deviceName: 'x' })).statusCode).toBe(200);
      await a.close();
    });

    it('changes the password with the current one, or without it right after an SMS login', async () => {
      const a = newApp();
      const phone = freshPhone();
      await signUp(a, phone);
      const pwd = (await post(a, '/auth/login', { phone, password: 'parsa-1404', deviceName: 'x' })).json();
      expect((await post(a, '/auth/password', { password: 'new-pass-1' }, pwd.accessToken)).json().error).toBe('wrong');
      expect((await post(a, '/auth/password', { password: 'new-pass-1', current: 'bad-guess' }, pwd.accessToken)).json().error).toBe('wrong');
      expect((await post(a, '/auth/password', { password: 'short', current: 'parsa-1404' }, pwd.accessToken)).json().error).toBe('bad_password');
      expect((await post(a, '/auth/password', { password: 'new-pass-1', current: 'parsa-1404' }, pwd.accessToken)).statusCode).toBe(204);
      expect((await post(a, '/auth/login', { phone, password: 'new-pass-1', deviceName: 'x' })).statusCode).toBe(200);

      // رمز فراموش شد: ورود با کد پیامکی، بعد رمز تازه بدون رمز قبلی — فقط یک بار.
      await allowResend(phone);
      await post(a, '/auth/otp', { phone });
      const otp = (await post(a, '/auth/verify', { phone, code: codes.get(phone)!, deviceName: 'گوشی' })).json();
      expect((await post(a, '/auth/password', { password: 'forgot-1404' }, otp.accessToken)).statusCode).toBe(204);
      expect((await post(a, '/auth/password', { password: 'again-1404' }, otp.accessToken)).json().error).toBe('wrong');
      expect((await post(a, '/auth/login', { phone, password: 'forgot-1404', deviceName: 'x' })).statusCode).toBe(200);
      expect((await post(a, '/auth/password', { password: 'x'.repeat(8) })).statusCode).toBe(401);
      await a.close();
    });

    it('updates the name and the office name for every device of the office', async () => {
      const a = newApp();
      const phone = freshPhone();
      const s = await signUp(a, phone);
      const r = await post(a, '/auth/profile', { name: ' مریم احمدی ', officeName: 'املاک آفتاب' }, s.accessToken);
      expect(r.json()).toEqual({ name: 'مریم احمدی', officeName: 'املاک آفتاب', city: 'بوشهر' });
      expect((await post(a, '/auth/profile', { city: 'شیراز' }, s.accessToken)).json().city).toBe('شیراز');
      const again = (await post(a, '/auth/refresh', { refreshToken: s.refreshToken })).json();
      expect([again.user.name, again.office.name, again.office.city]).toEqual(['مریم احمدی', 'املاک آفتاب', 'شیراز']);
      expect((await post(a, '/auth/profile', { officeName: '  ' }, s.accessToken)).json().error).toBe('bad_name');
      expect((await post(a, '/auth/profile', { name: 'x' })).statusCode).toBe(401);
      await a.close();
    });

    it('returns the code only when the dev console SMS is on', async () => {
      const dev = buildApp({ db: app, logLevel: 'silent', auth: { pool: app, sms, jwtSecret: 's'.repeat(48), devCodes: true } });
      const phone = freshPhone();
      expect((await post(dev, '/auth/otp', { phone })).json().devCode).toBe(codes.get(phone));
      await dev.close();
      const prod = newApp();
      expect((await post(prod, '/auth/otp', { phone: freshPhone() })).json().devCode).toBeUndefined();
      await prod.close();
    });

    it('validates input', async () => {
      const a = newApp();
      expect((await post(a, '/auth/otp', { phone: '123' })).json().error).toBe('bad_phone');
      expect((await post(a, '/auth/verify', { phone: '09121234567', code: '12', deviceName: 'x' })).json().error).toBe('bad_code');
      expect((await post(a, '/auth/login', { phone: '12', password: 'x', deviceName: 'x' })).json().error).toBe('bad_phone');
      expect((await post(a, '/auth/login', { phone: '09121234567', password: 'x'.repeat(129), deviceName: 'x' })).statusCode).toBe(400);
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

    it('stores photo bytes per office: real images only, never readable by another office', async () => {
      const a = newApp();
      const s1 = await signUp(a, freshPhone());
      const s2 = await signUp(a, freshPhone());
      const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.from([1, 2, 3])]).toString('base64');
      const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 9]).toString('base64');
      const put = (t: string, id: string, body: object) => post(a, `/sync/photos/${id}`, body, t);
      const get = (t: string, id: string, part = 'full') => a.inject({ method: 'GET', url: `/sync/photos/${id}/${part}`, headers: { authorization: `Bearer ${t}` } });
      expect((await put(s1.accessToken, 'p1', { mime: 'image/webp', bytes: webp, thumb: jpeg })).statusCode).toBe(204);
      // دوباره فرستادن بی‌اثر است و عکس را عوض نمی‌کند
      expect((await put(s1.accessToken, 'p1', { mime: 'image/jpeg', bytes: jpeg, thumb: jpeg })).statusCode).toBe(204);
      const full = await get(s1.accessToken, 'p1');
      expect(full.headers['content-type']).toBe('image/webp');
      expect(full.headers['x-content-type-options']).toBe('nosniff');
      expect(full.rawPayload.toString('base64')).toBe(webp);
      const thumb = await get(s1.accessToken, 'p1', 'thumb');
      expect(thumb.headers['content-type']).toBe('image/jpeg');
      expect(thumb.rawPayload.toString('base64')).toBe(jpeg);
      expect((await get(s2.accessToken, 'p1')).statusCode).toBe(404);
      expect((await get(s1.accessToken, 'nope')).statusCode).toBe(404);
      expect((await get(s1.accessToken, 'p1', 'meta')).statusCode).toBe(400);
      // فایلی که خودش را عکس جا زده
      const html = Buffer.from('<script>alert(1)</script>').toString('base64');
      expect((await put(s1.accessToken, 'p2', { mime: 'image/jpeg', bytes: html, thumb: jpeg })).json().error).toBe('bad_photo');
      expect((await put(s1.accessToken, 'p2', { mime: 'text/html', bytes: html, thumb: jpeg })).statusCode).toBe(400);
      expect((await put(s1.accessToken, 'a.b', { mime: 'image/jpeg', bytes: jpeg, thumb: jpeg })).statusCode).toBe(400);
      expect((await post(a, '/sync/photos/p3', { mime: 'image/jpeg', bytes: jpeg, thumb: jpeg })).statusCode).toBe(401);
      await a.close();
    });

    it('keeps photo bytes in object storage, under the office id, and only behind the office row', async () => {
      const objects = new Map<string, { body: Buffer; type: string | null }>();
      let failPuts = false;
      const realFetch = globalThis.fetch;
      // یک S3 ساختگی در حافظه؛ فقط درخواست‌های امضاشده را می‌پذیرد.
      globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (!url.startsWith('https://s3.test/')) return realFetch(input, init);
        const h = init?.headers as Record<string, string>;
        if (!h.authorization?.startsWith('AWS4-HMAC-SHA256 Credential=AK/')) return new Response(null, { status: 403 });
        const key = decodeURIComponent(new URL(url).pathname);
        if (init?.method === 'PUT') {
          if (failPuts) return new Response('<Error>SlowDown</Error>', { status: 503 });
          objects.set(key, { body: Buffer.from(init.body as Uint8Array), type: h['content-type'] ?? null });
          return new Response(null, { status: 200 });
        }
        const o = objects.get(key);
        return o ? new Response(new Uint8Array(o.body), { status: 200 }) : new Response(null, { status: 404 });
      }) as typeof fetch;
      const a = buildApp({ db: app, logLevel: 'silent', auth: { pool: app, sms, jwtSecret: 's'.repeat(48) }, s3: { endpoint: 'https://s3.test', region: 'r', bucket: 'b', accessKeyId: 'AK', secretAccessKey: 'SK' } });
      try {
        const s1 = await signUp(a, freshPhone());
        const s2 = await signUp(a, freshPhone());
        const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.from([7, 7])]);
        const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 3]);
        const body = { mime: 'image/webp', bytes: webp.toString('base64'), thumb: jpeg.toString('base64') };
        const get = (t: string, id: string, part: string) => a.inject({ method: 'GET', url: `/sync/photos/${id}/${part}`, headers: { authorization: `Bearer ${t}` } });

        expect((await post(a, '/sync/photos/s1', body, s1.accessToken)).statusCode).toBe(204);
        const row = await withOffice(app, s1.office.id, async (db) => (await db.query('select stored, bytes, thumb, size, thumb_mime, object_key from photo_blobs where id = $1', ['s1'])).rows[0]);
        expect(row).toMatchObject({ stored: 's3', bytes: null, thumb: null, size: webp.length, thumb_mime: 'image/jpeg' });
        expect(row.object_key).toMatch(new RegExp(`^${s1.office.id}/s1/[0-9a-f]{32}$`));
        expect(objects.get(`/b/${row.object_key}/full`)).toEqual({ body: webp, type: 'image/webp' });
        expect(objects.get(`/b/${row.object_key}/thumb`)).toEqual({ body: jpeg, type: 'image/jpeg' });
        // ارسال دوباره (حتی با بایت دیگر) نه چیزی بالا می‌برد نه عکس ثبت‌شده را عوض می‌کند.
        expect((await post(a, '/sync/photos/s1', { ...body, bytes: Buffer.concat([webp, Buffer.from([9])]).toString('base64') }, s1.accessToken)).statusCode).toBe(204);
        expect(objects.size).toBe(2);

        expect((await get(s1.accessToken, 's1', 'full')).rawPayload).toEqual(webp);
        expect((await get(s1.accessToken, 's1', 'thumb')).rawPayload).toEqual(jpeg);
        // دفتر دیگر ردیفی ندارد، پس هرگز به S3 نمی‌رسد؛ همان شناسه برای او جای دیگری است.
        expect((await get(s2.accessToken, 's1', 'full')).statusCode).toBe(404);
        expect((await post(a, '/sync/photos/s1', body, s2.accessToken)).statusCode).toBe(204);
        expect([...objects.keys()].filter((k) => k.startsWith(`/b/${s2.office.id}/s1/`))).toHaveLength(2);

        // اگر S3 خطا بدهد ردیفی نمی‌ماند و متن خطای S3 به کاربر نمی‌رسد؛ دستگاه بعداً دوباره می‌فرستد.
        failPuts = true;
        const bad = await post(a, '/sync/photos/s2', body, s1.accessToken);
        expect(bad.statusCode).toBe(500);
        expect(bad.body).not.toContain('SlowDown');
        expect((await get(s1.accessToken, 's2', 'thumb')).statusCode).toBe(404);
        failPuts = false;
        expect((await post(a, '/sync/photos/s2', body, s1.accessToken)).statusCode).toBe(204);
        expect((await get(s1.accessToken, 's2', 'thumb')).rawPayload).toEqual(jpeg);
      } finally {
        globalThis.fetch = realFetch;
        await a.close();
      }
    });

    it('tells the other devices of the office, live, that something changed', async () => {
      const a = newApp();
      await a.listen({ port: 0, host: '127.0.0.1' });
      const base = `http://127.0.0.1:${(a.server.address() as AddressInfo).port}`;
      const phone = freshPhone();
      const s1 = await signUp(a, phone);
      const s2 = (await post(a, '/auth/login', { phone, password: 'parsa-1404', deviceName: 'گوشی' })).json();
      const other = await signUp(a, freshPhone());
      const open = async (token: string) => {
        const ctl = new AbortController();
        const res = await fetch(`${base}/sync/events`, { headers: { authorization: `Bearer ${token}` }, signal: ctl.signal });
        const state = { text: '', ended: false };
        void (async () => {
          const reader = res.body!.getReader();
          const dec = new TextDecoder();
          try {
            for (;;) {
              const { value, done } = await reader.read();
              if (done) break;
              state.text += dec.decode(value);
            }
          } catch {
            // بستن از سمت تست
          }
          state.ended = true;
        })();
        return { res, state, stop: () => ctl.abort() };
      };
      const until = async (ok: () => boolean) => {
        for (let i = 0; i < 100 && !ok(); i++) await new Promise((r) => setTimeout(r, 20));
        return ok();
      };
      const e1 = await open(s1.accessToken);
      const e2 = await open(s2.accessToken);
      const eo = await open(other.accessToken);
      expect(e1.res.status).toBe(200);
      expect(e1.res.headers.get('content-type')).toMatch(/^text\/event-stream/);
      expect(e1.res.headers.get('x-content-type-options')).toBe('nosniff');

      await push(a, s1.accessToken, [{ seq: 1, kind: 'listing', id: randomUUID(), fields: listing(), hlc: hlc(t0) }]);
      expect(await until(() => e2.state.text.includes('data: change'))).toBe(true);
      await new Promise((r) => setTimeout(r, 150));
      // فرستنده خودش خبر نمی‌گیرد و دفتر دیگر هیچ‌چیز نمی‌شنود
      expect(e1.state.text).not.toContain('data: change');
      expect(eo.state.text).not.toContain('data: change');

      // دستگاهِ بیرون‌شده همان لحظه قطع می‌شود
      expect((await a.inject({ method: 'DELETE', url: `/auth/devices/${s2.deviceId}`, headers: { authorization: `Bearer ${s1.accessToken}` } })).statusCode).toBe(204);
      expect(await until(() => e2.state.ended)).toBe(true);
      // یک دستگاه بیش از سه اتصال باز نگه نمی‌دارد؛ قدیمی‌ترین بسته می‌شود
      const more = [await open(s1.accessToken), await open(s1.accessToken), await open(s1.accessToken)];
      expect(await until(() => e1.state.ended)).toBe(true);
      expect(more.some((m) => m.state.ended)).toBe(false);
      expect((await fetch(`${base}/sync/events`)).status).toBe(401);
      for (const e of [eo, ...more]) e.stop();
      await a.close();
    });

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

  describe('team', () => {
    const get = (a: ReturnType<typeof newApp>, url: string, token: string) => a.inject({ method: 'GET', url, headers: { authorization: `Bearer ${token}` } });
    const del = (a: ReturnType<typeof newApp>, url: string, token: string) => a.inject({ method: 'DELETE', url, headers: { authorization: `Bearer ${token}` } });
    const hlc = (wall: number, node = 'dev') => `${wall.toString(36).padStart(10, '0')}-00000-${node}`;
    const t0 = Date.now() - 60_000;

    /** شمارهٔ دعوت‌شده با کد وارد می‌شود و به دفتر می‌پیوندد. */
    async function join(a: ReturnType<typeof newApp>, phone: string, name = 'سارا مشاور') {
      await post(a, '/auth/otp', { phone });
      const v = (await post(a, '/auth/verify', { phone, code: codes.get(phone)!, deviceName: 'گوشی' })).json();
      expect(v.signupToken).toBeTruthy();
      const r = await post(a, '/auth/join', { signupToken: v.signupToken, name, password: 'agent-1404', deviceName: 'گوشی' });
      expect(r.statusCode).toBe(200);
      return { invite: v.invite, session: r.json() };
    }

    it('invites a colleague by phone, who joins with a code and a password', async () => {
      const a = newApp();
      const m = await signUp(a, freshPhone());
      expect(m.user).toMatchObject({ role: 'manager', seeOwnerPhones: true });
      const phone = freshPhone();
      expect((await post(a, '/team/invites', { phone: phone.replace(/^0/, '+98'), name: 'سارا', role: 'agent' }, m.accessToken)).statusCode).toBe(204);
      const { invite, session } = await join(a, phone);
      expect(invite).toEqual({ officeName: 'املاک پارسا', invitedBy: 'علی رضایی', name: 'سارا', role: 'agent' });
      expect(session.office.id).toBe(m.office.id);
      expect(session.user).toMatchObject({ name: 'سارا مشاور', role: 'agent', seeOwnerPhones: false });
      // ورود بعدی با رمز خودش
      expect((await post(a, '/auth/login', { phone, password: 'agent-1404', deviceName: 'x' })).json().office.id).toBe(m.office.id);

      const team = (await get(a, '/team', session.accessToken)).json();
      expect(team.seats).toBe(5);
      expect(team.members.map((x: { name: string; role: string }) => [x.name, x.role])).toEqual([['علی رضایی', 'manager'], ['سارا مشاور', 'agent']]);
      expect(team.invites).toEqual([]);
      // عضو فعلی را دوباره نمی‌شود دعوت کرد
      expect((await post(a, '/team/invites', { phone, name: 'سارا', role: 'agent' }, m.accessToken)).json().error).toBe('member');
      await a.close();
    });

    it('lets only managers change the team or the office name', async () => {
      const a = newApp();
      const m = await signUp(a, freshPhone());
      const phone = freshPhone();
      await post(a, '/team/invites', { phone, name: 'سارا', role: 'agent' }, m.accessToken);
      const { session: s } = await join(a, phone);
      expect((await post(a, '/team/invites', { phone: freshPhone(), name: 'x', role: 'agent' }, s.accessToken)).statusCode).toBe(403);
      expect((await post(a, `/team/members/${m.user.id}`, { role: 'agent' }, s.accessToken)).statusCode).toBe(403);
      expect((await del(a, `/team/members/${m.user.id}`, s.accessToken)).statusCode).toBe(403);
      expect((await post(a, '/auth/profile', { officeName: 'هک' }, s.accessToken)).statusCode).toBe(403);
      expect((await post(a, '/auth/profile', { name: 'سارا احمدی' }, s.accessToken)).statusCode).toBe(200);
      // مشاوری که مدیر شد، بی‌درنگ (بی‌تمدید توکن) دسترسی دارد
      expect((await post(a, `/team/members/${s.user.id}`, { role: 'manager' }, m.accessToken)).statusCode).toBe(204);
      expect((await post(a, '/auth/profile', { officeName: 'املاک پارسا' }, s.accessToken)).statusCode).toBe(200);
      await a.close();
    });

    it('caps members plus open invites at the office seats', async () => {
      const a = newApp();
      const m = await signUp(a, freshPhone());
      await withOffice(owner, m.office.id, (db) => db.query('update offices set seats = 2 where id = $1', [m.office.id]));
      const p1 = freshPhone();
      const p2 = freshPhone();
      expect((await post(a, '/team/invites', { phone: p1, name: 'یک', role: 'agent' }, m.accessToken)).statusCode).toBe(204);
      // دعوت دوباره به همان شماره جای تازه نمی‌گیرد
      expect((await post(a, '/team/invites', { phone: p1, name: 'یک', role: 'manager' }, m.accessToken)).statusCode).toBe(204);
      expect((await post(a, '/team/invites', { phone: p2, name: 'دو', role: 'agent' }, m.accessToken)).json().error).toBe('no_seat');
      expect((await del(a, `/team/invites/${p1}`, m.accessToken)).statusCode).toBe(204);
      expect((await post(a, '/team/invites', { phone: p2, name: 'دو', role: 'agent' }, m.accessToken)).statusCode).toBe(204);
      const { session } = await join(a, p2);
      expect(session.user.role).toBe('agent');
      expect((await post(a, '/team/invites', { phone: p1, name: 'یک', role: 'agent' }, m.accessToken)).json().error).toBe('no_seat');
      await a.close();
    });

    it('never sends owner phones to an agent without permission, and the agent cannot change them', async () => {
      const a = newApp();
      const m = await signUp(a, freshPhone());
      const phone = freshPhone();
      await post(a, '/team/invites', { phone, name: 'سارا', role: 'agent' }, m.accessToken);
      const { session: s } = await join(a, phone);
      const id = randomUUID();
      const base = { deal: 'sale', status: 'active', kind: 'apartment', neighborhood: 'ونک', area: 90, createdAt: '2026-10-07T10:00:00Z' };
      await post(a, '/sync/push', { changes: [{ seq: 1, kind: 'listing', id, fields: { ...base, owner: { name: 'آقای کریمی', phone: '09121112233' } }, hlc: hlc(t0) }] }, m.accessToken);

      const seen = (await get(a, '/sync/pull?cursor=0', s.accessToken)).json();
      expect(seen.ownerPhones).toBe(false);
      expect(seen.entities[0].fields.owner).toEqual({ name: 'آقای کریمی', phone: '' });
      // ویرایش نام مالک روی دستگاه مشاور شمارهٔ خالی می‌فرستد؛ شماره سر جایش می‌ماند
      await post(a, '/sync/push', { changes: [{ seq: 1, kind: 'listing', id, fields: { owner: { name: 'آقای کریمی‌پور', phone: '' } }, hlc: hlc(t0 + 10, 'b') }] }, s.accessToken);
      await post(a, '/sync/push', { changes: [{ seq: 2, kind: 'listing', id, fields: { owner: null }, hlc: hlc(t0 + 20, 'b') }] }, s.accessToken);
      const mine = (await get(a, '/sync/pull?cursor=0', m.accessToken)).json();
      expect(mine.ownerPhones).toBe(true);
      expect(mine.entities[0].fields.owner).toEqual({ name: 'آقای کریمی‌پور', phone: '09121112233' });
      // فایلی که خود مشاور ثبت می‌کند شماره‌اش را نگه می‌دارد
      const own = randomUUID();
      await post(a, '/sync/push', { changes: [{ seq: 3, kind: 'listing', id: own, fields: { ...base, owner: { name: 'خانم نوری', phone: '09124445566' } }, hlc: hlc(t0 + 30, 'b') }] }, s.accessToken);
      const after = (await get(a, '/sync/pull?cursor=0', m.accessToken)).json();
      expect(after.entities.find((e: { id: string }) => e.id === own).fields.owner.phone).toBe('09124445566');

      // مدیر اجازه می‌دهد: همان لحظه
      expect((await post(a, `/team/members/${s.user.id}`, { seeOwnerPhones: true }, m.accessToken)).statusCode).toBe(204);
      const now = (await get(a, '/sync/pull?cursor=0', s.accessToken)).json();
      expect(now.ownerPhones).toBe(true);
      expect(now.entities.find((e: { id: string }) => e.id === id).fields.owner.phone).toBe('09121112233');
      await a.close();
    });

    it('removes a member at once and keeps at least one manager', async () => {
      const a = newApp();
      const m = await signUp(a, freshPhone());
      expect((await post(a, `/team/members/${m.user.id}`, { role: 'agent' }, m.accessToken)).json().error).toBe('last_manager');
      expect((await del(a, `/team/members/${m.user.id}`, m.accessToken)).json().error).toBe('self');
      const phone = freshPhone();
      await post(a, '/team/invites', { phone, name: 'سارا', role: 'agent' }, m.accessToken);
      const { session: s } = await join(a, phone);
      expect((await del(a, `/team/members/${s.user.id}`, m.accessToken)).statusCode).toBe(204);
      expect((await get(a, '/team', s.accessToken)).statusCode).toBe(401);
      expect((await post(a, '/auth/refresh', { refreshToken: s.refreshToken })).statusCode).toBe(401);
      expect((await post(a, '/auth/login', { phone, password: 'agent-1404', deviceName: 'x' })).json().error).toBe('wrong');
      // دفتر دیگر نمی‌تواند عضو این دفتر را بردارد یا عوض کند
      const other = await signUp(a, freshPhone());
      expect((await del(a, `/team/members/${m.user.id}`, other.accessToken)).statusCode).toBe(404);
      // شمارهٔ برداشته‌شده می‌تواند دفتر خودش را بسازد
      await allowResend(phone);
      const own = await signUp(a, phone);
      expect(own.office.id).not.toBe(m.office.id);
      expect(own.user).toMatchObject({ id: s.user.id, role: 'manager' });
      await a.close();
    });

    it('moves someone who has their own office, only when they are alone there', async () => {
      const a = newApp();
      const m = await signUp(a, freshPhone());
      const phone = freshPhone();
      const solo = await signUp(a, phone);
      await post(a, '/team/invites', { phone, name: 'رضا', role: 'agent' }, m.accessToken);
      const s = (await post(a, '/auth/login', { phone, password: 'parsa-1404', deviceName: 'x' })).json();
      expect(s.invite).toMatchObject({ officeName: 'املاک پارسا', role: 'agent' });
      expect(s.office.id).toBe(solo.office.id);

      const moved = await post(a, '/auth/invite/accept', {}, s.accessToken);
      expect(moved.statusCode).toBe(200);
      expect(moved.json()).toMatchObject({ office: { id: m.office.id }, user: { id: solo.user.id, role: 'agent', seeOwnerPhones: false }, invite: null });
      // توکن دفتر قبلی دیگر کار نمی‌کند؛ فقط همین دستگاه به دفتر تازه می‌رود و دستگاه دیگرش بیرون می‌افتد (سقف دستگاه دفتر)
      expect((await get(a, '/team', solo.accessToken)).statusCode).toBe(401);
      expect((await post(a, '/auth/refresh', { refreshToken: solo.refreshToken })).statusCode).toBe(401);
      expect((await post(a, '/auth/refresh', { refreshToken: moved.json().refreshToken })).json().office.id).toBe(m.office.id);

      // مدیری که همکار دارد نمی‌تواند دفترش را رها کند؛ رد کردن دعوت آن را پاک می‌کند
      const busy = await signUp(a, freshPhone());
      const mate = freshPhone();
      await post(a, '/team/invites', { phone: mate, name: 'همکار', role: 'agent' }, busy.accessToken);
      await join(a, mate);
      await post(a, '/team/invites', { phone: busy.user.phone, name: 'مدیر', role: 'manager' }, m.accessToken);
      const b = (await post(a, '/auth/refresh', { refreshToken: busy.refreshToken })).json();
      expect(b.invite).not.toBeNull();
      expect((await post(a, '/auth/invite/accept', {}, b.accessToken)).json().error).toBe('not_alone');
      expect((await post(a, '/auth/invite/decline', {}, b.accessToken)).statusCode).toBe(204);
      expect((await post(a, '/auth/refresh', { refreshToken: b.refreshToken })).json().invite).toBeNull();
      await a.close();
    });
  });

  describe('billing', () => {
    const key = licenseKey(DEV_LICENSE_SEED);
    const pub = publicKeyOf(key);
    const billApp = () =>
      buildApp({
        db: app,
        logLevel: 'silent',
        auth: { pool: app, sms, jwtSecret: 's'.repeat(48) },
        corsOrigins: ['https://app.kelid.test', 'null'],
        billing: { licenseKey: key, gateway: new DevGateway(), publicUrl: 'http://kelid.test' },
      });
    const get = (a: ReturnType<typeof newApp>, url: string, token?: string) => a.inject({ method: 'GET', url, headers: token ? { authorization: `Bearer ${token}` } : {} });
    const local = (url: string) => url.replace('http://kelid.test', '');
    const DAY = 86_400_000;

    it('gives a new office a signed trial license', async () => {
      const a = billApp();
      const s = await signUp(a, freshPhone());
      expect(verifyLicense(pub, s.license)).toBe(true);
      const lic = decodeLicense(s.license)!.payload;
      expect(lic).toMatchObject({ off: s.office.id, plan: 'office', seats: 5, trial: true });
      expect(lic.exp * 1000 - Date.now()).toBeGreaterThan(13.9 * DAY);
      // دستکاری یک بایت امضا را باطل می‌کند.
      const [body, sig] = s.license.split('.');
      const forged = Buffer.from(body, 'base64url').toString().replace('"seats":5', '"seats":50');
      expect(verifyLicense(pub, `${Buffer.from(forged).toString('base64url')}.${sig}`)).toBe(false);

      const b = (await get(a, '/billing', s.accessToken)).json();
      expect(b).toMatchObject({ plan: 'office', trial: true, seats: 5, used: 1, canPay: true, payments: [] });
      expect(b.plans.map((p: { id: string }) => p.id)).toEqual(['solo', 'office', 'pro']);
      expect(verifyLicense(pub, b.license)).toBe(true);
      expect((await post(a, '/auth/refresh', { refreshToken: s.refreshToken })).json().license).toBeTruthy();
      await a.close();
    });

    it('renews through the gateway once, keeping the trial days', async () => {
      const a = billApp();
      const s = await signUp(a, freshPhone());
      const before = decodeLicense(s.license)!.payload.exp * 1000;
      const c = await post(a, '/billing/checkout', { plan: 'pro', period: 'year', seats: 14 }, s.accessToken);
      expect(c.statusCode).toBe(200);
      const { id, payUrl } = c.json();
      expect((await get(a, `/billing/payments/${id}`, s.accessToken)).json()).toMatchObject({ status: 'pending', amount: priceOf(planById('pro')!, 'year', 14), seats: 14, license: null });

      const gate = await get(a, local(payUrl));
      expect(gate.statusCode).toBe(200);
      expect(gate.headers['content-type']).toMatch(/text\/html/);
      expect(gate.headers['content-security-policy']).toContain("style-src 'unsafe-inline'");
      expect(gate.headers['content-security-policy']).not.toContain('script');
      const ok = gate.body.match(/href="([^"]+Status=OK)"/)![1]!.replace(/&#38;/g, '&');
      const paid = await get(a, local(ok));
      expect(paid.statusCode).toBe(200);
      expect(paid.body).toContain('پرداخت انجام شد');
      // ویندوز نشانی برگشت نمی‌فرستد: صفحه فقط می‌گوید به برنامه برگردید، بی پیوند و بی رفتن خودکار.
      expect(paid.body).toContain('به برنامهٔ کلید برگردید');
      expect(paid.body).not.toContain('http-equiv="refresh"');

      const r = (await get(a, `/billing/payments/${id}`, s.accessToken)).json();
      expect(r).toMatchObject({ status: 'paid', plan: 'pro', period: 'year' });
      expect(r.refId).toMatch(/^\d+$/);
      const lic = decodeLicense(r.license)!.payload;
      expect(lic).toMatchObject({ plan: 'pro', seats: 14, trial: false });
      // ۱۴ روز آزمایشی + ۱۲ ماه + ۲ ماه هدیه
      expect(Math.abs(lic.exp * 1000 - (before + termDays('year') * DAY))).toBeLessThan(60_000);

      // برگشت دوباره از درگاه دوباره تمدید نمی‌کند.
      expect((await get(a, local(ok))).body).toContain('پرداخت انجام شد');
      const b = (await get(a, '/billing', s.accessToken)).json();
      expect(b).toMatchObject({ plan: 'pro', trial: false, seats: 14 });
      expect(b.payments).toHaveLength(1);
      expect(Math.abs(Date.parse(b.expiresAt) - lic.exp * 1000)).toBeLessThan(1000);
      await a.close();
    });

    it('sends the web app back to itself after the gateway, only to a listed origin', async () => {
      const a = billApp();
      const s = await signUp(a, freshPhone());
      const font = await get(a, '/billing/font.woff2');
      expect(font.statusCode).toBe(200);
      expect(font.headers['content-type']).toBe('font/woff2');
      expect(font.headers['cache-control']).toContain('immutable');

      const web = (await post(a, '/billing/checkout', { plan: 'office', period: 'month', back: 'https://app.kelid.test' }, s.accessToken)).json();
      const gate = await get(a, local(web.payUrl));
      expect(gate.headers['content-security-policy']).toContain("font-src 'self'");
      const ok = gate.body.match(/href="([^"]+Status=OK)"/)![1]!.replace(/&#38;/g, '&');
      const paid = await get(a, local(ok));
      expect(paid.body).toContain('پرداخت انجام شد');
      const home = `https://app.kelid.test/#/plans?pay=${web.id}`;
      expect(paid.body).toContain(`http-equiv="refresh" content="6;url=${home}"`);
      expect(paid.body).toContain(`href="${home}"`);

      // مبدأ ناشناس، چه در خرید چه دستکاری‌شده در نشانی برگشت، نادیده گرفته می‌شود.
      const evil = (await post(a, '/billing/checkout', { plan: 'office', period: 'month', back: 'https://evil.test' }, s.accessToken)).json();
      expect(evil.payUrl).not.toContain('evil');
      const u = new URL(evil.payUrl);
      const forged = `/billing/callback?o=${u.searchParams.get('o')}&p=${evil.id}&Authority=${u.searchParams.get('Authority')}&Status=NOK&b=${encodeURIComponent('https://evil.test')}`;
      const no = await get(a, forged);
      expect(no.body).toContain('پرداخت لغو شد');
      expect(no.body).not.toContain('evil');
      await a.close();
    });

    it('ignores forged, canceled and cross-office callbacks', async () => {
      const a = billApp();
      const s = await signUp(a, freshPhone());
      const other = await signUp(a, freshPhone());
      const { id, payUrl } = (await post(a, '/billing/checkout', { plan: 'office', period: 'month' }, s.accessToken)).json();
      const u = new URL(payUrl);
      const authority = u.searchParams.get('Authority')!;
      expect((await get(a, `/billing/callback?o=${s.office.id}&p=${id}&Authority=DEVnope&Status=OK`)).statusCode).toBe(404);
      // پرداخت دفتر دیگر از راه دفتر خودش پیدا نمی‌شود (RLS).
      expect((await get(a, `/billing/callback?o=${other.office.id}&p=${id}&Authority=${authority}&Status=OK`)).statusCode).toBe(404);
      expect((await get(a, `/billing/payments/${id}`, other.accessToken)).statusCode).toBe(404);
      expect((await get(a, `/billing/callback?o=not-a-uuid&p=${id}`)).statusCode).toBe(400);

      const no = await get(a, `/billing/callback?o=${s.office.id}&p=${id}&Authority=${authority}&Status=NOK`);
      expect(no.body).toContain('پرداخت لغو شد');
      // بعد از لغو، «OK» ساختگی هم چیزی را عوض نمی‌کند.
      expect((await get(a, `/billing/callback?o=${s.office.id}&p=${id}&Authority=${authority}&Status=OK`)).body).toContain('پرداخت لغو شد');
      expect((await get(a, '/billing', s.accessToken)).json()).toMatchObject({ trial: true, payments: [] });
      await a.close();
    });

    it('lets only managers pay, and only for a plan that fits the team', async () => {
      const a = billApp();
      const m = await signUp(a, freshPhone());
      const phone = freshPhone();
      await post(a, '/team/invites', { phone, name: 'سارا', role: 'agent' }, m.accessToken);
      expect((await post(a, '/billing/checkout', { plan: 'solo', period: 'month' }, m.accessToken)).json().error).toBe('too_small');
      await post(a, '/auth/otp', { phone });
      const v = (await post(a, '/auth/verify', { phone, code: codes.get(phone)!, deviceName: 'گوشی' })).json();
      const agent = (await post(a, '/auth/join', { signupToken: v.signupToken, name: 'سارا', password: 'agent-1404', deviceName: 'گوشی' })).json();
      expect((await post(a, '/billing/checkout', { plan: 'office', period: 'month' }, agent.accessToken)).statusCode).toBe(403);
      expect((await get(a, '/billing', agent.accessToken)).statusCode).toBe(200);
      expect((await post(a, '/billing/checkout', { plan: 'gold', period: 'month' }, m.accessToken)).statusCode).toBe(400);
      // مبلغ فقط از فهرست سرور است؛ عددی که برنامه بفرستد دور ریخته می‌شود.
      const cheap = (await post(a, '/billing/checkout', { plan: 'office', period: 'month', amount: 1 }, m.accessToken)).json();
      expect((await get(a, `/billing/payments/${cheap.id}`, m.accessToken)).json().amount).toBe(planById('office')!.monthly);
      // پلن بی‌نفر اضافه همان جای خودش را می‌فروشد، هرچه برنامه بخواهد.
      const half = (await post(a, '/billing/checkout', { plan: 'office', period: 'half', seats: 40 }, m.accessToken)).json();
      expect((await get(a, `/billing/payments/${half.id}`, m.accessToken)).json()).toMatchObject({ amount: priceOf(planById('office')!, 'half'), seats: 5, period: 'half' });
      await a.close();
    });

    it('keeps an expired office readable but not writable', async () => {
      const a = billApp();
      const s = await signUp(a, freshPhone());
      const hlc = `${Date.now().toString(36).padStart(10, '0')}-00000-dev`;
      const push = (seq: number) => post(a, '/sync/push', { changes: [{ seq, kind: 'todo', id: `t${seq}`, fields: { title: 'کار' }, hlc }] }, s.accessToken);
      expect((await push(1)).statusCode).toBe(200);
      await withOffice(owner, s.office.id, (db) => db.query("update offices set expires_at = now() - interval '1 day' where id = $1", [s.office.id]));
      expect((await push(2)).statusCode).toBe(402);
      expect((await push(2)).json().error).toBe('subscription');
      expect((await post(a, '/sync/photos/p1', { mime: 'image/png', bytes: '', thumb: '' }, s.accessToken)).statusCode).toBe(402);
      expect((await post(a, '/team/invites', { phone: freshPhone(), name: 'x', role: 'agent' }, s.accessToken)).statusCode).toBe(402);
      const pulled = await get(a, '/sync/pull', s.accessToken);
      expect(pulled.statusCode).toBe(200);
      expect(pulled.json().entities).toHaveLength(1);
      const lic = decodeLicense((await post(a, '/auth/refresh', { refreshToken: s.refreshToken })).json().license)!.payload;
      expect(lic.exp * 1000).toBeLessThan(Date.now());
      // تمدید = نوشتن دوباره باز.
      const { payUrl } = (await post(a, '/billing/checkout', { plan: 'office', period: 'month' }, s.accessToken)).json();
      const u = new URL(payUrl);
      await get(a, `/billing/callback?o=${u.searchParams.get('o')}&p=${u.searchParams.get('p')}&Authority=${u.searchParams.get('Authority')}&Status=OK`);
      expect((await push(3)).statusCode).toBe(200);
      const b = (await get(a, '/billing', s.accessToken)).json();
      // تمام‌شده از امروز حساب می‌شود، نه از روز پایان.
      expect(Math.abs(Date.parse(b.expiresAt) - (Date.now() + 30 * DAY))).toBeLessThan(60_000);
      await a.close();
    });
  });

  describe('vendor panel', () => {
    const key = licenseKey(DEV_LICENSE_SEED);
    const vApp = () =>
      buildApp({
        db: app,
        logLevel: 'silent',
        auth: { pool: app, sms, jwtSecret: 's'.repeat(48) },
        billing: { licenseKey: key, gateway: new DevGateway(), publicUrl: 'http://kelid.test' },
      });
    const get = (a: ReturnType<typeof newApp>, url: string, token?: string) => a.inject({ method: 'GET', url, headers: token ? { authorization: `Bearer ${token}` } : {} });

    async function newAdmin() {
      const phone = freshPhone().replace(/^0912/, '0935');
      const secret = newTotpSecret();
      await withVendor(app, async (db) =>
        db.query('insert into vendor_admins (id, phone, name, password_hash, totp_secret) values ($1, $2, $3, $4, $5)', [
          randomUUID(),
          phone,
          'پشتیبان کلید',
          await hashPassword('vendor-pass-1'),
          secret,
        ]),
      );
      return { phone, secret };
    }
    // هر ورود موفق یک گام زمانی را مصرف می‌کند؛ ورود دوم در همان آزمون گام بعدی را می‌خواهد.
    async function login(a: ReturnType<typeof newApp>, admin: { phone: string; secret: string }, step = totpStep()) {
      const r = await post(a, '/admin/login', { phone: admin.phone, password: 'vendor-pass-1', code: totpAt(admin.secret, step) });
      expect(r.statusCode).toBe(200);
      return r.json().token as string;
    }

    it('keeps vendor tables away from offices and office data away from the vendor', async () => {
      const a = vApp();
      const s = await signUp(a, freshPhone());
      const hlc = `${Date.now().toString(36).padStart(10, '0')}-00000-dev`;
      await post(a, '/sync/push', { changes: [{ seq: 1, kind: 'todo', id: 't1', fields: { title: 'کار' }, hlc }] }, s.accessToken);
      await newAdmin();
      const asOffice = await withOffice(app, s.office.id, async (db) => ({
        admins: (await db.query('select * from vendor_admins')).rowCount,
        notes: (await db.query('select * from vendor_notes')).rowCount,
        offices: (await db.query('select id from offices')).rowCount,
      }));
      expect(asOffice).toEqual({ admins: 0, notes: 0, offices: 1 });
      const asVendor = await withVendor(app, async (db) => ({
        offices: (await db.query('select id from offices')).rowCount!,
        entities: (await db.query('select * from entities')).rowCount,
      }));
      expect(asVendor.offices).toBeGreaterThan(1);
      expect(asVendor.entities).toBe(0);
      // بیرون از withVendor پرچم نمی‌ماند.
      expect((await app.query('select id from offices')).rowCount).toBe(0);
      await a.close();
    });

    it('logs in with password and a one-time code, never reusing a code, and locks after five misses', async () => {
      const a = vApp();
      const admin = await newAdmin();
      const code = totpAt(admin.secret, totpStep());
      expect((await post(a, '/admin/login', { phone: admin.phone, password: 'wrong-pass', code })).statusCode).toBe(401);
      expect((await post(a, '/admin/login', { phone: admin.phone, password: 'vendor-pass-1', code: '000000' })).statusCode).toBe(401);
      const ok = await post(a, '/admin/login', { phone: admin.phone, password: 'vendor-pass-1', code });
      expect(ok.statusCode).toBe(200);
      const token = ok.json().token;
      expect((await get(a, '/admin/me', token)).json().admin).toMatchObject({ phone: admin.phone, name: 'پشتیبان کلید' });
      // همان کد دوباره پذیرفته نمی‌شود.
      expect((await post(a, '/admin/login', { phone: admin.phone, password: 'vendor-pass-1', code })).statusCode).toBe(401);

      // توکن دفتر در پنل و توکن پنل در برنامهٔ دفتر کار نمی‌کند.
      const s = await signUp(a, freshPhone());
      expect((await get(a, '/admin/offices', s.accessToken)).statusCode).toBe(401);
      expect((await get(a, '/billing', token)).statusCode).toBe(401);
      expect((await get(a, '/admin/offices')).statusCode).toBe(401);

      // کد تکراری بالا یک خطا بود؛ چهار خطای دیگر = پنج و قفل.
      for (let i = 0; i < 4; i++) await post(a, '/admin/login', { phone: admin.phone, password: 'nope-nope', code: '123456' });
      const locked = await post(a, '/admin/login', { phone: admin.phone, password: 'vendor-pass-1', code: totpAt(admin.secret, totpStep() + 1) });
      expect(locked.statusCode).toBe(429);
      expect(locked.json().error).toBe('locked');

      // حساب غیرفعال همان لحظه بیرون می‌افتد.
      await withVendor(app, (db) => db.query('update vendor_admins set disabled_at = now() where phone = $1', [admin.phone]));
      expect((await get(a, '/admin/me', token)).statusCode).toBe(401);
      await a.close();
    });

    it('lists, extends, suspends and resumes an office, with its history', async () => {
      const a = vApp();
      const phone = freshPhone();
      const s = await signUp(a, phone);
      const token = await login(a, await newAdmin());

      const list = (await get(a, `/admin/offices?q=${phone.slice(-7)}`, token)).json().offices;
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ id: s.office.id, name: 'املاک پارسا', status: 'trial', members: 1, manager: { phone, name: 'علی رضایی' } });
      expect((await get(a, '/admin/offices?q=%D9%BE%D8%A7%D8%B1%D8%B3%D8%A7', token)).json().offices.some((o: { id: string }) => o.id === s.office.id)).toBe(true);
      expect((await get(a, '/admin/offices?status=suspended', token)).json().offices.some((o: { id: string }) => o.id === s.office.id)).toBe(false);
      expect((await get(a, '/admin/stats', token)).json().offices).toBeGreaterThan(0);

      const before = Date.parse(list[0].expiresAt);
      const ext = await post(a, `/admin/offices/${s.office.id}/extend`, { days: 30, plan: 'pro', trial: false, note: 'کارت به کارت، رسید ۱۲۳' }, token);
      expect(ext.statusCode).toBe(200);
      const e = ext.json();
      expect(e.office).toMatchObject({ plan: 'pro', seats: 10, trial: false, status: 'active' });
      expect(Math.abs(Date.parse(e.office.expiresAt) - (before + 30 * 86_400_000))).toBeLessThan(60_000);
      expect(e.notes[0]).toMatchObject({ kind: 'extend', admin: 'پشتیبان کلید' });
      expect(e.notes[0].body).toContain('کارت به کارت');
      expect(decodeLicense((await get(a, '/billing', s.accessToken)).json().license)!.payload).toMatchObject({ plan: 'pro', trial: false });

      const sus = await post(a, `/admin/offices/${s.office.id}/suspend`, { reason: 'پرداخت برگشت خورد' }, token);
      expect(sus.json().office).toMatchObject({ status: 'suspended', suspendReason: 'پرداخت برگشت خورد' });
      expect((await post(a, `/admin/offices/${s.office.id}/suspend`, { reason: 'دوباره' }, token)).statusCode).toBe(409);
      const b = (await get(a, '/billing', s.accessToken)).json();
      expect(b.suspended).toBe(true);
      expect(decodeLicense(b.license)!.payload.sus).toBe(true);
      const hlc = `${Date.now().toString(36).padStart(10, '0')}-00000-dev`;
      expect((await post(a, '/sync/push', { changes: [{ seq: 1, kind: 'todo', id: 't1', fields: { title: 'کار' }, hlc }] }, s.accessToken)).statusCode).toBe(402);
      expect((await post(a, '/billing/checkout', { plan: 'office', period: 'month' }, s.accessToken)).statusCode).toBe(403);

      const res = await post(a, `/admin/offices/${s.office.id}/resume`, {}, token);
      expect(res.json().office.status).toBe('active');
      expect((await post(a, '/sync/push', { changes: [{ seq: 1, kind: 'todo', id: 't1', fields: { title: 'کار' }, hlc }] }, s.accessToken)).statusCode).toBe(200);

      const note = await post(a, `/admin/offices/${s.office.id}/notes`, { body: 'زنگ زدند، راهنمایی شد' }, token);
      expect(note.json().notes.map((n: { kind: string }) => n.kind)).toEqual(['note', 'resume', 'suspend', 'extend']);

      // دفتر دونفره پلن تک‌نفره نمی‌گیرد؛ شناسهٔ ناموجود ۴۰۴.
      await post(a, '/team/invites', { phone: freshPhone(), name: 'سارا', role: 'agent' }, s.accessToken);
      expect((await post(a, `/admin/offices/${s.office.id}/extend`, { days: 7, plan: 'solo', trial: false, note: 'x' }, token)).statusCode).toBe(409);
      expect((await post(a, `/admin/offices/${randomUUID()}/extend`, { days: 7, plan: 'pro', trial: false, note: 'x' }, token)).statusCode).toBe(404);
      expect((await get(a, `/admin/offices/not-a-uuid`, token)).statusCode).toBe(400);
      await a.close();
    });

    it('streams office changes to the panel and billing changes to the office, live', async () => {
      const a = vApp();
      await a.listen({ port: 0, host: '127.0.0.1' });
      const base = `http://127.0.0.1:${(a.server.address() as AddressInfo).port}`;
      const open = async (path: string, token: string) => {
        const ctl = new AbortController();
        const res = await fetch(base + path, { headers: { authorization: `Bearer ${token}` }, signal: ctl.signal });
        const state = { text: '', ended: false };
        void (async () => {
          const reader = res.body!.getReader();
          const dec = new TextDecoder();
          try {
            for (;;) {
              const { value, done } = await reader.read();
              if (done) break;
              state.text += dec.decode(value);
            }
          } catch {
            // بستن از سمت تست
          }
          state.ended = true;
        })();
        return { res, state, stop: () => ctl.abort() };
      };
      const until = async (ok: () => boolean) => {
        for (let i = 0; i < 150 && !ok(); i++) await new Promise((r) => setTimeout(r, 20));
        return ok();
      };
      const admin = await newAdmin();
      const token = await login(a, admin);
      const panel = await open('/admin/events', token);
      expect(panel.res.status).toBe(200);
      expect(panel.res.headers.get('content-type')).toMatch(/^text\/event-stream/);

      // ثبت‌نام دفتر تازه همان لحظه در پنل
      const s = await signUp(a, freshPhone());
      const other = await signUp(a, freshPhone());
      expect(await until(() => panel.state.text.includes(s.office.id))).toBe(true);

      // تمدید از پنل ⇒ دستگاه‌های همان دفتر خبر اشتراک می‌گیرند، دفتر دیگر نه
      const dev = await open('/sync/events', s.accessToken);
      const devOther = await open('/sync/events', other.accessToken);
      await until(() => dev.state.text.includes(': ready') && devOther.state.text.includes(': ready'));
      expect((await post(a, `/admin/offices/${s.office.id}/extend`, { days: 30, plan: 'office', trial: false, note: 'کارت به کارت' }, token)).statusCode).toBe(200);
      expect(await until(() => dev.state.text.includes('event: billing'))).toBe(true);
      await new Promise((r) => setTimeout(r, 150));
      expect(devOther.state.text).not.toContain('event: billing');
      // تغییر داده‌های دفتر (فایل‌ها) هیچ‌وقت به پنل نمی‌رسد؛ فقط شناسهٔ دفتر برای اشتراک، اعضا و پرداخت‌ها
      expect(panel.state.text).not.toMatch(/"fields"|"title"/);

      // توکن دفتر به پنل راه ندارد؛ حساب غیرفعال‌شده همان لحظه قطع می‌شود
      expect((await fetch(`${base}/admin/events`, { headers: { authorization: `Bearer ${s.accessToken}` } })).status).toBe(401);
      await withVendor(app, async (db) => {
        const r = await db.query<{ id: string }>('update vendor_admins set disabled_at = now() where phone = $1 returning id', [admin.phone]);
        await kickVendor(db, r.rows[0]!.id);
      });
      expect(await until(() => panel.state.ended)).toBe(true);
      for (const e of [dev, devOther]) e.stop();
      await a.close();
    });

    it('lists payments across offices', async () => {
      const a = vApp();
      const s = await signUp(a, freshPhone());
      const c = (await post(a, '/billing/checkout', { plan: 'office', period: 'month' }, s.accessToken)).json();
      const token = await login(a, await newAdmin());
      const all = (await get(a, '/admin/payments', token)).json().payments;
      expect(all.find((p: { id: string }) => p.id === c.id)).toMatchObject({ status: 'pending', amount: planById('office')!.monthly, office: { id: s.office.id, name: 'املاک پارسا' } });
      expect((await get(a, '/admin/payments?status=paid', token)).json().payments.some((p: { id: string }) => p.id === c.id)).toBe(false);
      const detail = (await get(a, `/admin/offices/${s.office.id}`, token)).json();
      expect(detail.payments).toHaveLength(1);
      expect(detail.members).toHaveLength(1);
      await a.close();
    });

    it('collects feedback and grouped app errors per office, shows them to the vendor, and flags pilot offices', async () => {
      const a = vApp();
      const s1 = await signUp(a, freshPhone());
      const s2 = await signUp(a, freshPhone());
      const fid = randomUUID();
      const fb = { id: fid, kind: 'problem', body: '  دکمهٔ ذخیره روی گوشی دیده نمی‌شود  ', page: '/add', appVersion: '0.3.0', platform: 'pwa' };
      expect((await post(a, '/beta/feedback', fb, s1.accessToken)).statusCode).toBe(204);
      // دوباره فرستادن همان نظر (پاسخ گم‌شده) تکراری نمی‌سازد
      expect((await post(a, '/beta/feedback', fb, s1.accessToken)).statusCode).toBe(204);
      expect((await post(a, '/beta/feedback', { ...fb, id: randomUUID(), kind: 'spam' }, s1.accessToken)).statusCode).toBe(400);
      expect((await post(a, '/beta/feedback', { ...fb, id: randomUUID() })).statusCode).toBe(401);

      const boom = (file: string) => ({ message: 'Cannot read properties of undefined (reading 12)', stack: `TypeError: x\n    at save (http://localhost:5173/assets/index-${file}.js:10:20)`, page: '/add', platform: 'web' });
      expect((await post(a, '/beta/errors', { errors: [boom('Ab12Cd34'), boom('Ab12Cd34')] }, s1.accessToken)).statusCode).toBe(204);
      // نسخهٔ دیگر برنامه (hash دیگر) و دفتر دیگر: همان باگ
      expect((await post(a, '/beta/errors', { errors: [{ ...boom('Zz99Yy88'), count: 3 }] }, s2.accessToken)).statusCode).toBe(204);
      expect((await post(a, '/beta/errors', { errors: [] }, s1.accessToken)).statusCode).toBe(400);

      // هر دفتر فقط مال خودش را می‌بیند
      const own = await withOffice(app, s2.office.id, async (db) => ({
        feedback: (await db.query('select 1 from feedback')).rowCount,
        errors: (await db.query('select count from client_errors')).rows,
      }));
      expect(own).toEqual({ feedback: 0, errors: [{ count: 3 }] });

      const token = await login(a, await newAdmin());
      const list = (await get(a, '/admin/feedback', token)).json().feedback;
      const mine = list.find((f: { id: string }) => f.id === fid);
      expect(mine).toMatchObject({ kind: 'problem', body: 'دکمهٔ ذخیره روی گوشی دیده نمی‌شود', page: '/add', platform: 'pwa', office: { id: s1.office.id }, user: { name: 'علی رضایی' } });
      expect(list.filter((f: { id: string }) => f.id === fid)).toHaveLength(1);
      expect((await post(a, `/admin/feedback/${s1.office.id}/${fid}`, { done: true }, token)).statusCode).toBe(204);
      expect((await get(a, '/admin/feedback', token)).json().feedback.some((f: { id: string }) => f.id === fid)).toBe(false);
      expect((await get(a, '/admin/feedback?status=done', token)).json().feedback.some((f: { id: string }) => f.id === fid)).toBe(true);
      expect((await post(a, `/admin/feedback/${s2.office.id}/${fid}`, { done: true }, token)).statusCode).toBe(404);

      const errs = (await get(a, '/admin/errors', token)).json().errors;
      const bug = errs.find((e: { recent: Array<{ id: string }> }) => e.recent.some((o) => o.id === s1.office.id));
      expect(bug).toMatchObject({ count: 5, offices: 2, page: '/add' });
      expect((await post(a, `/admin/errors/${bug.fingerprint}`, { resolved: true }, token)).statusCode).toBe(204);
      expect((await get(a, '/admin/errors', token)).json().errors.some((e: { fingerprint: string }) => e.fingerprint === bug.fingerprint)).toBe(false);
      // دوباره پیش آمد ⇒ دوباره باز
      await post(a, '/beta/errors', { errors: [boom('Qq11Ww22')] }, s1.accessToken);
      expect((await get(a, '/admin/errors', token)).json().errors.find((e: { fingerprint: string }) => e.fingerprint === bug.fingerprint)).toMatchObject({ offices: 1 });

      // پرچم دفتر آزمایشی
      const pilot = await post(a, `/admin/offices/${s1.office.id}/pilot`, { pilot: true }, token);
      expect(pilot.json().office.pilot).toBe(true);
      expect(pilot.json().notes[0].body).toMatch(/آزمایشی/);
      const pilots = (await get(a, '/admin/offices?pilot=true', token)).json().offices.map((o: { id: string }) => o.id);
      expect(pilots).toContain(s1.office.id);
      expect(pilots).not.toContain(s2.office.id);
      expect((await get(a, '/admin/stats', token)).json()).toMatchObject({ pilot: expect.any(Number), openFeedback: expect.any(Number), openErrors: expect.any(Number) });
      await a.close();
    });

    it('runs support tickets between an office user and the vendor, each user seeing only their own', async () => {
      const a = vApp();
      const s1 = await signUp(a, freshPhone());
      const s2 = await signUp(a, freshPhone());
      const tid = randomUUID();
      const t = { id: tid, topic: 'billing', subject: '  تمدید   اشتراک ', body: 'می‌خواهم یک سال تمدید کنم.', page: '/plans', platform: 'web' };
      const made = await post(a, '/support/tickets', t, s1.accessToken);
      expect(made.statusCode).toBe(201);
      expect(made.json()).toMatchObject({ ticket: { id: tid, subject: 'تمدید اشتراک', status: 'open', unread: false }, messages: [{ from: 'user', body: 'می‌خواهم یک سال تمدید کنم.' }] });
      // دوباره فرستادن (پاسخ گم‌شده) تیکت دوم نمی‌سازد
      expect((await post(a, '/support/tickets', t, s1.accessToken)).statusCode).toBe(201);
      expect((await get(a, '/support/tickets', s1.accessToken)).json().tickets).toHaveLength(1);
      expect((await post(a, '/support/tickets', { ...t, id: randomUUID(), topic: 'spam' }, s1.accessToken)).statusCode).toBe(400);
      expect((await get(a, '/support/tickets')).statusCode).toBe(401);
      // دفتر دیگر تیکت را نمی‌بیند
      expect((await get(a, '/support/tickets', s2.accessToken)).json().tickets).toEqual([]);
      expect((await get(a, `/support/tickets/${tid}`, s2.accessToken)).statusCode).toBe(404);

      // پیوست: نوع را سرور از بایت‌ها می‌فهمد؛ فقط صاحب تیکت دانلودش می‌کند
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
      const fid = randomUUID();
      const withFile = await post(a, '/support/tickets', { ...t, id: fid, files: [{ name: '../عکس صفحه.png', data: png.toString('base64') }] }, s1.accessToken);
      expect(withFile.statusCode).toBe(201);
      const att = withFile.json().messages[0].files;
      expect(att).toEqual([{ id: expect.any(String), name: 'عکس صفحه.png', mime: 'image/png', size: png.length }]);
      const dl = await get(a, `/support/tickets/${fid}/files/${att[0].id}`, s1.accessToken);
      expect(dl.statusCode).toBe(200);
      expect(dl.headers['content-type']).toBe('image/png');
      expect(dl.headers['content-disposition']).toMatch(/^attachment;/);
      expect(dl.rawPayload.equals(png)).toBe(true);
      expect((await get(a, `/support/tickets/${fid}/files/${att[0].id}`, s2.accessToken)).statusCode).toBe(404);
      const exe = { name: 'a.pdf', data: Buffer.from('MZ\x90\x00not a pdf').toString('base64') };
      expect((await post(a, '/support/tickets', { ...t, id: randomUUID(), files: [exe] }, s1.accessToken)).json()).toEqual({ error: 'bad_file' });
      expect((await get(a, '/support/tickets', s1.accessToken)).json().tickets).toHaveLength(2);

      const token = await login(a, await newAdmin());
      const queue = (await get(a, '/admin/tickets', token)).json().tickets;
      expect(queue.find((x: { id: string }) => x.id === tid)).toMatchObject({ topic: 'billing', messages: 1, office: { id: s1.office.id }, user: { name: 'علی رضایی' }, last: { from: 'user' } });
      expect((await get(a, '/admin/stats', token)).json().openTickets).toBeGreaterThan(0);

      const pdf = Buffer.from('%PDF-1.4\n%راهنما\n');
      const answered = await post(a, `/admin/tickets/${s1.office.id}/${tid}/messages`, { body: 'حتماً؛ همکارمان تماس می‌گیرد.', files: [{ name: 'راهنما.pdf', data: pdf.toString('base64') }] }, token);
      expect(answered.json()).toMatchObject({
        ticket: { status: 'answered' },
        messages: [{ from: 'user', files: [] }, { from: 'support', author: expect.any(String), files: [{ name: 'راهنما.pdf', mime: 'application/pdf' }] }],
      });
      const guide = answered.json().messages[1].files[0].id;
      expect((await get(a, `/admin/tickets/${s1.office.id}/${tid}/files/${guide}`, token)).rawPayload.equals(pdf)).toBe(true);
      expect((await get(a, `/support/tickets/${tid}/files/${guide}`, s1.accessToken)).rawPayload.equals(pdf)).toBe(true);
      expect((await post(a, `/admin/tickets/${s2.office.id}/${tid}/messages`, { body: 'x' }, token)).statusCode).toBe(404);
      expect((await get(a, '/admin/tickets', token)).json().tickets.some((x: { id: string }) => x.id === tid)).toBe(false);
      expect((await get(a, '/admin/tickets?status=answered', token)).json().tickets.some((x: { id: string }) => x.id === tid)).toBe(true);

      // پاسخ تازه ⇒ نشان خوانده‌نشده تا کاربر تیکت را باز کند
      expect((await get(a, '/support/unread', s1.accessToken)).json()).toEqual({ unread: 1 });
      const seen = (await get(a, `/support/tickets/${tid}`, s1.accessToken)).json();
      expect(seen.messages.map((m: { from: string }) => m.from)).toEqual(['user', 'support']);
      expect((await get(a, '/support/unread', s1.accessToken)).json()).toEqual({ unread: 0 });

      // توضیح بیشتر کاربر تیکت را به صف باز برمی‌گرداند؛ همان پیام دوباره، تکراری نمی‌شود
      const mid = randomUUID();
      const again = await post(a, `/support/tickets/${tid}/messages`, { id: mid, body: 'یک سؤال دیگر' }, s1.accessToken);
      expect(again.json()).toMatchObject({ ticket: { status: 'open', last: { from: 'user' } } });
      expect((await post(a, `/support/tickets/${tid}/messages`, { id: mid, body: 'یک سؤال دیگر' }, s1.accessToken)).json().messages).toHaveLength(3);
      expect((await post(a, `/support/tickets/${tid}/messages`, { id: randomUUID(), body: 'x' }, s2.accessToken)).statusCode).toBe(404);

      // بسته یعنی حل شد: کاربر دیگر پیامی نمی‌فرستد و تیکت باز نمی‌شود
      expect((await post(a, `/support/tickets/${tid}/close`, {}, s1.accessToken)).json().ticket.status).toBe('closed');
      const late = await post(a, `/support/tickets/${tid}/messages`, { id: randomUUID(), body: 'باز کن' }, s1.accessToken);
      expect(late.statusCode).toBe(409);
      expect(late.json()).toEqual({ error: 'closed' });
      expect((await post(a, `/support/tickets/${tid}/messages`, { id: mid, body: 'یک سؤال دیگر' }, s1.accessToken)).json().ticket.status).toBe('closed');
      expect((await post(a, `/admin/tickets/${s1.office.id}/${tid}/status`, { status: 'closed' }, token)).json().ticket.status).toBe('closed');
      await a.close();
    });
  });
});
