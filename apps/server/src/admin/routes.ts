import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { PLANS, planById, type PlanId } from '@kelid/core/plans';
import { toFaDigits } from '@kelid/core/persian';
import { withVendor, type Db, type Pool } from '../db';
import { PASSWORD_MAX, verifyPassword } from '../auth/password';
import { normalizePhone } from '../auth/phone';
import { RateLimiter } from '../auth/rateLimit';
import { accessExpiry, deriveKey, readToken, signToken } from '../auth/tokens';
import { securityHeaders } from '../headers';
import type { LiveHub } from '../sync/live';
import { seatsUsed } from '../billing/routes';
import { checkTotp } from './totp';

// پنل فروشنده: تیم کلید دفترها، اشتراک‌ها و پرداخت‌ها را می‌بیند، تمدید یا معلق می‌کند و یادداشت پشتیبانی می‌گذارد.
// ورودش از دفترها جداست (جدول vendor_admins، کلید امضای جدا، رمز + کد دومرحله‌ای) و حساب فقط با خط فرمان ساخته می‌شود (admin/cli.ts).

export const VENDOR_TTL = 8 * 60 * 60;
const MAX_FAILS = 5;
const LOCK_MINUTES = 15;
const ENDING_DAYS = 7;

export interface VendorAdmin {
  id: string;
  name: string;
  phone: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    vendor: VendorAdmin | null;
  }
}

export interface AdminOptions {
  pool: Pool;
  jwtSecret: string;
  hub: LiveHub;
}

// هر ۲۵ ثانیه یک خط خالی تا پراکسی‌ها اتصال را نبندند؛ همان لحظه غیرفعال بودن حساب هم دوباره بررسی می‌شود.
const VENDOR_BEAT_MS = 25_000;

export type OfficeStatus = 'trial' | 'active' | 'ending' | 'expired' | 'suspended';
const STATUSES: OfficeStatus[] = ['trial', 'active', 'ending', 'expired', 'suspended'];

// وضعیت دفتر به همان ترتیبی که برنامهٔ دفتر نشان می‌دهد: معلق، تمام‌شده، رو به پایان، آزمایشی، فعال.
const STATUS_SQL = `case when o.suspended_at is not null then 'suspended'
  when o.expires_at <= now() then 'expired'
  when o.expires_at <= now() + interval '${ENDING_DAYS} days' then 'ending'
  when o.trial then 'trial' else 'active' end`;

const UUID_PATTERN = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
const idParams = { params: { type: 'object', required: ['id'], properties: { id: { type: 'string', pattern: UUID_PATTERN } } } } as const;
const body = (props: Record<string, object>, required: string[]) => ({ type: 'object', additionalProperties: false, required, properties: props }) as const;

