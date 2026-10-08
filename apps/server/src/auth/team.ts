import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import { transaction as tx, type Db, type Pool } from '../db';
import { announce, kickDevice } from '../sync/live';
import { normalizePhone } from './phone';
import { RateLimiter } from './rateLimit';

/**
 * همکاران دفتر: مدیر با شماره دعوت می‌کند، نقش و اجازهٔ دیدن شمارهٔ مالک‌ها را تعیین می‌کند و کسی را برمی‌دارد.
 * users و invites مال هیچ دفتری نیستند (پیش از ورود دفتری معلوم نیست)، پس هر کوئری اینجا صریحاً با office_id خود کاربر محدود است.
 */

export const ROLES = ['manager', 'agent'] as const;
export type Role = (typeof ROLES)[number];

/** دعوتی که منتظر همین شماره است؛ فقط بعد از اثبات مالکیت شماره (کد درست یا ورود) نشان داده می‌شود. */
export interface InviteInfo {
  officeName: string;
  invitedBy: string;
  name: string;
  role: Role;
}
const uuidParam = { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } } as const;
const phoneParam = { type: 'object', additionalProperties: false, required: ['phone'], properties: { phone: { type: 'string', pattern: '^09[0-9]{9}$' } } } as const;

export interface Member {
  id: string;
  name: string;
  phone: string;
  role: Role;
  seeOwnerPhones: boolean;
  lastSeenAt: string | null;
}

export interface Invite {
  phone: string;
  name: string;
  role: Role;
  seeOwnerPhones: boolean;
  invitedBy: string;
  createdAt: string;
}

export interface Team {
  seats: number;
  members: Member[];
  invites: Invite[];
}

/** تازه‌ترین دعوتِ یک شماره (جز دفتر خودش). نام دفتر پشت RLS است؛ دفتر تراکنش عوض می‌شود و صدازننده دوباره تنظیمش می‌کند. */
export async function pendingInvite(db: Db, phone: string, exceptOffice: string | null): Promise<InviteInfo | null> {
  const { rows } = await db.query<{ office_id: string; name: string; role: Role; by: string }>(
    `select i.office_id, i.name, i.role, u.name as by from invites i join users u on u.id = i.invited_by
      where i.phone = $1 and ($2::uuid is null or i.office_id <> $2::uuid) order by i.created_at desc limit 1`,
    [phone, exceptOffice],
  );
  const i = rows[0];
  if (!i) return null;
  await db.query("select set_config('kelid.office_id', $1, true)", [i.office_id]);
  const o = await db.query<{ name: string }>('select name from offices where id = $1', [i.office_id]);
  return { officeName: o.rows[0]?.name ?? '', invitedBy: i.by, name: i.name, role: i.role };
}

/** کاربر تازه، یا کسی که قبلاً از دفتری برداشته شده بود، در دفتر جای می‌گیرد. شناسهٔ کاربر را برمی‌گرداند. */
export async function placeUser(
  db: Db,
  existingId: string | null,
  u: { officeId: string; phone: string; name: string; hash: string; role: Role; seeOwnerPhones: boolean },
): Promise<string> {
  if (existingId) {
    await db.query(
      `update users set office_id = $2, name = $3, password_hash = $4, role = $5, see_owner_phones = $6,
                        removed_at = null, failed_logins = 0, locked_until = null
        where id = $1`,
      [existingId, u.officeId, u.name, u.hash, u.role, u.seeOwnerPhones],
    );
    return existingId;
  }
  const id = randomUUID();
  await db.query('insert into users (id, office_id, phone, name, password_hash, role, see_owner_phones) values ($1, $2, $3, $4, $5, $6, $7)', [
    id,
    u.officeId,
    u.phone,
    u.name,
    u.hash,
    u.role,
    u.seeOwnerPhones,
  ]);
  return id;
}

/** تغییرهای اعضای یک دفتر پشت هم؛ دو مدیر هم‌زمان نمی‌توانند از سقف جا یا «آخرین مدیر» رد شوند. */
export async function lockTeam(db: Db, officeId: string): Promise<void> {
  await db.query('select pg_advisory_xact_lock(hashtext($1))', [`kelid:team:${officeId}`]);
}

