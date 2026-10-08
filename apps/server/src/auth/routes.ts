import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { transaction as tx, withOffice, type Db, type Pool } from '../db';
import { hashPassword, passwordOk, verifyPassword, PASSWORD_MAX } from './password';
import { normalizePhone } from './phone';
import { RateLimiter } from './rateLimit';
import { lockTeam, pendingInvite, placeUser, seatsLeft, teamRoutes, type InviteInfo, type Role } from './team';
import type { SmsSender } from './sms';
import { kickDevice } from '../sync/live';
import { deriveKey, otpCode, otpHash, randomToken, safeEqual, sha256, signAccess, verifyAccess, type AccessClaims } from './tokens';

export const ACCESS_TTL = 15 * 60;
const OTP_TTL = 120; // ثانیه
const RESEND_AFTER = 60;
const MAX_ATTEMPTS = 5; // برای هر کد؛ بعدش کد باطل است
const MAX_SENDS_PER_HOUR = 5; // برای هر شماره
const SIGNUP_TTL = 15 * 60;
const REFRESH_IDLE_DAYS = 180; // دستگاهی که این‌قدر سر نزده دوباره کد می‌خواهد
const REUSE_GRACE = 60; // ثانیه؛ تکرار درخواست تمدیدی که پاسخش در راه گم شده
const MAX_PASSWORD_FAILS = 5; // برای هر شماره؛ بعدش قفل موقت
const LOCK_MINUTES = 15;
const RESET_WINDOW = 10 * 60; // ثانیه بعد از ورود با کد که بدون رمز قبلی می‌شود رمز تازه گذاشت

export interface AuthOptions {
  pool: Pool;
  sms: SmsSender;
  jwtSecret: string;
  /** فقط توسعه با پیامک console: کد در پاسخ هم می‌آید تا پیش‌نمایش بی‌پیامک کار کند. config در production اجازه نمی‌دهد. */
  devCodes?: boolean;
}

export type { InviteInfo, Role };

export interface Session {
  accessToken: string;
  accessExpiresIn: number;
  refreshToken: string;
  deviceId: string;
  /** seeOwnerPhones همان اجازهٔ مؤثر است: مدیر همیشه می‌بیند. */
  user: { id: string; name: string; phone: string; hasPassword: boolean; role: Role; seeOwnerPhones: boolean };
  office: { id: string; name: string };
  /** دعوت دفتر دیگری برای این شماره، اگر باشد. */
  invite: InviteInfo | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AccessClaims | null;
    /** نقش و اجازهٔ همین لحظهٔ کاربر از دیتابیس، نه از توکن؛ تغییر نقش بی‌درنگ اثر دارد. */
    member: { role: Role; ownerPhones: boolean } | null;
  }
}

const deviceName = { type: 'string', minLength: 1, maxLength: 100 } as const;
const password = { type: 'string', maxLength: PASSWORD_MAX } as const;
const bodySchema = (props: Record<string, object>, required: string[]) => ({ body: { type: 'object', additionalProperties: false, required, properties: props } });

/** درخواست بدون توکن معتبر یا از دستگاهِ بیرون‌شده، 401 می‌گیرد. req.auth در app.ts تعریف شده است. */
export function authGuard(pool: Pool, jwtSecret: string) {
  const accessKey = deriveKey(jwtSecret, 'access');
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const h = req.headers.authorization;
    const claims = h?.startsWith('Bearer ') ? verifyAccess(accessKey, h.slice(7)) : null;
    if (!claims) return reply.status(401).send({ error: 'unauthorized' });
    // دستگاهی که از فهرست حذف شد، کسی که از دفتر برداشته شد یا به دفتر دیگری رفت، همان لحظه بیرون می‌افتد، نه بعد از پایان عمر توکن.
    const { rows } = await pool.query<{ role: Role; phones: boolean }>(
      `select u.role, (u.role = 'manager' or u.see_owner_phones) as phones from devices d join users u on u.id = d.user_id
        where d.id = $1 and d.user_id = $2 and d.revoked_at is null and u.removed_at is null and u.office_id = $3`,
      [claims.dev, claims.sub, claims.off],
    );
    const m = rows[0];
    if (!m) return reply.status(401).send({ error: 'unauthorized' });
    req.auth = claims;
    req.member = { role: m.role, ownerPhones: m.phones };
  };
}

