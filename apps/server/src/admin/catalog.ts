import { randomInt } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { withVendor, type Db, type Pool } from '../db';
import { forgetPublicCatalog, readCatalog, type FullCatalog } from '../billing/catalog';

// پلن‌ها و مدت‌های خرید از پنل فروشنده: ساختن، ویرایش، پنهان کردن، حذف (نرم، برگشت‌پذیر) و ترتیب.
// هر تغییر همان لحظه به برنامه (صفحهٔ خرید) و سایت معرفی می‌رسد؛ پرداخت‌های در راه مبلغ و مدت خودشان را دارند.

type Kind = 'plans' | 'terms';
const ID = { type: 'string', pattern: '^[a-z]{2,20}$' } as const;
const params = { params: { type: 'object', required: ['id'], properties: { id: ID } } } as const;
const obj = (props: Record<string, object>, required: string[]) => ({ type: 'object', additionalProperties: false, required, properties: props }) as const;

const PLAN_BODY = obj(
  {
    name: { type: 'string', minLength: 1, maxLength: 40 },
    blurb: { type: 'string', maxLength: 120 },
    seats: { type: 'integer', minimum: 1, maximum: 500 },
    monthly: { type: 'integer', minimum: 1000, maximum: 10_000_000_000 },
    extra: {
      anyOf: [
        { type: 'null' },
        obj({ monthly: { type: 'integer', minimum: 0, maximum: 10_000_000_000 }, max: { type: 'integer', minimum: 2, maximum: 500 } }, ['monthly', 'max']),
      ],
    },
    features: { type: 'array', maxItems: 10, items: { type: 'string', minLength: 1, maxLength: 120 } },
    badge: { anyOf: [{ type: 'null' }, { type: 'string', maxLength: 30 }] },
    hidden: { type: 'boolean' },
  },
  ['name', 'blurb', 'seats', 'monthly', 'extra', 'features', 'badge', 'hidden'],
);

const TERM_BODY = obj(
  {
    name: { type: 'string', minLength: 1, maxLength: 30 },
    months: { type: 'integer', minimum: 1, maximum: 36 },
    gift: { type: 'integer', minimum: 0, maximum: 24 },
    off: { type: 'integer', minimum: 0, maximum: 90 },
    hidden: { type: 'boolean' },
  },
  ['name', 'months', 'gift', 'off', 'hidden'],
);

interface PlanIn {
  name: string;
  blurb: string;
  seats: number;
  monthly: number;
  extra: { monthly: number; max: number } | null;
  features: string[];
  badge: string | null;
  hidden: boolean;
}

interface TermIn {
  name: string;
  months: number;
  gift: number;
  off: number;
  hidden: boolean;
}

export interface AdminCatalog extends FullCatalog {
  /** چند دفتر الان روی هر پلن‌اند. */
  offices: Record<string, number>;
}

/** دست‌کم یک پلن و یک مدت فروشی باید بماند؛ وگرنه صفحهٔ خرید و سایت خالی می‌شد. */
class LastOne extends Error {}

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
const newId = () => Array.from({ length: 10 }, () => LETTERS[randomInt(LETTERS.length)]).join('');

async function adminCatalog(db: Db): Promise<AdminCatalog> {
  const c = await readCatalog(db);
  const { rows } = await db.query<{ plan: string; n: number }>('select plan, count(*)::int as n from offices group by plan');
  return { ...c, offices: Object.fromEntries(rows.map((r) => [r.plan, r.n])) };
}