/** چند جای خالی مانده؛ هر عضو و هر دعوت باز یک جا می‌گیرد. exceptPhone: دعوتی که همین الان عوض یا پذیرفته می‌شود. */
export async function seatsLeft(db: Db, officeId: string, exceptPhone: string | null): Promise<number> {
  await db.query("select set_config('kelid.office_id', $1, true)", [officeId]);
  const { rows } = await db.query<{ left: number }>(
    `select (select seats from offices where id = $1)
          - (select count(*) from users where office_id = $1 and removed_at is null)
          - (select count(*) from invites where office_id = $1 and ($2::text is null or phone <> $2)) as left`,
    [officeId, exceptPhone],
  );
  return Number(rows[0]?.left ?? 0);
}

/** از authRoutes ثبت می‌شود تا همان نگهبان ورود را داشته باشد. */
export function teamRoutes(app: FastifyInstance, pool: Pool, requireAuth: preHandlerAsyncHookHandler) {
  // دعوت پیامک نمی‌فرستد، ولی سقف دارد تا کسی با آن شماره‌ها را امتحان نکند.
  const invitesByOffice = new RateLimiter(30, 60 * 60_000);

  const managerOnly = async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.member?.role !== 'manager') return reply.status(403).send({ error: 'forbidden' });
  };
  const guard = { preHandler: [requireAuth, managerOnly] };

  app.get('/team', { preHandler: requireAuth }, async (req): Promise<Team> => {
    const off = req.auth!.off;
    return tx(pool, async (db) => {
      const m = await db.query<{ id: string; name: string; phone: string; role: Role; see_owner_phones: boolean; last_seen: Date | null }>(
        `select u.id, u.name, u.phone, u.role, u.see_owner_phones,
                (select max(d.last_seen_at) from devices d where d.user_id = u.id and d.revoked_at is null) as last_seen
           from users u where u.office_id = $1 and u.removed_at is null
          order by (u.role = 'manager') desc, u.created_at`,
        [off],
      );
      const i = await db.query<{ phone: string; name: string; role: Role; see_owner_phones: boolean; by: string; created_at: Date }>(
        `select i.phone, i.name, i.role, i.see_owner_phones, u.name as by, i.created_at
           from invites i join users u on u.id = i.invited_by where i.office_id = $1 order by i.created_at`,
        [off],
      );
      await db.query("select set_config('kelid.office_id', $1, true)", [off]);
      const o = await db.query<{ seats: number }>('select seats from offices where id = $1', [off]);
      return {
        seats: o.rows[0]?.seats ?? 0,
        members: m.rows.map((r) => ({
          id: r.id,
          name: r.name,
          phone: r.phone,
          role: r.role,
          seeOwnerPhones: r.role === 'manager' || r.see_owner_phones,
          lastSeenAt: r.last_seen?.toISOString() ?? null,
        })),
        invites: i.rows.map((r) => ({ phone: r.phone, name: r.name, role: r.role, seeOwnerPhones: r.role === 'manager' || r.see_owner_phones, invitedBy: r.by, createdAt: r.created_at.toISOString() })),
      };
    });
  });

  app.post(
    '/team/invites',
    {
      ...guard,
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['phone', 'name', 'role'],
          properties: { phone: { type: 'string', maxLength: 30 }, name: { type: 'string', maxLength: 100 }, role: { type: 'string', enum: ROLES }, seeOwnerPhones: { type: 'boolean' } },
        },
      },
    },
    async (req, reply) => {
      const body = req.body as { phone: string; name: string; role: Role; seeOwnerPhones?: boolean };
      const phone = normalizePhone(body.phone);
      const name = body.name.trim();
      if (!phone) return reply.status(400).send({ error: 'bad_phone' });
      if (!name) return reply.status(400).send({ error: 'bad_name' });
      const { off, sub } = req.auth!;
      const wait = invitesByOffice.take(off);
      if (wait) return reply.status(429).header('retry-after', String(wait)).send({ error: 'too_many', retryAfter: wait });
      const error = await tx(pool, async (db) => {
        await lockTeam(db, off);
        const member = await db.query('select 1 from users where phone = $1 and office_id = $2 and removed_at is null', [phone, off]);
        if (member.rowCount) return 'member';
        if ((await seatsLeft(db, off, phone)) <= 0) return 'no_seat';
        // دعوت دوباره به همان شماره فقط نام و نقش را به‌روز می‌کند.
        await db.query(
          `insert into invites (office_id, phone, name, role, see_owner_phones, invited_by) values ($1, $2, $3, $4, $5, $6)
           on conflict (office_id, phone) do update set name = excluded.name, role = excluded.role, see_owner_phones = excluded.see_owner_phones`,
          [off, phone, name, body.role, body.role === 'manager' || !!body.seeOwnerPhones, sub],
        );
        return null;
      });
      // دعوت به شمارهٔ کسی که در دفتر دیگری است هم پذیرفته می‌شود؛ وگرنه از جواب معلوم می‌شد چه کسی کاربر کلید است.
      if (error) return reply.status(409).send({ error });
      return reply.status(204).send();
    },
  );

  app.delete('/team/invites/:phone', { ...guard, schema: { params: phoneParam } }, async (req, reply) => {
    const { phone } = req.params as { phone: string };
    const r = await pool.query('delete from invites where office_id = $1 and phone = $2', [req.auth!.off, phone]);
    return reply.status(r.rowCount ? 204 : 404).send();
  });

  app.post(
    '/team/members/:id',
    {
      ...guard,
      schema: {
        params: uuidParam,
        body: { type: 'object', additionalProperties: false, minProperties: 1, properties: { role: { type: 'string', enum: ROLES }, seeOwnerPhones: { type: 'boolean' } } },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const body = req.body as { role?: Role; seeOwnerPhones?: boolean };
      const { off, dev } = req.auth!;
      const error = await tx(pool, async (db) => {
        await lockTeam(db, off);
        const cur = await db.query<{ role: Role }>('select role from users where id = $1 and office_id = $2 and removed_at is null for update', [id, off]);
        const u = cur.rows[0];
        if (!u) return 'not_found';
        if (u.role === 'manager' && body.role === 'agent' && (await managers(db, off)) <= 1) return 'last_manager';
        await db.query('update users set role = coalesce($2, role), see_owner_phones = coalesce($3, see_owner_phones) where id = $1', [id, body.role ?? null, body.seeOwnerPhones ?? null]);
        // دستگاه‌های دفتر سر می‌زنند؛ دستگاه همین عضو با pull بعدی اجازهٔ تازه‌اش را می‌گیرد.
        await announce(db, off, dev);
        return null;
      });
      if (error) return reply.status(error === 'not_found' ? 404 : 409).send({ error });
      return reply.status(204).send();
    },
  );

  app.delete('/team/members/:id', { ...guard, schema: { params: uuidParam } }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { off, sub } = req.auth!;
    // برداشتن خود از دفتر از اینجا نیست؛ وگرنه مدیر با یک کلیک اشتباه بیرون می‌افتد.
    if (id === sub) return reply.status(409).send({ error: 'self' });
    const error = await tx(pool, async (db) => {
      await lockTeam(db, off);
      const cur = await db.query<{ role: Role }>('select role from users where id = $1 and office_id = $2 and removed_at is null for update', [id, off]);
      const u = cur.rows[0];
      if (!u) return 'not_found';
      if (u.role === 'manager' && (await managers(db, off)) <= 1) return 'last_manager';
      await db.query('update users set removed_at = now() where id = $1', [id]);
      // همهٔ دستگاه‌هایش همان لحظه بیرون می‌افتند؛ اتصال زنده هم بسته می‌شود.
      const d = await db.query<{ id: string }>('update devices set revoked_at = now() where user_id = $1 and revoked_at is null returning id', [id]);
      for (const r of d.rows) await kickDevice(db, r.id);
      return null;
    });
    if (error) return reply.status(error === 'not_found' ? 404 : 409).send({ error });
    return reply.status(204).send();
  });
}

async function managers(db: Db, officeId: string): Promise<number> {
  const { rows } = await db.query<{ n: number }>("select count(*)::int as n from users where office_id = $1 and removed_at is null and role = 'manager'", [officeId]);
  return rows[0]?.n ?? 0;
}