export async function adminRoutes(app: FastifyInstance, { pool, jwtSecret, hub }: AdminOptions) {
  const key = deriveKey(jwtSecret, 'vendor');
  const loginByIp = new RateLimiter(10, 10 * 60_000);

  const requireVendor = async (req: FastifyRequest, reply: FastifyReply) => {
    const h = req.headers.authorization;
    const p = h?.startsWith('Bearer ') ? readToken(key, h.slice(7)) : null;
    if (!p || p.typ !== 'vendor' || typeof p.sub !== 'string') return reply.status(401).send({ error: 'unauthorized' });
    const id = p.sub;
    // حسابی که غیرفعال شد همان لحظه بیرون می‌افتد، نه بعد از پایان عمر توکن.
    const admin = await withVendor(pool, async (db) => {
      const { rows } = await db.query<VendorAdmin>('select id, name, phone from vendor_admins where id = $1 and disabled_at is null', [id]);
      return rows[0];
    });
    if (!admin) return reply.status(401).send({ error: 'unauthorized' });
    req.vendor = admin;
  };

  app.post(
    '/admin/login',
    {
      schema: {
        body: body(
          { phone: { type: 'string', maxLength: 30 }, password: { type: 'string', maxLength: PASSWORD_MAX }, code: { type: 'string', maxLength: 12 } },
          ['phone', 'password', 'code'],
        ),
      },
    },
    async (req, reply) => {
      const wait = loginByIp.take(req.ip);
      if (wait) return reply.status(429).header('retry-after', String(wait)).send({ error: 'too_many', retryAfter: wait });
      const b = req.body as { phone: string; password: string; code: string };
      const phone = normalizePhone(b.phone);
      const code = b.code.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/\s/g, '');

      const out = await withVendor(pool, async (db) => {
        const { rows } = await db.query<{
          id: string;
          name: string;
          phone: string;
          password_hash: string;
          totp_secret: string;
          totp_last_step: string;
          locked: number;
        }>(
          `select id, name, phone, password_hash, totp_secret, totp_last_step,
                  greatest(0, ceil(extract(epoch from locked_until - now())))::int as locked
             from vendor_admins where phone = $1 and disabled_at is null for update`,
          [phone ?? ''],
        );
        const a = rows[0];
        // شماره‌ای که حساب ندارد هم همان‌قدر وقت می‌برد تا از زمان پاسخ چیزی معلوم نشود.
        if (!a) {
          await verifyPassword(b.password, null);
          return { error: 'bad_login' as const };
        }
        if (a.locked > 0) return { error: 'locked' as const, retryAfter: a.locked };
        const passOk = await verifyPassword(b.password, a.password_hash);
        const step = passOk ? checkTotp(a.totp_secret, code, Number(a.totp_last_step)) : null;
        if (step === null) {
          await db.query(
            `update vendor_admins set failed_logins = failed_logins + 1,
                    locked_until = case when failed_logins + 1 >= $2 then now() + make_interval(mins => $3) end
              where id = $1`,
            [a.id, MAX_FAILS, LOCK_MINUTES],
          );
          return { error: 'bad_login' as const };
        }
        await db.query('update vendor_admins set failed_logins = 0, locked_until = null, totp_last_step = $2, last_login_at = now() where id = $1', [
          a.id,
          step,
        ]);
        return { admin: { id: a.id, name: a.name, phone: a.phone } };
      });

      if ('admin' in out && out.admin) {
        req.log.info({ admin: out.admin.id }, 'vendor login');
        return { token: signToken(key, { sub: out.admin.id, typ: 'vendor' }, VENDOR_TTL), expiresIn: VENDOR_TTL, admin: out.admin };
      }
      if (out.error === 'locked') return reply.status(429).header('retry-after', String(out.retryAfter)).send({ error: 'locked', retryAfter: out.retryAfter });
      return reply.status(401).send({ error: 'bad_login' });
    },
  );

  app.get('/admin/me', { preHandler: requireVendor }, async (req) => ({ admin: req.vendor }));

  /**
   * اتصال زندهٔ پنل (Server-Sent Events): هر بار دفتری، عضوی، دعوتی، پرداختی یا یادداشتی عوض شد فقط شناسهٔ دفتر می‌آید
   * و پنل همان صفحه‌ای را که باز است بی‌صدا تازه می‌کند. داده از این راه نمی‌آید؛ هر خواندن همچنان از مسیرهای پنل می‌گذرد.
   * عمر اتصال از توکنش بیشتر نیست و حساب غیرفعال‌شده همان لحظه (یا حداکثر با ضربان بعدی) قطع می‌شود.
   */
  app.get('/admin/events', { preHandler: requireVendor }, async (req, reply) => {
    const admin = req.vendor!.id;
    if (!hub.hasVendorRoom(admin)) return reply.status(503).header('retry-after', '30').send({ error: 'busy' });
    await hub.ready();
    const ttl = accessExpiry(req.headers.authorization!.slice(7)) - Date.now();
    if (ttl <= 0) return reply.status(401).send({ error: 'unauthorized' });

    reply.hijack();
    const res = reply.raw;
    const head: Record<string, string> = { ...securityHeaders };
    for (const [k, v] of Object.entries(reply.getHeaders())) if (typeof v === 'string') head[k] = v;
    res.writeHead(200, { ...head, 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' });
    res.write('retry: 2000\n: ready\n\n');

    let open = true;
    const close = () => {
      if (!open) return;
      open = false;
      clearInterval(beat);
      clearTimeout(expire);
      remove();
      res.end();
    };
    const beat = setInterval(() => {
      if (!open) return;
      res.write(': \n\n');
      withVendor(pool, (db) => db.query('select 1 from vendor_admins where id = $1 and disabled_at is null', [admin])).then(
        (r) => r.rowCount || close(),
        () => {},
      );
    }, VENDOR_BEAT_MS);
    const expire = setTimeout(close, ttl);
    const remove = hub.addVendor({ admin, changed: (ids) => open && res.write(`data: ${JSON.stringify({ o: ids })}\n\n`), close });
    req.raw.on('close', close);
    res.on('error', close);
  });

  app.get('/admin/stats', { preHandler: requireVendor }, async () =>
    withVendor(pool, async (db) => {
      const { rows } = await db.query<Record<OfficeStatus | 'offices' | 'fresh', number>>(
        `select count(*)::int as offices,
                count(*) filter (where s = 'trial')::int as trial,
                count(*) filter (where s = 'active')::int as active,
                count(*) filter (where s = 'ending')::int as ending,
                count(*) filter (where s = 'expired')::int as expired,
                count(*) filter (where s = 'suspended')::int as suspended,
                count(*) filter (where created_at > now() - interval '30 days')::int as fresh
           from (select ${STATUS_SQL} as s, o.created_at from offices o) x`,
      );
      const pay = await db.query<{ revenue: string; count: number; total: string }>(
        `select coalesce(sum(amount) filter (where paid_at > now() - interval '30 days'), 0) as revenue,
                (count(*) filter (where paid_at > now() - interval '30 days'))::int as count,
                coalesce(sum(amount), 0) as total
           from payments where status = 'paid'`,
      );
      const p = pay.rows[0]!;
      return { ...rows[0]!, revenue30: Number(p.revenue) / 10, payments30: p.count, revenueTotal: Number(p.total) / 10 };
    }),
  );

  app.get(
    '/admin/offices',
    {
      preHandler: requireVendor,
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: { q: { type: 'string', maxLength: 100 }, status: { type: 'string', enum: STATUSES } },
        },
      },
    },
    async (req) => {
      const { q = '', status } = req.query as { q?: string; status?: OfficeStatus };
      const term = searchTerm(q);
      return withVendor(pool, async (db) => {
        const { rows } = await db.query<OfficeRow>(
          `select * from (select ${OFFICE_COLS} from offices o ${MANAGER_JOIN}) x
            where ($1::text is null or x.status = $1)
              and ($2::text = '' or translate(x.name, 'يك', 'یک') ilike '%' || $2 || '%' escape '\\'
                   or exists (select 1 from users u where u.office_id = x.id and u.phone like '%' || $3 || '%' and $3 <> ''))
            order by x.created_at desc limit 300`,
          [status ?? null, term.text, term.digits],
        );
        return { offices: rows.map(officeOut) };
      });
    },
  );

  app.get('/admin/offices/:id', { preHandler: requireVendor, schema: idParams }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = await withVendor(pool, async (db) => {
      const o = await db.query<OfficeRow>(`select ${OFFICE_COLS} from offices o ${MANAGER_JOIN} where o.id = $1`, [id]);
      if (!o.rows[0]) return null;
      return { office: o.rows[0], ...(await officeDetail(db, id)) };
    });
    if (!r) return reply.status(404).send({ error: 'not_found' });
    return { office: officeOut(r.office), members: r.members, invites: r.invites, payments: r.payments, notes: r.notes };
  });

  app.post(
    '/admin/offices/:id/extend',
    {
      preHandler: requireVendor,
      schema: {
        ...idParams,
        body: body(
          {
            days: { type: 'integer', minimum: 1, maximum: 1095 },
            plan: { type: 'string', enum: PLANS.map((p) => p.id) },
            trial: { type: 'boolean' },
            note: { type: 'string', minLength: 1, maxLength: 500 },
          },
          ['days', 'plan', 'trial', 'note'],
        ),
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const b = req.body as { days: number; plan: PlanId; trial: boolean; note: string };
      const note = b.note.trim();
      if (!note) return reply.status(400).send({ error: 'bad_note' });
      const plan = planById(b.plan)!;
      const r = await withVendor(pool, async (db) => {
        const found = await db.query('select 1 from offices where id = $1 for update', [id]);
        if (!found.rowCount) return 'not_found' as const;
        if (plan.seats < (await seatsUsed(db, id))) return 'too_small' as const;
        await db.query(
          `update offices set plan = $2, seats = $3, trial = $4,
                  expires_at = greatest(expires_at, now()) + make_interval(days => $5)
            where id = $1`,
          [id, plan.id, plan.seats, b.trial, b.days],
        );
        const text = `تمدید ${toFaDigits(b.days)} روزه، پلن ${plan.name}${b.trial ? ' (آزمایشی)' : ''}: ${note}`;
        await addNote(db, id, req.vendor!.id, 'extend', text);
        return 'ok' as const;
      });
      if (r !== 'ok') return reply.status(r === 'not_found' ? 404 : 409).send({ error: r });
      req.log.info({ admin: req.vendor!.id, office: id, days: b.days, plan: plan.id }, 'vendor extended office');
      return reply.send(await officeAfter(id));
    },
  );

  app.post(
    '/admin/offices/:id/suspend',
    { preHandler: requireVendor, schema: { ...idParams, body: body({ reason: { type: 'string', minLength: 1, maxLength: 500 } }, ['reason']) } },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const reason = (req.body as { reason: string }).reason.trim();
      if (!reason) return reply.status(400).send({ error: 'bad_note' });
      const r = await withVendor(pool, async (db) => {
        const { rowCount } = await db.query('update offices set suspended_at = now(), suspend_reason = $2 where id = $1 and suspended_at is null', [
          id,
          reason,
        ]);
        if (!rowCount) return (await db.query('select 1 from offices where id = $1', [id])).rowCount ? ('already' as const) : ('not_found' as const);
        await addNote(db, id, req.vendor!.id, 'suspend', reason);
        return 'ok' as const;
      });
      if (r !== 'ok') return reply.status(r === 'not_found' ? 404 : 409).send({ error: r });
      req.log.info({ admin: req.vendor!.id, office: id }, 'vendor suspended office');
      return reply.send(await officeAfter(id));
    },
  );

  app.post(
    '/admin/offices/:id/resume',
    { preHandler: requireVendor, schema: { ...idParams, body: body({ note: { type: 'string', maxLength: 500 } }, []) } },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const note = ((req.body as { note?: string } | undefined)?.note ?? '').trim();
      const r = await withVendor(pool, async (db) => {
        const { rowCount } = await db.query('update offices set suspended_at = null, suspend_reason = null where id = $1 and suspended_at is not null', [id]);
        if (!rowCount) return (await db.query('select 1 from offices where id = $1', [id])).rowCount ? ('already' as const) : ('not_found' as const);
        await addNote(db, id, req.vendor!.id, 'resume', note || 'تعلیق برداشته شد');
        return 'ok' as const;
      });
      if (r !== 'ok') return reply.status(r === 'not_found' ? 404 : 409).send({ error: r });
      req.log.info({ admin: req.vendor!.id, office: id }, 'vendor resumed office');
      return reply.send(await officeAfter(id));
    },
  );

  app.post(
    '/admin/offices/:id/notes',
    { preHandler: requireVendor, schema: { ...idParams, body: body({ body: { type: 'string', minLength: 1, maxLength: 2000 } }, ['body']) } },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const text = (req.body as { body: string }).body.trim();
      if (!text) return reply.status(400).send({ error: 'bad_note' });
      const ok = await withVendor(pool, async (db) => {
        if (!(await db.query('select 1 from offices where id = $1', [id])).rowCount) return false;
        await addNote(db, id, req.vendor!.id, 'note', text);
        return true;
      });
      if (!ok) return reply.status(404).send({ error: 'not_found' });
      return reply.send(await officeAfter(id));
    },
  );

  app.get(
    '/admin/payments',
    {
      preHandler: requireVendor,
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: { status: { type: 'string', enum: ['paid', 'pending', 'failed', 'canceled'] } },
        },
      },
    },
    async (req) => {
      const { status } = req.query as { status?: string };
      return withVendor(pool, async (db) => {
        const { rows } = await db.query<PaymentRow & { office_id: string; office_name: string }>(
          `select ${PAYMENT_COLS}, p.office_id, o.name as office_name
             from payments p join offices o on o.id = p.office_id
            where $1::text is null or ${PAYMENT_STATUS_SQL} = $1
            order by p.created_at desc limit 300`,
          [status ?? null],
        );
        return { payments: rows.map((r) => ({ ...paymentOut(r), office: { id: r.office_id, name: r.office_name } })) };
      });
    },
  );

  /** دفتر بعد از هر کار پنل، با همهٔ جزئیات؛ صفحه بی درخواست دوباره به‌روز می‌شود. */
  async function officeAfter(id: string) {
    return withVendor(pool, async (db) => {
      const o = await db.query<OfficeRow>(`select ${OFFICE_COLS} from offices o ${MANAGER_JOIN} where o.id = $1`, [id]);
      return { office: officeOut(o.rows[0]!), ...(await officeDetail(db, id)) };
    });
  }
}