async function ensureForSale(db: Db) {
  const { rows } = await db.query<{ p: number; t: number }>(
    `select (select count(*) from plans where not hidden and deleted_at is null)::int as p,
            (select count(*) from terms where not hidden and deleted_at is null)::int as t`,
  );
  if (!rows[0]?.p || !rows[0]?.t) throw new LastOne();
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

function planValues(b: PlanIn): unknown[] | 'bad_name' | 'bad_extra' {
  const name = clean(b.name);
  if (!name) return 'bad_name';
  if (b.extra && b.extra.max <= b.seats) return 'bad_extra';
  const features = b.features.map(clean).filter(Boolean);
  const badge = b.badge ? clean(b.badge) || null : null;
  return [name, clean(b.blurb), b.seats, b.monthly, b.extra?.monthly ?? null, b.extra?.max ?? null, features, badge, b.hidden];
}

export function adminCatalogRoutes(app: FastifyInstance, pool: Pool, requireVendor: (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>) {
  /** یک تغییر در یک تراکنش؛ اگر چیزی برای فروش نماند همه‌اش برمی‌گردد. */
  const change = async (req: FastifyRequest, reply: FastifyReply, what: string, fn: (db: Db) => Promise<'ok' | 'not_found' | 'bad_name' | 'bad_extra'>) => {
    const r = await withVendor(pool, async (db) => {
      const done = await fn(db);
      if (done !== 'ok') return done;
      await ensureForSale(db);
      return adminCatalog(db);
    }).catch((e: unknown) => {
      if (e instanceof LastOne) return 'last' as const;
      throw e;
    });
    if (typeof r === 'string') return reply.status(r === 'not_found' ? 404 : r === 'last' ? 409 : 400).send({ error: r });
    forgetPublicCatalog();
    req.log.info({ admin: req.vendor!.id, what, id: (req.params as { id?: string } | undefined)?.id }, 'vendor changed catalog');
    return reply.send(r);
  };

  const nextSort = async (db: Db, kind: Kind) =>
    (await db.query<{ n: number }>(`select coalesce(max(sort), 0)::int + 1 as n from ${kind}`)).rows[0]!.n;
  const setDeleted = (kind: Kind, on: boolean) => async (db: Db, id: string) => {
    const r = await db.query(`update ${kind} set deleted_at = ${on ? 'now()' : 'null'} where id = $1 and (deleted_at is null) = $2`, [id, on]);
    return r.rowCount ? ('ok' as const) : ('not_found' as const);
  };

  app.get('/admin/catalog', { preHandler: requireVendor }, async () => withVendor(pool, adminCatalog));

  app.post('/admin/plans', { preHandler: requireVendor, schema: { body: PLAN_BODY } }, async (req, reply) =>
    change(req, reply, 'plan:add', async (db) => {
      const v = planValues(req.body as PlanIn);
      if (typeof v === 'string') return v;
      await db.query(
        `insert into plans (id, name, blurb, seats, monthly, extra_monthly, extra_max, features, badge, hidden, sort)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [newId(), ...v, await nextSort(db, 'plans')],
      );
      return 'ok';
    }),
  );

  app.post('/admin/plans/:id', { preHandler: requireVendor, schema: { ...params, body: PLAN_BODY } }, async (req, reply) =>
    change(req, reply, 'plan:edit', async (db) => {
      const v = planValues(req.body as PlanIn);
      if (typeof v === 'string') return v;
      const r = await db.query(
        `update plans set name = $2, blurb = $3, seats = $4, monthly = $5, extra_monthly = $6, extra_max = $7, features = $8, badge = $9, hidden = $10
          where id = $1 and deleted_at is null`,
        [(req.params as { id: string }).id, ...v],
      );
      return r.rowCount ? 'ok' : 'not_found';
    }),
  );

  app.post('/admin/terms', { preHandler: requireVendor, schema: { body: TERM_BODY } }, async (req, reply) =>
    change(req, reply, 'term:add', async (db) => {
      const b = req.body as TermIn;
      const name = clean(b.name);
      if (!name) return 'bad_name';
      await db.query('insert into terms (id, name, months, gift, off, hidden, sort) values ($1, $2, $3, $4, $5, $6, $7)', [
        newId(),
        name,
        b.months,
        b.gift,
        b.off,
        b.hidden,
        await nextSort(db, 'terms'),
      ]);
      return 'ok';
    }),
  );

  app.post('/admin/terms/:id', { preHandler: requireVendor, schema: { ...params, body: TERM_BODY } }, async (req, reply) =>
    change(req, reply, 'term:edit', async (db) => {
      const b = req.body as TermIn;
      const name = clean(b.name);
      if (!name) return 'bad_name';
      const r = await db.query('update terms set name = $2, months = $3, gift = $4, off = $5, hidden = $6 where id = $1 and deleted_at is null', [
        (req.params as { id: string }).id,
        name,
        b.months,
        b.gift,
        b.off,
        b.hidden,
      ]);
      return r.rowCount ? 'ok' : 'not_found';
    }),
  );

  for (const kind of ['plans', 'terms'] as const) {
    for (const [action, on] of [
      ['delete', true],
      ['restore', false],
    ] as const) {
      app.post(`/admin/${kind}/:id/${action}`, { preHandler: requireVendor, schema: params }, async (req, reply) =>
        change(req, reply, `${kind}:${action}`, (db) => setDeleted(kind, on)(db, (req.params as { id: string }).id)),
      );
    }
  }

  app.post(
    '/admin/catalog/order',
    {
      preHandler: requireVendor,
      schema: { body: obj({ kind: { type: 'string', enum: ['plans', 'terms'] }, ids: { type: 'array', minItems: 1, maxItems: 100, items: ID } }, ['kind', 'ids']) },
    },
    async (req, reply) =>
      change(req, reply, 'order', async (db) => {
        const { kind, ids } = req.body as { kind: Kind; ids: string[] };
        await db.query(`update ${kind} k set sort = o.n from unnest($1::text[]) with ordinality as o(id, n) where k.id = o.id`, [ids]);
        return 'ok';
      }),
  );
}
