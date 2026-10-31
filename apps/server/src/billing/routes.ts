import { randomUUID, type KeyObject } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { formatDate, formatGrouped } from '@kelid/core/format';
import { toFaDigits } from '@kelid/core/persian';
import { CATALOG_ID, forSale, nextExpiry, priceOf, seatsFor, termDays, type Period, type PlanId } from '@kelid/core/plans';
import { authGuard } from '../auth/routes';
import { RateLimiter } from '../auth/rateLimit';
import { withOffice, type Db, type Pool } from '../db';
import type { PaymentGateway } from './gateway';
import { FONT_PATH, fontFile, page } from './pages';
import { live, readCatalog, type FullCatalog } from './catalog';
import { licenseOf, readSubscription } from './subscription';

export interface BillingOptions {
  pool: Pool;
  jwtSecret: string;
  licenseKey: KeyObject;
  /** null = درگاهی تنظیم نشده؛ پرداخت خاموش است ولی وضعیت اشتراک کار می‌کند. */
  gateway: PaymentGateway | null;
  /** نشانی عمومی همین سرور، برای برگشت از درگاه. */
  publicUrl: string;
  /** مبدأهای برنامهٔ وب (CORS_ORIGINS)؛ بعد از درگاه فقط به یکی از این‌ها برگردانده می‌شود. */
  appOrigins?: string[];
}

type Status = 'pending' | 'paid' | 'failed' | 'canceled';

export interface Receipt {
  id: string;
  plan: PlanId;
  period: Period;
  /** نام پلن و مدت از فهرست سرور، حتی اگر بعداً از پنل حذف شده باشند. */
  planName: string;
  termName: string;
  /** نفرات خریده‌شده. */
  seats: number;
  /** تومان */
  amount: number;
  status: Status;
  refId: string | null;
  card: string | null;
  createdAt: string;
  paidAt: string | null;
  /** پایان اشتراک بعد از همین پرداخت. */
  expiresAt: string | null;
}

const PENDING_MINUTES = 30;
const idParam = { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } } as const;
const callbackQuery = {
  type: 'object',
  required: ['o', 'p'],
  properties: {
    o: { type: 'string', format: 'uuid' },
    p: { type: 'string', format: 'uuid' },
    Authority: { type: 'string', maxLength: 64 },
    Status: { type: 'string', maxLength: 10 },
    b: { type: 'string', maxLength: 200 },
  },
} as const;

/**
 * اشتراک و پرداخت. دفتر پلن را انتخاب می‌کند ← سرور مبلغ را از فهرست خودش حساب می‌کند (نه از برنامه) ← درگاه ←
 * برگشت به /billing/callback ← تأیید با خود درگاه ← تمدید. پرداختِ تأییدنشده هیچ اثری ندارد، برگشت تکراری هم دوبار تمدید نمی‌کند.
 */