async function addNote(db: Db, officeId: string, adminId: string, kind: 'note' | 'extend' | 'suspend' | 'resume', text: string) {
  await db.query('insert into vendor_notes (office_id, id, admin_id, kind, body) values ($1, $2, $3, $4, $5)', [officeId, randomUUID(), adminId, kind, text]);
}

const OFFICE_COLS = `o.id, o.name, o.plan, o.trial, o.expires_at, o.seats, o.created_at, o.suspended_at, o.suspend_reason, ${STATUS_SQL} as status,
  (select count(*) from users u where u.office_id = o.id and u.removed_at is null)::int as members,
  (select max(d.last_seen_at) from devices d join users u on u.id = d.user_id where u.office_id = o.id and d.revoked_at is null) as last_seen_at,
  (select coalesce(sum(p.amount), 0) from payments p where p.office_id = o.id and p.status = 'paid') as paid_total,
  m.name as manager_name, m.phone as manager_phone`;

// مدیر اول دفتر (سازندهٔ آن) به‌عنوان طرف تماس پشتیبانی.
const MANAGER_JOIN = `left join lateral (select name, phone from users u where u.office_id = o.id and u.role = 'manager' and u.removed_at is null
  order by u.created_at limit 1) m on true`;

interface OfficeRow {
  id: string;
  name: string;
  plan: string;
  trial: boolean;
  expires_at: Date;
  seats: number;
  created_at: Date;
  suspended_at: Date | null;
  suspend_reason: string | null;
  status: OfficeStatus;
  members: number;
  last_seen_at: Date | null;
  paid_total: string;
  manager_name: string | null;
  manager_phone: string | null;
}

