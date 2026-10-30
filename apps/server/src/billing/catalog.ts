import type { FastifyInstance } from 'fastify';
import { forSale, TRIAL_DAYS, type Catalog, type Plan, type Term } from '@kelid/core/plans';
import type { Pool, Queryable } from '../db';

/** پلن یا مدتی که از پنل حذف شده؛ فقط برای نام پرداخت‌ها و دفترهای قدیمی. */
export type Listed<T> = T & { deleted?: boolean };
export interface FullCatalog {
  plans: Listed<Plan>[];
  terms: Listed<Term>[];
}

interface PlanRow {
  id: string;
  name: string;
  blurb: string;
  seats: number;
  monthly: string;
  extra_monthly: string | null;
  extra_max: number | null;
  features: string[];
  badge: string | null;
  hidden: boolean;
  deleted: boolean;
}

interface TermRow {
  id: string;
  name: string;
  months: number;
  gift: number;
  off: number;
  hidden: boolean;
  deleted: boolean;
}

function planOut(r: PlanRow): Listed<Plan> {
  return {
    id: r.id,
    name: r.name,
    blurb: r.blurb,
    seats: r.seats,
    monthly: Number(r.monthly),
    ...(r.extra_max !== null && r.extra_monthly !== null ? { extra: { monthly: Number(r.extra_monthly), max: r.extra_max } } : {}),
    features: r.features,
    ...(r.badge ? { badge: r.badge } : {}),
    ...(r.hidden ? { hidden: true } : {}),
    ...(r.deleted ? { deleted: true } : {}),
  };
}

function termOut(r: TermRow): Listed<Term> {
  return {
    id: r.id,
    name: r.name,
    months: r.months,
    gift: r.gift,
    off: r.off,
    ...(r.hidden ? { hidden: true } : {}),
    ...(r.deleted ? { deleted: true } : {}),
  };
}

/** همهٔ پلن‌ها و مدت‌ها به ترتیب پنل، حذف‌شده‌ها هم (با deleted)؛ هر دو جدول برای همه خواندنی است. */
export async function readCatalog(db: Queryable): Promise<FullCatalog> {
  const [p, t] = await Promise.all([
    db.query<PlanRow>(
      `select id, name, blurb, seats, monthly, extra_monthly, extra_max, features, badge, hidden, deleted_at is not null as deleted
         from plans order by deleted_at is not null, sort, created_at`,
    ),
    db.query<TermRow>(
      'select id, name, months, gift, off, hidden, deleted_at is not null as deleted from terms order by deleted_at is not null, sort, created_at',
    ),
  ]);
  return { plans: p.rows.map(planOut), terms: t.rows.map(termOut) };
}

/** فهرست بی حذف‌شده‌ها؛ پنهان‌ها با پرچم hidden می‌مانند. */
export function live(c: FullCatalog): Catalog {
  return { plans: c.plans.filter((p) => !p.deleted), terms: c.terms.filter((t) => !t.deleted) };
}

// سایت معرفی با هر بازدید فهرست را می‌خواهد؛ هر پردازه چند ثانیه نگهش می‌دارد تا دیتابیس با بازدیدها شلوغ نشود.
const PUBLIC_TTL_MS = 30_000;
let cached: { at: number; body: PublicCatalog } | null = null;

export interface PublicCatalog extends Catalog {
  trialDays: number;
}

/** پنل فروشنده بعد از هر تغییر صدا می‌زند تا همین پردازه فهرست تازه را بدهد. */
export function forgetPublicCatalog() {
  cached = null;
}

/**
 * GET /plans: پلن‌ها و مدت‌های فروشی برای سایت معرفی و صفحهٔ خرید. داده عمومی است، پس هر مبدأیی می‌خواندش
 * (سایت kelid.ir در فهرست CORS برنامه نیست).
 */
export async function catalogRoutes(app: FastifyInstance, { pool }: { pool: Pool }) {
  app.get('/plans', async (_req, reply) => {
    if (!cached || Date.now() - cached.at > PUBLIC_TTL_MS) {
      const c = forSale(live(await readCatalog(pool)));
      cached = { at: Date.now(), body: { ...c, trialDays: TRIAL_DAYS } };
    }
    return reply.header('access-control-allow-origin', '*').header('cache-control', 'public, max-age=60').send(cached.body);
  });
}