export async function authRoutes(app: FastifyInstance, { pool, sms, jwtSecret, devCodes = false }: AuthOptions) {
  const accessKey = deriveKey(jwtSecret, 'access');
  const otpKey = deriveKey(jwtSecret, 'otp');
  const otpByIp = new RateLimiter(10, 10 * 60_000);
  const verifyByIp = new RateLimiter(30, 10 * 60_000);
  const loginByIp = new RateLimiter(20, 10 * 60_000);

  const limited = (reply: FastifyReply, retryAfter: number) =>
    reply.status(429).header('retry-after', String(retryAfter)).send({ error: 'too_many', retryAfter });

  const requireAuth = authGuard(pool, jwtSecret);

  app.post('/auth/otp', { schema: bodySchema({ phone: { type: 'string', maxLength: 30 } }, ['phone']) }, async (req, reply) => {
    const phone = normalizePhone((req.body as { phone: string }).phone);
    if (!phone) return reply.status(400).send({ error: 'bad_phone' });
    const ipWait = otpByIp.take(req.ip);
    if (ipWait) return limited(reply, ipWait);

    const code = otpCode();
    const wait = await tx(pool, async (db) => {
      const { rows } = await db.query<{ resend: number; window_left: number; sent_count: number }>(
        `select greatest(0, ceil(extract(epoch from last_sent_at + make_interval(secs => $2) - now())))::int as resend,
                greatest(0, ceil(extract(epoch from window_start + interval '1 hour' - now())))::int as window_left,
                sent_count
           from otp_codes where phone = $1 for update`,
        [phone, RESEND_AFTER],
      );
      const r = rows[0];
      if (r && r.resend > 0) return r.resend;
      if (r && r.window_left > 0 && r.sent_count >= MAX_SENDS_PER_HOUR) return r.window_left;
      await db.query(
        `insert into otp_codes (phone, code_hash, expires_at, attempts, sent_count, window_start, last_sent_at)
         values ($1, $2, now() + make_interval(secs => $3), 0, 1, now(), now())
         on conflict (phone) do update set
           code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, last_sent_at = now(),
           sent_count = case when otp_codes.window_start > now() - interval '1 hour' then otp_codes.sent_count + 1 else 1 end,
           window_start = case when otp_codes.window_start > now() - interval '1 hour' then otp_codes.window_start else now() end`,
        [phone, otpHash(otpKey, phone, code), OTP_TTL],
      );
      return 0;
    });
    if (wait) return limited(reply, wait);

    try {
      await sms.sendOtp(phone, code);
    } catch (e) {
      req.log.error({ err: e }, 'sms send failed');
      // کدی که نرسید نباید جلوی درخواست دوباره را بگیرد.
      await pool.query(`update otp_codes set code_hash = null, last_sent_at = now() - make_interval(secs => $2) where phone = $1`, [phone, RESEND_AFTER]);
      return reply.status(503).send({ error: 'sms_failed' });
    }
    // پاسخ برای شمارهٔ تازه و قدیمی یکی است تا نشود فهمید چه کسی کاربر کلید است.
    return { retryAfter: RESEND_AFTER, expiresIn: OTP_TTL, ...(devCodes ? { devCode: code } : {}) };
  });

  app.post(
    '/auth/verify',
    { schema: bodySchema({ phone: { type: 'string', maxLength: 30 }, code: { type: 'string', maxLength: 12 }, deviceName }, ['phone', 'code', 'deviceName']) },
    async (req, reply) => {
      const body = req.body as { phone: string; code: string; deviceName: string };
      const phone = normalizePhone(body.phone);
      const code = toAsciiDigits(body.code);
      if (!phone || !/^\d{6}$/.test(code)) return reply.status(400).send({ error: 'bad_code' });
      const ipWait = verifyByIp.take(req.ip);
      if (ipWait) return limited(reply, ipWait);

      const result = await tx(pool, async (db) => {
        const { rows } = await db.query<{ code_hash: Buffer | null; attempts: number; live: boolean }>(
          'select code_hash, attempts, expires_at > now() as live from otp_codes where phone = $1 for update',
          [phone],
        );
        const r = rows[0];
        if (!r || !r.code_hash || !r.live || r.attempts >= MAX_ATTEMPTS) return { error: 'expired' as const };
        if (!safeEqual(otpHash(otpKey, phone, code), r.code_hash)) {
          const attempts = r.attempts + 1;
          // کد پنجم اشتباه = کد باطل؛ حدس زدن یک‌میلیونی عملاً ناممکن می‌شود.
          await db.query(`update otp_codes set attempts = $2${attempts >= MAX_ATTEMPTS ? ', code_hash = null' : ''} where phone = $1`, [phone, attempts]);
          return { error: 'wrong' as const, attemptsLeft: MAX_ATTEMPTS - attempts };
        }
        await db.query('update otp_codes set code_hash = null where phone = $1', [phone]);

        const user = await db.query<{ id: string; office_id: string }>('select id, office_id from users where phone = $1 and removed_at is null', [phone]);
        const u = user.rows[0];
        if (u) return { session: await startSession(db, u.id, u.office_id, body.deviceName, true) };
        const ticket = randomToken();
        await db.query('insert into signup_tickets (hash, phone, expires_at) values ($1, $2, now() + make_interval(secs => $3))', [sha256(ticket), phone, SIGNUP_TTL]);
        await db.query('delete from signup_tickets where expires_at < now()');
        // شماره همین الان ثابت شد؛ حالا می‌شود گفت کدام دفتر دعوتش کرده.
        return { signupToken: ticket, invite: await pendingInvite(db, phone, null) };
      });
      if ('error' in result) return reply.status(400).send(result);
      return 'session' in result ? result.session : result;
    },
  );

  app.post(
    '/auth/signup',
    {
      schema: bodySchema(
        { signupToken: { type: 'string', maxLength: 100 }, name: { type: 'string', maxLength: 100 }, officeName: { type: 'string', maxLength: 200 }, deviceName, password },
        ['signupToken', 'name', 'officeName', 'deviceName', 'password'],
      ),
    },
    async (req, reply) => {
      const body = req.body as { signupToken: string; name: string; officeName: string; deviceName: string; password: string };
      const name = body.name.trim();
      const officeName = body.officeName.trim();
      if (!name || !officeName) return reply.status(400).send({ error: 'bad_name' });
      if (!passwordOk(body.password)) return reply.status(400).send({ error: 'bad_password' });
      const hash = await hashPassword(body.password);
      const session = await tx(pool, async (db) => {
        const t = await db.query<{ phone: string }>('delete from signup_tickets where hash = $1 and expires_at > now() returning phone', [sha256(body.signupToken)]);
        const phone = t.rows[0]?.phone;
        if (!phone) return null;
        const existing = await db.query<{ id: string; office_id: string; removed: boolean }>('select id, office_id, removed_at is not null as removed from users where phone = $1', [phone]);
        const old = existing.rows[0];
        // شماره از قبل حساب داشت: همان حساب باز می‌شود و رمزش دست نمی‌خورد (شماره همین الان با کد تأیید شده).
        if (old && !old.removed) return startSession(db, old.id, old.office_id, body.deviceName, true);
        const officeId = randomUUID();
        await db.query("select set_config('kelid.office_id', $1, true)", [officeId]);
        await db.query('insert into offices (id, name) values ($1, $2)', [officeId, officeName]);
        const userId = await placeUser(db, old?.id ?? null, { officeId, phone, name, hash, role: 'manager', seeOwnerPhones: true });
        // دفتر خودش را ساخت: دعوت‌های دیگر یعنی «نه، ممنون».
        await db.query('delete from invites where phone = $1', [phone]);
        return startSession(db, userId, officeId, body.deviceName, true);
      });
      if (!session) return reply.status(400).send({ error: 'expired' });
      return session;
    },
  );

  app.post('/auth/login', { schema: bodySchema({ phone: { type: 'string', maxLength: 30 }, password, deviceName }, ['phone', 'password', 'deviceName']) }, async (req, reply) => {
    const body = req.body as { phone: string; password: string; deviceName: string };
    const phone = normalizePhone(body.phone);
    if (!phone) return reply.status(400).send({ error: 'bad_phone' });
    const ipWait = loginByIp.take(req.ip);
    if (ipWait) return limited(reply, ipWait);

    const { rows } = await pool.query<{ id: string; office_id: string; password_hash: string | null; locked: number }>(
      `select id, office_id, password_hash, greatest(0, ceil(extract(epoch from locked_until - now())))::int as locked from users where phone = $1 and removed_at is null`,
      [phone],
    );
    const u = rows[0];
    if (u && u.locked > 0) return limited(reply, u.locked);
    // شمارهٔ بی‌حساب و رمز اشتباه یک جواب دارند تا نشود فهمید چه کسی کاربر کلید است.
    const ok = await verifyPassword(body.password, u?.password_hash ?? null);
    if (!u || !ok) {
      if (u) {
        await pool.query(
          `update users set failed_logins = case when failed_logins + 1 >= $2 then 0 else failed_logins + 1 end,
                            locked_until = case when failed_logins + 1 >= $2 then now() + make_interval(mins => $3) else locked_until end
            where id = $1`,
          [u.id, MAX_PASSWORD_FAILS, LOCK_MINUTES],
        );
      }
      return reply.status(400).send({ error: 'wrong' });
    }
    const session = await tx(pool, async (db) => {
      await db.query('update users set failed_logins = 0, locked_until = null where id = $1', [u.id]);
      return startSession(db, u.id, u.office_id, body.deviceName, false);
    });
    return session;
  });

  /** رمز تازه: با رمز فعلی، یا بدون آن تا چند دقیقه بعد از ورود با کد پیامکی روی همین دستگاه (فراموشی رمز). */
  app.post('/auth/password', { preHandler: requireAuth, schema: bodySchema({ password, current: password }, ['password']) }, async (req, reply) => {
    const body = req.body as { password: string; current?: string };
    if (!passwordOk(body.password)) return reply.status(400).send({ error: 'bad_password' });
    const { rows } = await pool.query<{ password_hash: string | null; fresh: boolean }>(
      `select u.password_hash, coalesce(d.otp_at > now() - make_interval(secs => $3), false) as fresh
         from users u join devices d on d.user_id = u.id where u.id = $1 and d.id = $2`,
      [req.auth!.sub, req.auth!.dev, RESET_WINDOW],
    );
    const r = rows[0];
    if (!r) return reply.status(401).send({ error: 'unauthorized' });
    if (r.password_hash && !r.fresh && !(body.current && (await verifyPassword(body.current, r.password_hash)))) return reply.status(400).send({ error: 'wrong' });
    await pool.query('update users set password_hash = $2, failed_logins = 0, locked_until = null where id = $1', [req.auth!.sub, await hashPassword(body.password)]);
    // فرصت بی‌رمز یک‌بار مصرف است.
    await pool.query('update devices set otp_at = null where id = $1', [req.auth!.dev]);
    return reply.status(204).send();
  });

  /** نام شما و نام دفتر؛ روی همهٔ دستگاه‌های دفتر با تمدید بعدی ورود دیده می‌شود. */
  app.post(
    '/auth/profile',
    { preHandler: requireAuth, schema: bodySchema({ name: { type: 'string', maxLength: 100 }, officeName: { type: 'string', maxLength: 200 } }, []) },
    async (req, reply) => {
      const body = req.body as { name?: string; officeName?: string };
      const name = body.name?.trim();
      const officeName = body.officeName?.trim();
      if (name === '' || officeName === '') return reply.status(400).send({ error: 'bad_name' });
      // نام دفتر را فقط مدیر عوض می‌کند.
      if (officeName !== undefined && req.member!.role !== 'manager') return reply.status(403).send({ error: 'forbidden' });
      const { sub, off } = req.auth!;
      if (name !== undefined) await pool.query('update users set name = $2 where id = $1', [sub, name]);
      // جدول دفترها پشت RLS است؛ فقط دفتر خود کاربر.
      if (officeName !== undefined) await withOffice(pool, off, (db) => db.query('update offices set name = $2 where id = $1', [off, officeName]));
      const u = await pool.query<{ name: string }>('select name from users where id = $1', [sub]);
      const o = await withOffice(pool, off, (db) => db.query<{ name: string }>('select name from offices where id = $1', [off]));
      return { name: u.rows[0]?.name ?? '', officeName: o.rows[0]?.name ?? '' };
    },
  );

  app.post('/auth/refresh', { schema: bodySchema({ refreshToken: { type: 'string', maxLength: 100 } }, ['refreshToken']) }, async (req, reply) => {
    const hash = sha256((req.body as { refreshToken: string }).refreshToken);
    const session = await tx(pool, async (db) => {
      const { rows } = await db.query<{ id: string; user_id: string; office_id: string; is_prev: boolean; in_grace: boolean; idle: boolean }>(
        `select d.id, d.user_id, u.office_id, d.refresh_hash <> $1 as is_prev,
                d.rotated_at > now() - make_interval(secs => $2) as in_grace,
                d.last_seen_at < now() - make_interval(days => $3) as idle
           from devices d join users u on u.id = d.user_id
          where (d.refresh_hash = $1 or d.prev_refresh_hash = $1) and d.revoked_at is null and u.removed_at is null
          for update of d`,
        [hash, REUSE_GRACE, REFRESH_IDLE_DAYS],
      );
      const d = rows[0];
      if (!d) return null;
      // توکن قدیمیِ چرخیده دوباره آمد و پاسخ گم‌شده هم نیست ⇒ احتمالاً دزدیده شده؛ دستگاه بیرون می‌افتد.
      if ((d.is_prev && !d.in_grace) || d.idle) {
        await db.query('update devices set revoked_at = now() where id = $1', [d.id]);
        await kickDevice(db, d.id);
        if (d.is_prev) req.log.warn({ device: d.id }, 'refresh token reuse; device revoked');
        return null;
      }
      return rotate(db, d.id, d.user_id, d.office_id);
    });
    if (!session) return reply.status(401).send({ error: 'unauthorized' });
    return session;
  });

  app.post('/auth/logout', { preHandler: requireAuth }, async (req, reply) => {
    await pool.query('update devices set revoked_at = now() where id = $1', [req.auth!.dev]);
    await kickDevice(pool, req.auth!.dev);
    return reply.status(204).send();
  });

  app.get('/auth/devices', { preHandler: requireAuth }, async (req) => {
    const { rows } = await pool.query<{ id: string; name: string; created_at: Date; last_seen_at: Date }>(
      'select id, name, created_at, last_seen_at from devices where user_id = $1 and revoked_at is null order by last_seen_at desc',
      [req.auth!.sub],
    );
    return rows.map((r) => ({ id: r.id, name: r.name, createdAt: r.created_at.toISOString(), lastSeenAt: r.last_seen_at.toISOString(), current: r.id === req.auth!.dev }));
  });

  app.delete<{ Params: { id: string } }>(
    '/auth/devices/:id',
    { preHandler: requireAuth, schema: { params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } }, required: ['id'] } } },
    async (req, reply) => {
      const { rowCount } = await pool.query('update devices set revoked_at = now() where id = $1 and user_id = $2 and revoked_at is null', [req.params.id, req.auth!.sub]);
      if (rowCount) await kickDevice(pool, req.params.id);
      return reply.status(rowCount ? 204 : 404).send();
    },
  );

  /** شمارهٔ تازه‌ای که دعوت شده، بعد از کد درست: نام و رمز، و عضو همان دفتر می‌شود (جا از وقت دعوت برایش نگه داشته شده). */
  app.post(
    '/auth/join',
    { schema: bodySchema({ signupToken: { type: 'string', maxLength: 100 }, name: { type: 'string', maxLength: 100 }, deviceName, password }, ['signupToken', 'name', 'deviceName', 'password']) },
    async (req, reply) => {
      const body = req.body as { signupToken: string; name: string; deviceName: string; password: string };
      const name = body.name.trim();
      if (!name) return reply.status(400).send({ error: 'bad_name' });
      if (!passwordOk(body.password)) return reply.status(400).send({ error: 'bad_password' });
      const hash = await hashPassword(body.password);
      const result = await tx(pool, async (db) => {
        const t = await db.query<{ phone: string }>('select phone from signup_tickets where hash = $1 and expires_at > now() for update', [sha256(body.signupToken)]);
        const phone = t.rows[0]?.phone;
        if (!phone) return { error: 'expired' as const };
        const inv = await db.query<{ office_id: string; role: Role; see_owner_phones: boolean }>(
          'select office_id, role, see_owner_phones from invites where phone = $1 order by created_at desc limit 1',
          [phone],
        );
        const invite = inv.rows[0];
        // دعوت در این فاصله لغو شد؛ بلیت می‌ماند تا بشود دفتر تازه ساخت.
        if (!invite) return { error: 'not_found' as const };
        await lockTeam(db, invite.office_id);
        if ((await seatsLeft(db, invite.office_id, phone)) <= 0) return { error: 'no_seat' as const };
        await db.query('delete from signup_tickets where hash = $1', [sha256(body.signupToken)]);
        const existing = await db.query<{ id: string; office_id: string; removed: boolean }>('select id, office_id, removed_at is not null as removed from users where phone = $1', [phone]);
        const old = existing.rows[0];
        if (old && !old.removed) return { session: await startSession(db, old.id, old.office_id, body.deviceName, true) };
        const userId = await placeUser(db, old?.id ?? null, { officeId: invite.office_id, phone, name, hash, role: invite.role, seeOwnerPhones: invite.see_owner_phones });
        await db.query('delete from invites where phone = $1', [phone]);
        return { session: await startSession(db, userId, invite.office_id, body.deviceName, true) };
      });
      if ('error' in result) return reply.status(result.error === 'no_seat' ? 409 : 400).send(result);
      return result.session;
    },
  );

  /**
   * کسی که در کلید دفتر خودش را دارد و دفتر دیگری دعوتش کرده: به آن دفتر می‌رود. فقط اگر در دفتر فعلی‌اش تنهاست؛
   * وگرنه مدیر دفتر فعلی باید اول برش دارد. دستگاه‌های دیگرش با تمدید بعدی به دفتر تازه می‌روند.
   */
  app.post('/auth/invite/accept', { preHandler: requireAuth }, async (req, reply) => {
    const { sub, off, dev } = req.auth!;
    const result = await tx(pool, async (db) => {
      const me = await db.query<{ phone: string }>('select phone from users where id = $1 for update', [sub]);
      const phone = me.rows[0]?.phone ?? '';
      const inv = await db.query<{ office_id: string; role: Role; see_owner_phones: boolean }>(
        'select office_id, role, see_owner_phones from invites where phone = $1 and office_id <> $2 order by created_at desc limit 1',
        [phone, off],
      );
      const invite = inv.rows[0];
      if (!invite) return { error: 'not_found' as const };
      const others = await db.query('select 1 from users where office_id = $1 and removed_at is null and id <> $2 limit 1', [off, sub]);
      if (others.rowCount) return { error: 'not_alone' as const };
      await lockTeam(db, invite.office_id);
      if ((await seatsLeft(db, invite.office_id, phone)) <= 0) return { error: 'no_seat' as const };
      await db.query('update users set office_id = $2, role = $3, see_owner_phones = $4 where id = $1', [sub, invite.office_id, invite.role, invite.see_owner_phones]);
      await db.query('delete from invites where phone = $1', [phone]);
      return { session: await rotate(db, dev, sub, invite.office_id) };
    });
    if ('error' in result) return reply.status(result.error === 'not_found' ? 404 : 409).send(result);
    return result.session;
  });

  app.post('/auth/invite/decline', { preHandler: requireAuth }, async (req, reply) => {
    await pool.query('delete from invites where office_id <> $2 and phone = (select phone from users where id = $1)', [req.auth!.sub, req.auth!.off]);
    return reply.status(204).send();
  });

  teamRoutes(app, pool, requireAuth);

  async function startSession(db: Db, userId: string, officeId: string, name: string, viaOtp: boolean): Promise<Session> {
    const deviceId = randomUUID();
    const refresh = randomToken();
    await db.query('insert into devices (id, user_id, name, refresh_hash, otp_at) values ($1, $2, $3, $4, $5)', [deviceId, userId, name.trim() || 'دستگاه', sha256(refresh), viaOtp ? new Date() : null]);
    return session(db, deviceId, userId, officeId, refresh);
  }

  async function rotate(db: Db, deviceId: string, userId: string, officeId: string): Promise<Session> {
    const refresh = randomToken();
    await db.query(
      'update devices set prev_refresh_hash = refresh_hash, refresh_hash = $2, rotated_at = now(), last_seen_at = now() where id = $1',
      [deviceId, sha256(refresh)],
    );
    return session(db, deviceId, userId, officeId, refresh);
  }

  async function session(db: Db, deviceId: string, userId: string, officeId: string, refreshToken: string): Promise<Session> {
    const u = await db.query<{ name: string; phone: string; has_password: boolean; role: Role; phones: boolean }>(
      `select name, phone, password_hash is not null as has_password, role, (role = 'manager' or see_owner_phones) as phones from users where id = $1`,
      [userId],
    );
    const me = u.rows[0];
    const invite = me ? await pendingInvite(db, me.phone, officeId) : null;
    // نام دفتر پشت RLS است؛ فقط در تراکنشی که دفتر خودش تنظیم شده دیده می‌شود.
    await db.query("select set_config('kelid.office_id', $1, true)", [officeId]);
    const o = await db.query<{ name: string }>('select name from offices where id = $1', [officeId]);
    return {
      accessToken: signAccess(accessKey, { sub: userId, off: officeId, dev: deviceId }, ACCESS_TTL),
      accessExpiresIn: ACCESS_TTL,
      refreshToken,
      deviceId,
      user: { id: userId, name: me?.name ?? '', phone: me?.phone ?? '', hasPassword: me?.has_password ?? false, role: me?.role ?? 'agent', seeOwnerPhones: me?.phones ?? false },
      office: { id: officeId, name: o.rows[0]?.name ?? '' },
      invite,
    };
  }
}

function toAsciiDigits(s: string): string {
  return s.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/\s/g, '');
}