function officeOut(r: OfficeRow) {
  return {
    id: r.id,
    name: r.name,
    plan: r.plan,
    trial: r.trial,
    status: r.status,
    expiresAt: r.expires_at.toISOString(),
    seats: r.seats,
    members: r.members,
    createdAt: r.created_at.toISOString(),
    lastSeenAt: r.last_seen_at?.toISOString() ?? null,
    suspendedAt: r.suspended_at?.toISOString() ?? null,
    suspendReason: r.suspend_reason,
    paidTotal: Number(r.paid_total) / 10,
    manager: r.manager_phone ? { name: r.manager_name!, phone: r.manager_phone } : null,
  };
}

async function officeDetail(db: Db, id: string) {
  const members = await db.query<{ id: string; name: string; phone: string; role: string; created_at: Date; last_seen_at: Date | null }>(
    `select u.id, u.name, u.phone, u.role, u.created_at,
            (select max(d.last_seen_at) from devices d where d.user_id = u.id and d.revoked_at is null) as last_seen_at
       from users u where u.office_id = $1 and u.removed_at is null order by u.created_at`,
    [id],
  );
  const invites = await db.query<{ name: string; phone: string; role: string; created_at: Date }>(
    'select name, phone, role, created_at from invites where office_id = $1 order by created_at',
    [id],
  );
  const pays = await db.query<PaymentRow>(`select ${PAYMENT_COLS} from payments p where p.office_id = $1 order by p.created_at desc limit 50`, [id]);
  const notes = await db.query<{ id: string; kind: string; body: string; created_at: Date; admin_name: string }>(
    `select n.id, n.kind, n.body, n.created_at, a.name as admin_name
       from vendor_notes n join vendor_admins a on a.id = n.admin_id
      where n.office_id = $1 order by n.created_at desc limit 100`,
    [id],
  );
  return {
    members: members.rows.map((m) => ({
      id: m.id,
      name: m.name,
      phone: m.phone,
      role: m.role,
      createdAt: m.created_at.toISOString(),
      lastSeenAt: m.last_seen_at?.toISOString() ?? null,
    })),
    invites: invites.rows.map((i) => ({ name: i.name, phone: i.phone, role: i.role, createdAt: i.created_at.toISOString() })),
    payments: pays.rows.map(paymentOut),
    notes: notes.rows.map((n) => ({ id: n.id, kind: n.kind, body: n.body, createdAt: n.created_at.toISOString(), admin: n.admin_name })),
  };
}

