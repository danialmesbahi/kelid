import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { transaction as tx, type Db, type Pool } from '../db';
import { normalizePhone } from './phone';
import { RateLimiter } from './rateLimit';
import type { SmsSender } from './sms';
import { deriveKey, otpCode, otpHash, randomToken, safeEqual, sha256, signAccess, verifyAccess, type AccessClaims } from './tokens';

export const ACCESS_TTL = 15 * 60;
const OTP_TTL = 120; // ثانیه
const RESEND_AFTER = 60;
const MAX_ATTEMPTS = 5; // برای هر کد؛ بعدش کد باطل است
const MAX_SENDS_PER_HOUR = 5; // برای هر شماره
const SIGNUP_TTL = 15 * 60;
const REFRESH_IDLE_DAYS = 180; // دستگاهی که این‌قدر سر نزده دوباره کد می‌خواهد
const REUSE_GRACE = 60; // ثانیه؛ تکرار درخواست تمدیدی که پاسخش در راه گم شده

export interface AuthOptions {
  pool: Pool;
  sms: SmsSender;
  jwtSecret: string;
}

export interface Session {
  accessToken: string;
  accessExpiresIn: number;
  refreshToken: string;
  deviceId: string;
  user: { id: string; name: string; phone: string };
  office: { id: string; name: string };
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AccessClaims | null;
  }
}

const deviceName = { type: 'string', minLength: 1, maxLength: 100 } as const;
const bodySchema = (props: Record<string, object>, required: string[]) => ({ body: { type: 'object', additionalProperties: false, required, properties: props } });

export async function authRoutes(app: FastifyInstance, { pool, sms, jwtSecret }: AuthOptions) {
  const accessKey = deriveKey(jwtSecret, 'access');
  const otpKey = deriveKey(jwtSecret, 'otp');
  const otpByIp = new RateLimiter(10, 10 * 60_000);
  const verifyByIp = new RateLimiter(30, 10 * 60_000);

  const limited = (reply: FastifyReply, retryAfter: number) =>
    reply.status(429).header('retry-after', String(retryAfter)).send({ error: 'too_many', retryAfter });

  app.decorateRequest('auth', null);

  /** درخواست بدون توکن معتبر یا از دستگاهِ بیرون‌شده، 401 می‌گیرد. */
  const requireAuth = async (req: FastifyRequest, reply: FastifyReply) => {
    const h = req.headers.authorization;
    const claims = h?.startsWith('Bearer ') ? verifyAccess(accessKey, h.slice(7)) : null;
    if (!claims) return reply.status(401).send({ error: 'unauthorized' });
    // دستگاهی که از فهرست حذف شد همان لحظه بیرون می‌افتد، نه بعد از پایان عمر توکن.
    const { rowCount } = await pool.query('select 1 from devices where id = $1 and user_id = $2 and revoked_at is null', [claims.dev, claims.sub]);
    if (!rowCount) return reply.status(401).send({ error: 'unauthorized' });
    req.auth = claims;
  };

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
    return { retryAfter: RESEND_AFTER, expiresIn: OTP_TTL };
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

        const user = await db.query<{ id: string; office_id: string }>('select id, office_id from users where phone = $1', [phone]);
        const u = user.rows[0];
        if (u) return { session: await startSession(db, u.id, u.office_id, body.deviceName) };
        const ticket = randomToken();
        await db.query('insert into signup_tickets (hash, phone, expires_at) values ($1, $2, now() + make_interval(secs => $3))', [sha256(ticket), phone, SIGNUP_TTL]);
        await db.query('delete from signup_tickets where expires_at < now()');
        return { signupToken: ticket };
      });
      if ('error' in result) return reply.status(400).send(result);
      return 'session' in result ? result.session : result;
    },
  );

  app.post(
    '/auth/signup',
    {
      schema: bodySchema(
        { signupToken: { type: 'string', maxLength: 100 }, name: { type: 'string', maxLength: 100 }, officeName: { type: 'string', maxLength: 200 }, deviceName },
        ['signupToken', 'name', 'officeName', 'deviceName'],
      ),
    },
    async (req, reply) => {
      const body = req.body as { signupToken: string; name: string; officeName: string; deviceName: string };
      const name = body.name.trim();
      const officeName = body.officeName.trim();
      if (!name || !officeName) return reply.status(400).send({ error: 'bad_name' });
      const session = await tx(pool, async (db) => {
        const t = await db.query<{ phone: string }>('delete from signup_tickets where hash = $1 and expires_at > now() returning phone', [sha256(body.signupToken)]);
        const phone = t.rows[0]?.phone;
        if (!phone) return null;
        const existing = await db.query<{ id: string; office_id: string }>('select id, office_id from users where phone = $1', [phone]);
        if (existing.rows[0]) return startSession(db, existing.rows[0].id, existing.rows[0].office_id, body.deviceName);
        const officeId = randomUUID();
        const userId = randomUUID();
        await db.query("select set_config('kelid.office_id', $1, true)", [officeId]);
        await db.query('insert into offices (id, name) values ($1, $2)', [officeId, officeName]);
        await db.query('insert into users (id, office_id, phone, name) values ($1, $2, $3, $4)', [userId, officeId, phone, name]);
        return startSession(db, userId, officeId, body.deviceName);
      });
      if (!session) return reply.status(400).send({ error: 'expired' });
      return session;
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
          where (d.refresh_hash = $1 or d.prev_refresh_hash = $1) and d.revoked_at is null
          for update of d`,
        [hash, REUSE_GRACE, REFRESH_IDLE_DAYS],
      );
      const d = rows[0];
      if (!d) return null;
      // توکن قدیمیِ چرخیده دوباره آمد و پاسخ گم‌شده هم نیست ⇒ احتمالاً دزدیده شده؛ دستگاه بیرون می‌افتد.
      if ((d.is_prev && !d.in_grace) || d.idle) {
        await db.query('update devices set revoked_at = now() where id = $1', [d.id]);
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
      return reply.status(rowCount ? 204 : 404).send();
    },
  );

  async function startSession(db: Db, userId: string, officeId: string, name: string): Promise<Session> {
    const deviceId = randomUUID();
    const refresh = randomToken();
    await db.query('insert into devices (id, user_id, name, refresh_hash) values ($1, $2, $3, $4)', [deviceId, userId, name.trim() || 'دستگاه', sha256(refresh)]);
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
    const u = await db.query<{ name: string; phone: string }>('select name, phone from users where id = $1', [userId]);
    // نام دفتر پشت RLS است؛ فقط در تراکنشی که دفتر خودش تنظیم شده دیده می‌شود.
    await db.query("select set_config('kelid.office_id', $1, true)", [officeId]);
    const o = await db.query<{ name: string }>('select name from offices where id = $1', [officeId]);
    return {
      accessToken: signAccess(accessKey, { sub: userId, off: officeId, dev: deviceId }, ACCESS_TTL),
      accessExpiresIn: ACCESS_TTL,
      refreshToken,
      deviceId,
      user: { id: userId, name: u.rows[0]?.name ?? '', phone: u.rows[0]?.phone ?? '' },
      office: { id: officeId, name: o.rows[0]?.name ?? '' },
    };
  }
}

function toAsciiDigits(s: string): string {
  return s.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/\s/g, '');
}
