import Fastify, { type FastifyInstance } from 'fastify';
import { authRoutes, type AuthOptions } from './auth/routes';
import { syncRoutes } from './sync/routes';
import type { Queryable } from './db';

export interface AppOptions {
  db: Queryable;
  logLevel?: string;
  trustProxy?: boolean;
  /** بدون آن مسیرهای ورود ثبت نمی‌شوند (تست‌های بدون دیتابیس). */
  auth?: AuthOptions;
  corsOrigins?: string[];
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

export function buildApp({ db, logLevel = 'info', trustProxy = false, auth, corsOrigins = [] }: AppOptions): FastifyInstance {
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

  // فقط مبدأهای فهرست‌شده؛ بقیهٔ سایت‌ها پاسخ را نمی‌توانند بخوانند.
  if (corsOrigins.length) {
    app.addHook('onRequest', async (req, reply) => {
      const origin = req.headers.origin;
      if (!origin || !corsOrigins.includes(origin)) return;
      reply.header('access-control-allow-origin', origin).header('vary', 'Origin').header('access-control-expose-headers', 'retry-after');
      if (req.method === 'OPTIONS') {
        return reply
          .status(204)
          .header('access-control-allow-methods', 'GET, POST, DELETE')
          .header('access-control-allow-headers', 'authorization, content-type')
          .header('access-control-max-age', '600')
          .send();
      }
    });
  }

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

  app.decorateRequest('auth', null);
  if (auth) {
    void app.register(authRoutes, auth);
    void app.register(syncRoutes, auth);
  }

  return app;
}