export async function billingRoutes(app: FastifyInstance, o: BillingOptions) {
  const { pool, gateway, licenseKey } = o;
  const requireAuth = authGuard(pool, o.jwtSecret);
  const checkoutsByOffice = new RateLimiter(20, 60 * 60_000);
  const appOrigins = new Set((o.appOrigins ?? []).filter((x) => x !== 'null'));
  // b = برنامهٔ وبی که کاربر از آن آمده؛ نسخهٔ ویندوز آن را نمی‌فرستد چون درگاه در مرورگر سیستم باز می‌شود و برگشتی ندارد.
  const callbackUrl = (office: string, id: string, back?: string | null) =>
    `${o.publicUrl}/billing/callback?o=${office}&p=${id}${back ? `&b=${encodeURIComponent(back)}` : ''}`;
  // نشانی برگشت از خود درخواست می‌آید؛ فقط مبدأهای فهرست‌شده، وگرنه این صفحه کاربر را به هر سایتی می‌فرستاد.
  const backTo = (b: string | undefined) => (b && appOrigins.has(b) ? b : null);

  app.get(FONT_PATH, async (_req, reply) => {
    const f = await fontFile();
    if (!f) return reply.status(404).send({ error: 'not_found' });
    return reply.header('content-type', 'font/woff2').send(f);
  });

  const managerOnly = async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.member?.role !== 'manager') return reply.status(403).send({ error: 'forbidden' });
  };

  app.get('/billing', { preHandler: requireAuth }, async (req) => {
    const off = req.auth!.off;
    const r = await withOffice(pool, off, async (db) => {
      const sub = await readSubscription(db, off);
      const pays = await db.query<PaymentRow>(`select ${PAYMENT_COLS} from payments where status = 'paid' order by paid_at desc limit 24`);
      const cat = await readCatalog(db);
      return { sub, cat, used: await seatsUsed(db, off), payments: pays.rows.map((p) => receipt(p, cat)) };
    });
    if (!r.sub) throw new Error('office row missing');
    // فهرست فروشی، و پلن خود دفتر حتی اگر دیگر فروخته نشود (صفحهٔ «اشتراک دفتر شما» نامش را می‌خواهد).
    const sale = forSale(live(r.cat));
    const mine = sale.plans.some((p) => p.id === r.sub!.plan) ? undefined : r.cat.plans.find((p) => p.id === r.sub!.plan);
    return {
      plan: r.sub.plan,
      trial: r.sub.trial,
      expiresAt: r.sub.expiresAt.toISOString(),
      seats: r.sub.seats,
      suspended: r.sub.suspended,
      used: r.used,
      plans: mine ? [...sale.plans, { ...mine, deleted: undefined, hidden: true }] : sale.plans,
      terms: sale.terms,
      canPay: !!gateway,
      payments: r.payments,
      license: licenseOf(licenseKey, off, r.sub),
    };
  });

  app.post(
    '/billing/checkout',
    {
      preHandler: [requireAuth, managerOnly],
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['plan', 'period'],
          properties: {
            plan: { type: 'string', pattern: CATALOG_ID.source },
            period: { type: 'string', pattern: CATALOG_ID.source },
            seats: { type: 'integer', minimum: 1, maximum: 500 },
            back: { type: 'string', maxLength: 200 },
          },
        },
      },
    },
    async (req, reply) => {
      if (!gateway) return reply.status(503).send({ error: 'no_gateway' });
      const body = req.body as { plan: PlanId; period: Period; seats?: number; back?: string };
      const { off, sub } = req.auth!;
      const wait = checkoutsByOffice.take(off);
      if (wait) return reply.status(429).header('retry-after', String(wait)).send({ error: 'too_many', retryAfter: wait });
      // فقط پلن و مدتی که الان فروشی است؛ برنامه‌ای که فهرست کهنه دارد دوباره می‌خواند.
      const sale = forSale(live(await readCatalog(pool)));
      const plan = sale.plans.find((p) => p.id === body.plan);
      const term = sale.terms.find((t) => t.id === body.period);
      if (!plan || !term) return reply.status(409).send({ error: 'not_for_sale' });
      const seats = seatsFor(plan, body.seats);
      // مبلغ فقط از فهرست سرور؛ برنامه هیچ عددی نمی‌فرستد. درگاه ریال می‌گیرد.
      const amount = priceOf(plan, term, seats) * 10;
      if (amount <= 0) return reply.status(409).send({ error: 'not_for_sale' });
      const id = randomUUID();
      const made = await withOffice(pool, off, async (db) => {
        // دفتر معلق تا تصمیم پشتیبانی پرداختی نمی‌کند.
        if ((await readSubscription(db, off))?.suspended) return 'suspended' as const;
        // پلنی که جای همکاران فعلی را ندارد خریدنی نیست؛ اول باید کسی برداشته شود.
        if (seats < (await seatsUsed(db, off))) return null;
        await db.query('insert into payments (id, plan, period, seats, amount, days, gateway, created_by) values ($1, $2, $3, $4, $5, $6, $7, $8)', [
          id,
          plan.id,
          term.id,
          seats,
          amount,
          termDays(term),
          gateway.name,
          sub,
        ]);
        const u = await db.query<{ phone: string }>('select phone from users where id = $1', [sub]);
        return { phone: u.rows[0]?.phone };
      });
      if (made === 'suspended') return reply.status(403).send({ error: 'suspended' });
      if (!made) return reply.status(409).send({ error: 'too_small' });

      // درخواست به درگاه بیرون از تراکنش؛ درگاه کند نباید اتصال دیتابیس را نگه دارد.
      let started: { authority: string; payUrl: string };
      try {
        started = await gateway.request({
          amount,
          description: `اشتراک کلید، پلن ${plan.name}${seats > plan.seats ? ` برای ${seats} نفر` : ''} (${term.name})`,
          callbackUrl: callbackUrl(off, id, backTo(body.back)),
          mobile: made.phone,
        });
      } catch (e) {
        req.log.error({ err: e }, 'payment gateway request failed');
        await withOffice(pool, off, (db) => db.query("update payments set status = 'failed' where id = $1", [id]));
        return reply.status(502).send({ error: 'gateway' });
      }
      await withOffice(pool, off, (db) => db.query('update payments set authority = $2 where id = $1', [id, started.authority]));
      return { id, payUrl: started.payUrl };
    },
  );

  /** برنامه بعد از فرستادن کاربر به درگاه این را می‌پرسد تا همان لحظهٔ پرداخت خبردار شود. */
  app.get('/billing/payments/:id', { preHandler: requireAuth, schema: { params: idParam } }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const off = req.auth!.off;
    const r = await withOffice(pool, off, async (db) => {
      const p = await db.query<PaymentRow>(`select ${PAYMENT_COLS} from payments where id = $1`, [id]);
      const row = p.rows[0];
      return row ? { receipt: receipt(row, await readCatalog(db)), sub: row.status === 'paid' ? await readSubscription(db, off) : null } : null;
    });
    if (!r) return reply.status(404).send({ error: 'not_found' });
    return { ...r.receipt, license: r.sub ? licenseOf(licenseKey, off, r.sub) : null };
  });

  /** درگاه کاربر را این‌جا برمی‌گرداند. فقط خبر است: پرداخت با verify خود درگاه ثابت می‌شود. */
  app.get('/billing/callback', { schema: { querystring: callbackQuery } }, async (req, reply) => {
    const q = req.query as { o: string; p: string; Authority?: string; Status?: string; b?: string };
    const html = (status: number, body: string) => reply.status(status).header('content-type', 'text/html; charset=utf-8').send(body);
    // وب: کاربر در همان برگه به درگاه رفته و برمی‌گردد به صفحهٔ اشتراک؛ آن‌جا خودش رسید را از سرور می‌گیرد.
    // ویندوز: درگاه در مرورگر سیستم باز شده و کلید سر جایش منتظر است؛ پیوند «برگشت» یک کلید دوم باز می‌کرد.
    const back = backTo(q.b);
    const home = back ? `${back}/#/plans?pay=${q.p}` : null;
    const homeAction = home ? [{ label: 'بازگشت به کلید', href: home, primary: true }] : [];
    const closeNote = home ? undefined : 'این صفحه را ببندید و به برنامهٔ کلید برگردید؛ اشتراک همان‌جا خودکار به‌روز می‌شود.';
    const refund = 'اگر مبلغی از حسابتان کم شده، بانک تا ۷۲ ساعت خودکار برمی‌گرداند.';

    const row = await withOffice(
      pool,
      q.o,
      async (db) => (await db.query<PaymentRow>(`select ${PAYMENT_COLS}, authority from payments where id = $1`, [q.p])).rows[0],
    );
    // شناسهٔ درگاه باید همان باشد که خودمان گرفته‌ایم؛ وگرنه کسی با نشانی ساختگی به پرداخت دیگری دست می‌زند.
    if (!row || !row.authority || row.authority !== q.Authority) {
      return html(
        404,
        page({ tone: 'bad', title: 'پرداخت پیدا نشد', lines: ['این نشانی پرداخت معتبر نیست.', refund], actions: homeAction, note: closeNote }),
      );
    }

    let status = row.status as Status;
    if (status === 'pending') {
      if (q.Status !== 'OK') {
        await withOffice(pool, q.o, (db) => db.query("update payments set status = 'canceled' where id = $1 and status = 'pending'", [q.p]));
        status = 'canceled';
      } else {
        let verified: Awaited<ReturnType<PaymentGateway['verify']>>;
        try {
          verified = gateway && gateway.name === row.gateway ? await gateway.verify({ authority: row.authority, amount: Number(row.amount) }) : { ok: false };
        } catch (e) {
          // درگاه جواب نداد: پرداخت در انتظار می‌ماند و همین صفحه چند ثانیه بعد خودش دوباره می‌سنجد.
          req.log.error({ err: e, payment: q.p }, 'payment verify failed');
          return html(
            503,
            page({
              tone: 'wait',
              title: 'در حال بررسی پرداخت',
              lines: ['پاسخ بانک هنوز نرسیده است.', 'این صفحه را نبندید؛ چند ثانیهٔ دیگر خودش دوباره بررسی می‌کند.'],
              refresh: { seconds: 8, text: 'بررسی دوباره…' },
            }),
          );
        }
        status = verified.ok ? await applyPayment(q.o, q.p, verified.refId, verified.card) : await markFailed(q.o, q.p);
      }
    }

    const r = await withOffice(pool, q.o, async (db) =>
      receipt((await db.query<PaymentRow>(`select ${PAYMENT_COLS} from payments where id = $1`, [q.p])).rows[0]!, await readCatalog(db)),
    );
    if (status === 'paid') {
      return html(
        200,
        page({
          tone: 'ok',
          title: 'پرداخت انجام شد',
          lines: [`اشتراک پلن ${r.planName} تا ${formatDate(new Date(r.expiresAt!))} فعال است.`],
          rows: [
            ['مبلغ', `${formatGrouped(r.amount)} تومان`],
            ['کد پیگیری', toFaDigits(r.refId ?? '')],
            ...(r.card ? ([['کارت', toFaDigits(r.card)]] as [string, string][]) : []),
          ],
          actions: homeAction,
          refresh: home ? { seconds: 6, url: home, text: 'چند ثانیهٔ دیگر خودکار به کلید برمی‌گردید.' } : undefined,
          note: closeNote,
        }),
      );
    }
    return html(
      200,
      page({
        tone: 'bad',
        title: status === 'canceled' ? 'پرداخت لغو شد' : 'پرداخت انجام نشد',
        lines: ['اشتراک تغییری نکرد.', refund],
        actions: home ? [{ label: 'بازگشت به کلید', href: home, primary: true }] : [],
        note: closeNote,
      }),
    );
  });

  // درگاه آزمایشی سرور محلی: به جای بانک، همین صفحه «پرداخت» یا «انصراف» را می‌پرسد.
  if (gateway?.name === 'dev') {
    app.get('/billing/dev-pay', { schema: { querystring: callbackQuery } }, async (req, reply) => {
      const q = req.query as { o: string; p: string; Authority?: string; b?: string };
      const row = await withOffice(
        pool,
        q.o,
        async (db) => (await db.query<PaymentRow>(`select ${PAYMENT_COLS}, authority from payments where id = $1`, [q.p])).rows[0],
      );
      const html = (status: number, body: string) => reply.status(status).header('content-type', 'text/html; charset=utf-8').send(body);
      if (!row || !row.authority || row.authority !== q.Authority || row.status !== 'pending')
        return html(404, page({ tone: 'bad', title: 'پرداخت پیدا نشد', lines: ['این پرداخت دیگر در انتظار نیست.'], dev: true }));
      const r = receipt(row, await readCatalog(pool));
      const back = `${callbackUrl(q.o, q.p, backTo(q.b))}&Authority=${encodeURIComponent(row.authority)}`;
      return html(
        200,
        page({
          tone: 'info',
          title: 'درگاه آزمایشی',
          lines: [`پلن ${r.planName}، ${r.termName}`, 'این صفحه فقط روی سرور توسعه است و پولی جابه‌جا نمی‌شود.'],
          rows: [['مبلغ', `${formatGrouped(Number(row.amount) / 10)} تومان`]],
          actions: [
            { label: 'پرداخت موفق', href: `${back}&Status=OK`, primary: true },
            { label: 'انصراف از پرداخت', href: `${back}&Status=NOK` },
          ],
          dev: true,
        }),
      );
    });
  }

  async function applyPayment(office: string, id: string, refId: string, card: string | null): Promise<Status> {
    return withOffice(pool, office, async (db) => {
      const p = await db.query<{ status: Status; plan: string; period: Period; seats: number | null; days: number | null }>(
        'select status, plan, period, seats, days from payments where id = $1 for update',
        [id],
      );
      const row = p.rows[0]!;
      // برگشت هم‌زمان یا تکراری: فقط بار اول تمدید می‌کند.
      if (row.status !== 'pending') return row.status;
      const cur = await db.query<{ plan: string; trial: boolean; expires_at: Date; seats: number }>(
        'select plan, trial, expires_at, seats from offices where id = $1 for update',
        [office],
      );
      const c = cur.rows[0]!;
      // پلن و مدت همان لحظهٔ خرید؛ پنل حذفشان کند هم ردیفشان هست. پرداخت‌های پیش از days مدت را از فهرست می‌گیرند.
      const cat = await readCatalog(db);
      const plan = cat.plans.find((x) => x.id === row.plan)!;
      const term = cat.terms.find((x) => x.id === row.period);
      const days = row.days ?? (term ? termDays(term) : 30);
      const seats = seatsFor(plan, row.seats ?? undefined);
      const was = { plan: c.plan, trial: c.trial, expiresAt: c.expires_at.toISOString(), seats: c.seats };
      const until = new Date(nextExpiry(was, cat.plans.find((x) => x.id === c.plan), plan, days, Date.now(), seats));
      await db.query('update offices set plan = $2, trial = false, seats = $3, expires_at = $4 where id = $1', [office, plan.id, seats, until]);
      await db.query("update payments set status = 'paid', ref_id = $2, card = $3, paid_at = now(), expires_at = $4 where id = $1", [id, refId, card, until]);
      return 'paid';
    });
  }

  async function markFailed(office: string, id: string): Promise<Status> {
    return withOffice(pool, office, async (db) => {
      const r = await db.query<{ status: Status }>("update payments set status = 'failed' where id = $1 and status = 'pending' returning status", [id]);
      return r.rows[0]?.status ?? 'failed';
    });
  }
}

