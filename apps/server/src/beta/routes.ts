import { createHash } from 'node:crypto';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { withOffice, type Pool } from '../db';
import { authGuard } from '../auth/routes';
import { RateLimiter } from '../auth/rateLimit';

// ابزار بتا از سمت دفتر: نظر کاربر و خطاهای برنامه. هر دو با اشتراک تمام‌شده هم پذیرفته می‌شوند
// (همان وقت است که کاربر بیشتر حرف دارد) و هر دو پشت RLS دفترند.

const PLATFORMS = ['', 'web', 'pwa', 'desktop'];
const UUID_PATTERN = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
const where = {
  page: { type: 'string', maxLength: 200 },
  appVersion: { type: 'string', maxLength: 40 },
  platform: { type: 'string', enum: PLATFORMS },
} as const;

const feedbackSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'kind', 'body'],
    properties: {
      id: { type: 'string', pattern: UUID_PATTERN },
      kind: { type: 'string', enum: ['problem', 'idea', 'praise'] },
      body: { type: 'string', minLength: 1, maxLength: 2000 },
      ...where,
    },
  },
} as const;

const errorsSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['errors'],
    properties: {
      errors: {
        type: 'array',
        minItems: 1,
        maxItems: 10,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['message'],
          properties: {
            message: { type: 'string', minLength: 1, maxLength: 2000 },
            stack: { type: 'string', maxLength: 20_000 },
            count: { type: 'integer', minimum: 1, maximum: 1000 },
            ...where,
          },
        },
      },
    },
  },
} as const;

interface ErrorIn {
  message: string;
  stack?: string;
  count?: number;
  page?: string;
  appVersion?: string;
  platform?: string;
}

/**
 * اثرانگشت خطا: پیام بی‌عدد و اولین سطر stack بی شمارهٔ خط و بی hash فایل‌های ساخته‌شده،
 * تا یک باگ در نسخه‌ها و دستگاه‌های مختلف یک ردیف بماند.
 */
export function errorFingerprint(message: string, stack = ''): string {
  const msg = message.trim().replace(/\d+/g, '0').slice(0, 300);
  const frame =
    stack
      .split('\n')
      .map((l) => l.trim())
      .find((l) => /^at |@/.test(l)) ?? '';
  const where = frame
    .replace(/https?:\/\/[^/\s)]+/g, '')
    .replace(/[-.][A-Za-z0-9_]{8,}\.js/g, '.js')
    .replace(/(:\d+)+\)?$/, '')
    .replace(/\?[^\s):]*/g, '');
  return createHash('sha256').update(`${msg}\n${where}`).digest('hex').slice(0, 16);
}

export async function betaRoutes(app: FastifyInstance, { pool, jwtSecret }: { pool: Pool; jwtSecret: string }) {
  const requireAuth = authGuard(pool, jwtSecret);
  const feedbackByUser = new RateLimiter(10, 60 * 60_000);
  const errorsByDevice = new RateLimiter(30, 10 * 60_000);
  const limited = (reply: FastifyReply, retryAfter: number) =>
    reply.status(429).header('retry-after', String(retryAfter)).send({ error: 'too_many', retryAfter });

  app.post('/beta/feedback', { preHandler: requireAuth, schema: feedbackSchema }, async (req, reply) => {
    const { off, sub } = req.auth!;
    const wait = feedbackByUser.take(sub);
    if (wait) return limited(reply, wait);
    const b = req.body as { id: string; kind: string; body: string; page?: string; appVersion?: string; platform?: string };
    const text = b.body.trim();
    if (!text) return reply.status(400).send({ error: 'empty' });
    // شناسه را دستگاه می‌سازد؛ پاسخِ گم‌شده و دوباره فرستادن، نظر تکراری نمی‌سازد.
    await withOffice(pool, off, (db) =>
      db.query(
        `insert into feedback (id, user_id, kind, body, page, app_version, platform) values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (office_id, id) do nothing`,
        [b.id, sub, b.kind, text, b.page ?? '', b.appVersion ?? '', b.platform ?? ''],
      ),
    );
    return reply.status(204).send();
  });

  app.post('/beta/errors', { preHandler: requireAuth, schema: errorsSchema }, async (req, reply) => {
    const { off, dev } = req.auth!;
    const wait = errorsByDevice.take(dev);
    if (wait) return limited(reply, wait);
    // یک اثرانگشت در یک درخواست فقط یک ردیف (upsert نمی‌تواند یک ردیف را دو بار عوض کند).
    const rows = new Map<string, { fingerprint: string; message: string; stack: string; page: string; app_version: string; platform: string; count: number }>();
    for (const e of (req.body as { errors: ErrorIn[] }).errors) {
      const fingerprint = errorFingerprint(e.message, e.stack);
      const count = (rows.get(fingerprint)?.count ?? 0) + (e.count ?? 1);
      rows.set(fingerprint, {
        fingerprint,
        message: e.message.trim().slice(0, 500) || '?',
        stack: (e.stack ?? '').slice(0, 4000),
        page: e.page ?? '',
        app_version: e.appVersion ?? '',
        platform: e.platform ?? '',
        count,
      });
    }
    // خطای «رسیدگی‌شده» که دوباره آمد، دوباره باز می‌شود.
    await withOffice(pool, off, (db) =>
      db.query(
        `insert into client_errors (fingerprint, message, stack, page, app_version, platform, count)
         select fingerprint, message, stack, page, app_version, platform, count from jsonb_to_recordset($1::jsonb)
           as x(fingerprint text, message text, stack text, page text, app_version text, platform text, count int)
         on conflict (office_id, fingerprint) do update set
           count = least(client_errors.count::bigint + excluded.count, 2000000000)::int, last_seen = now(), resolved_at = null,
           message = excluded.message, stack = excluded.stack, page = excluded.page,
           app_version = excluded.app_version, platform = excluded.platform`,
        [JSON.stringify([...rows.values()])],
      ),
    );
    return reply.status(204).send();
  });
}
