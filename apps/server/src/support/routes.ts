import type { FastifyInstance, FastifyReply } from 'fastify';
import { withOffice, type Db, type Pool } from '../db';
import { authGuard } from '../auth/routes';
import { RateLimiter } from '../auth/rateLimit';

// پشتیبانی تیکتی از سمت دفتر: هر کس فقط تیکت‌های خودش را می‌بیند. با اشتراک تمام‌شده هم کار می‌کند
// (همان وقت است که کاربر بیشتر به پشتیبانی نیاز دارد) و همه‌چیز پشت RLS دفتر است.

const UUID_PATTERN = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
export const TOPICS = ['problem', 'question', 'billing', 'idea'] as const;
export const BODY_MAX = 4000;
export const SUBJECT_MAX = 120;

const idParams = { params: { type: 'object', required: ['id'], properties: { id: { type: 'string', pattern: UUID_PATTERN } } } } as const;

const newTicketSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'topic', 'subject', 'body'],
    properties: {
      id: { type: 'string', pattern: UUID_PATTERN },
      topic: { type: 'string', enum: TOPICS },
      subject: { type: 'string', minLength: 1, maxLength: SUBJECT_MAX },
      body: { type: 'string', minLength: 1, maxLength: BODY_MAX },
      page: { type: 'string', maxLength: 200 },
      appVersion: { type: 'string', maxLength: 40 },
      platform: { type: 'string', enum: ['', 'web', 'pwa', 'desktop'] },
    },
  },
} as const;

const messageSchema = {
  ...idParams,
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'body'],
    properties: { id: { type: 'string', pattern: UUID_PATTERN }, body: { type: 'string', minLength: 1, maxLength: BODY_MAX } },
  },
} as const;

interface TicketRow {
  id: string;
  topic: string;
  subject: string;
  status: string;
  unread: boolean;
  created_at: Date;
  updated_at: Date;
  last_body: string;
  last_from: 'user' | 'support';
}

interface MessageRow {
  id: string;
  body: string;
  from: 'user' | 'support';
  created_at: Date;
}

export const ticketOut = (r: TicketRow) => ({
  id: r.id,
  topic: r.topic,
  subject: r.subject,
  status: r.status,
  unread: r.unread,
  createdAt: r.created_at.toISOString(),
  updatedAt: r.updated_at.toISOString(),
  last: { body: r.last_body.slice(0, 160), from: r.last_from },
});

export const messageOut = (r: MessageRow) => ({ id: r.id, body: r.body, from: r.from, createdAt: r.created_at.toISOString() });

// آخرین پیام هر تیکت برای پیش‌نمایش در فهرست.
const LAST = `(select m.body from support_messages m where m.office_id = t.office_id and m.ticket_id = t.id order by m.created_at desc limit 1) as last_body,
  (select case when m.admin_id is null then 'user' else 'support' end from support_messages m
    where m.office_id = t.office_id and m.ticket_id = t.id order by m.created_at desc limit 1) as last_from`;

async function detail(db: Db, user: string, id: string) {
  const t = await db.query<TicketRow>(`select t.*, ${LAST} from support_tickets t where t.id = $1 and t.user_id = $2`, [id, user]);
  if (!t.rows[0]) return null;
  const m = await db.query<MessageRow>(
    `select id, body, case when admin_id is null then 'user' else 'support' end as "from", created_at
       from support_messages where ticket_id = $1 order by created_at, id`,
    [id],
  );
  return { ticket: ticketOut(t.rows[0]), messages: m.rows.map(messageOut) };
}