/** همکاران و دعوت‌های باز؛ users و invites جدول‌های سراسری‌اند و فقط با office_id خود دفتر خوانده می‌شوند. */
export async function seatsUsed(db: Db, officeId: string): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    'select ((select count(*) from users where office_id = $1 and removed_at is null) + (select count(*) from invites where office_id = $1))::int as n',
    [officeId],
  );
  return rows[0]?.n ?? 0;
}

interface PaymentRow {
  id: string;
  plan: string;
  period: Period;
  seats: number | null;
  amount: string;
  status: Status;
  ref_id: string | null;
  card: string | null;
  created_at: Date;
  paid_at: Date | null;
  expires_at: Date | null;
  gateway: string;
  authority?: string | null;
}
const PAYMENT_COLS = 'id, plan, period, seats, amount, status, ref_id, card, created_at, paid_at, expires_at, gateway';

function receipt(r: PaymentRow, cat: FullCatalog): Receipt {
  // پرداختی که نیم ساعت در انتظار مانده یعنی کاربر درگاه را رها کرده است.
  const stale = r.status === 'pending' && Date.now() - r.created_at.getTime() > PENDING_MINUTES * 60_000;
  const plan = cat.plans.find((p) => p.id === r.plan);
  return {
    id: r.id,
    plan: r.plan,
    period: r.period,
    planName: plan?.name ?? r.plan,
    termName: cat.terms.find((t) => t.id === r.period)?.name ?? r.period,
    seats: r.seats ?? plan?.seats ?? 1,
    amount: Number(r.amount) / 10,
    status: stale ? 'canceled' : r.status,
    refId: r.ref_id,
    card: r.card,
    createdAt: r.created_at.toISOString(),
    paidAt: r.paid_at?.toISOString() ?? null,
    expiresAt: r.expires_at?.toISOString() ?? null,
  };
}