// پرداختی که نیم ساعت در انتظار مانده یعنی کاربر از درگاه برنگشته؛ مثل صفحهٔ برنامه «لغو شده» دیده می‌شود.
const PAYMENT_STATUS_SQL = `case when p.status = 'pending' and p.created_at < now() - interval '30 minutes' then 'canceled' else p.status end`;
const PAYMENT_COLS = `p.id, p.plan, p.period, p.amount, p.gateway, ${PAYMENT_STATUS_SQL} as status, p.ref_id, p.card, p.created_at, p.paid_at`;

interface PaymentRow {
  id: string;
  plan: string;
  period: string;
  amount: string;
  gateway: string;
  status: string;
  ref_id: string | null;
  card: string | null;
  created_at: Date;
  paid_at: Date | null;
}

function paymentOut(r: PaymentRow) {
  return {
    id: r.id,
    plan: r.plan,
    period: r.period,
    amount: Number(r.amount) / 10,
    gateway: r.gateway,
    status: r.status,
    refId: r.ref_id,
    card: r.card,
    createdAt: r.created_at.toISOString(),
    paidAt: r.paid_at?.toISOString() ?? null,
  };
}

/** متن جستجو برای نام (ی/ک عربی یکی، نویسه‌های LIKE بی‌اثر) و ارقام برای شمارهٔ موبایل. */
function searchTerm(q: string): { text: string; digits: string } {
  const t = q.trim().replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/‌/g, ' ');
  const digits = t.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/\D/g, '');
  return { text: t.replace(/[\\%_]/g, (c) => `\\${c}`), digits: digits.length >= 3 ? digits : '' };
}
