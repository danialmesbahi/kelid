import Fastify, { type FastifyInstance } from 'fastify';
import type { Queryable } from './db';

export interface AppOptions {
  db: Queryable;
  logLevel?: string;
  trustProxy?: boolean;
}

// پاسخ‌های API فقط JSON‌اند؛ هیچ مرورگری نباید آن‌ها را اجرا، قاب یا ذخیره کند.
const securityHeaders = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'cache-control': 'no-store',
};

export function buildApp({ db, logLevel = 'info', trustProxy = false }: AppOptions): FastifyInstance {
  const app = Fastify({
    trustProxy,
    bodyLimit: 1_048_576,
    logger: {
      level: logLevel,
      // توکن‌ها و کوکی‌ها هرگز در لاگ نمی‌آیند.
      redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
    },
  });

  app.addHook('onSend', async (_req, reply) => {
    reply.headers(securityHeaders);
  });

  app.setErrorHandler((err: { statusCode?: number; message: string }, req, reply) => {
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    if (status >= 500) {
      req.log.error(err);
      // جزئیات خطای داخلی (SQL، مسیر فایل…) به بیرون درز نمی‌کند.
      return reply.status(status).send({ error: 'internal' });
    }
    return reply.status(status).send({ error: err.message });
  });

  app.get('/health', async (req, reply) => {
    try {
      await db.query('select 1');
      return { status: 'ok' };
    } catch (e) {
      req.log.warn({ err: e }, 'health: database unreachable');
      return reply.status(503).send({ status: 'unavailable' });
    }
  });

  return app;
}