export async function supportRoutes(app: FastifyInstance, { pool, jwtSecret }: { pool: Pool; jwtSecret: string }) {
  const requireAuth = authGuard(pool, jwtSecret);
  const ticketsByUser = new RateLimiter(10, 60 * 60_000);
  const messagesByUser = new RateLimiter(40, 60 * 60_000);
  const limited = (reply: FastifyReply, retryAfter: number) =>
    reply.status(429).header('retry-after', String(retryAfter)).send({ error: 'too_many', retryAfter });

  app.get('/support/tickets', { preHandler: requireAuth }, async (req) => {
    const { off, sub } = req.auth!;
    return withOffice(pool, off, async (db) => {
      const { rows } = await db.query<TicketRow>(`select t.*, ${LAST} from support_tickets t where t.user_id = $1 order by t.updated_at desc limit 200`, [sub]);
      return { tickets: rows.map(ticketOut) };
    });
  });

  // برای نشانِ کنار «پشتیبانی»: سبک، تا با هر باز شدن برنامه و هر خبر زنده خوانده شود.
  app.get('/support/unread', { preHandler: requireAuth }, async (req) => {
    const { off, sub } = req.auth!;
    const n = await withOffice(pool, off, (db) =>
      db.query<{ n: number }>('select count(*)::int as n from support_tickets where user_id = $1 and unread', [sub]),
    );
    return { unread: n.rows[0]!.n };
  });

  app.post('/support/tickets', { preHandler: requireAuth, schema: newTicketSchema }, async (req, reply) => {
    const { off, sub } = req.auth!;
    const b = req.body as { id: string; topic: string; subject: string; body: string; page?: string; appVersion?: string; platform?: string };
    const subject = b.subject.trim().replace(/\s+/g, ' ');
    const text = b.body.trim();
    if (!subject || !text) return reply.status(400).send({ error: 'empty' });
    const out = await withOffice(pool, off, async (db) => {
      // شناسه را دستگاه می‌سازد؛ پاسخِ گم‌شده و دوباره فرستادن، تیکت تکراری نمی‌سازد (و از سهمیه هم کم نمی‌کند).
      const had = await detail(db, sub, b.id);
      if (had) return had;
      const wait = ticketsByUser.take(sub);
      if (wait) return wait;
      await db.query(`insert into support_tickets (id, user_id, topic, subject, page, app_version, platform) values ($1, $2, $3, $4, $5, $6, $7)`, [
        b.id,
        sub,
        b.topic,
        subject,
        b.page ?? '',
        b.appVersion ?? '',
        b.platform ?? '',
      ]);
      await db.query('insert into support_messages (id, ticket_id, user_id, body) values ($1, $1, $2, $3)', [b.id, sub, text]);
      return detail(db, sub, b.id);
    });
    if (typeof out === 'number') return limited(reply, out);
    return reply.status(201).send(out);
  });

  app.get('/support/tickets/:id', { preHandler: requireAuth, schema: idParams }, async (req, reply) => {
    const { off, sub } = req.auth!;
    const { id } = req.params as { id: string };
    const out = await withOffice(pool, off, async (db) => {
      // باز کردن تیکت یعنی پاسخ دیده شد.
      await db.query('update support_tickets set unread = false where id = $1 and user_id = $2 and unread', [id, sub]);
      return detail(db, sub, id);
    });
    if (!out) return reply.status(404).send({ error: 'not_found' });
    return out;
  });

  app.post('/support/tickets/:id/messages', { preHandler: requireAuth, schema: messageSchema }, async (req, reply) => {
    const { off, sub } = req.auth!;
    const { id } = req.params as { id: string };
    const b = req.body as { id: string; body: string };
    const text = b.body.trim();
    if (!text) return reply.status(400).send({ error: 'empty' });
    const out = await withOffice(pool, off, async (db) => {
      const own = await db.query<{ status: string }>('select status from support_tickets where id = $1 and user_id = $2 for update', [id, sub]);
      if (!own.rows[0]) return null;
      const dup = await db.query('select 1 from support_messages where id = $1', [b.id]);
      if (!dup.rowCount) {
        // بسته یعنی مشکل حل شد؛ کاربر دوباره بازش نمی‌کند و برای موضوع تازه تیکت تازه می‌زند.
        if (own.rows[0].status === 'closed') return 'closed' as const;
        const wait = messagesByUser.take(sub);
        if (wait) return wait;
        await db.query('insert into support_messages (id, ticket_id, user_id, body) values ($1, $2, $3, $4)', [b.id, id, sub, text]);
        await db.query("update support_tickets set status = 'open', unread = false, updated_at = now() where id = $1", [id]);
      }
      return detail(db, sub, id);
    });
    if (typeof out === 'number') return limited(reply, out);
    if (out === 'closed') return reply.status(409).send({ error: 'closed' });
    if (!out) return reply.status(404).send({ error: 'not_found' });
    return out;
  });

  app.post('/support/tickets/:id/close', { preHandler: requireAuth, schema: idParams }, async (req, reply) => {
    const { off, sub } = req.auth!;
    const { id } = req.params as { id: string };
    const out = await withOffice(pool, off, async (db) => {
      await db.query("update support_tickets set status = 'closed', unread = false, updated_at = now() where id = $1 and user_id = $2 and status <> 'closed'", [
        id,
        sub,
      ]);
      return detail(db, sub, id);
    });
    if (!out) return reply.status(404).send({ error: 'not_found' });
    return out;
  });
}
