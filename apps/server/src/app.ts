import Fastify, { type FastifyInstance } from 'fastify';
import { authRoutes, type AuthOptions } from './auth/routes';
import { syncRoutes } from './sync/routes';
import { LiveHub } from './sync/live';
import { pageCsp, securityHeaders } from './headers';
import { billingRoutes, type BillingOptions } from './billing/routes';
import { adminRoutes } from './admin/routes';
import { betaRoutes } from './beta/routes';
import type { Queryable } from './db';
import { PhotoBlobs } from './storage/photos';
import { S3, type S3Config } from './storage/s3';
import { mapRoutes } from './map/routes';

export interface AppOptions {
  db: Queryable;
  logLevel?: string;
  trustProxy?: boolean;
  /** بدون آن مسیرهای ورود ثبت نمی‌شوند (تست‌های بدون دیتابیس). */
  auth?: AuthOptions;
  corsOrigins?: string[];
  /** فضای ذخیره‌سازی عکس‌ها؛ بی آن، بایت عکس‌ها در خود دیتابیس می‌مانند (توسعه و تست). */
  s3?: S3Config | null;
  /** اشتراک و پرداخت؛ کنار auth ثبت می‌شود. */
  billing?: Omit<BillingOptions, 'pool' | 'jwtSecret'>;
  /** پوشهٔ فایل نقشه؛ بی آن، مسیر نقشه ثبت نمی‌شود. */
  mapDir?: string | null;
}

export function buildApp({ db, logLevel = 'info', trustProxy = false, auth, corsOrigins = [], s3 = null, billing, mapDir = null }: AppOptions): FastifyInstance {
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
    // صفحه‌های HTML برگشت از درگاه استایل درون‌خطی دارند؛ هیچ اسکریپتی هیچ‌جا اجرا نمی‌شود.
    const html = String(reply.getHeader('content-type') ?? '').startsWith('text/html');
    const headers: Record<string, string> = html ? { ...securityHeaders, 'content-security-policy': pageCsp } : { ...securityHeaders };
    // فایل نقشه عمومی است و باید در مرورگر بماند؛ مسیرش خودش cache-control می‌گذارد.
    if (reply.getHeader('cache-control')) delete headers['cache-control'];
    reply.headers(headers);
  });

  // فقط مبدأهای فهرست‌شده؛ بقیهٔ سایت‌ها پاسخ را نمی‌توانند بخوانند.
  if (corsOrigins.length) {
    app.addHook('onRequest', async (req, reply) => {
      const origin = req.headers.origin;
      if (!origin || !corsOrigins.includes(origin)) return;
      reply.header('access-control-allow-origin', origin).header('vary', 'Origin').header('access-control-expose-headers', 'retry-after, etag, content-range');
      if (req.method === 'OPTIONS') {
        return reply
          .status(204)
          .header('access-control-allow-methods', 'GET, POST, DELETE')
          .header('access-control-allow-headers', 'authorization, content-type, range, if-match')
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

  if (mapDir) void app.register(mapRoutes, { dir: mapDir });

  app.decorateRequest('auth', null);
  app.decorateRequest('member', null);
  app.decorateRequest('vendor', null);
  if (auth) {
    // یک LISTEN برای همهٔ اتصال‌های زندهٔ این نمونه (دستگاه‌های دفترها و پنل فروشنده).
    const hub = new LiveHub(auth.pool, app.log);
    app.addHook('preClose', async () => hub.close());
    void app.register(authRoutes, { ...auth, licenseKey: billing?.licenseKey });
    if (billing) void app.register(billingRoutes, { ...billing, pool: auth.pool, jwtSecret: auth.jwtSecret });
    void app.register(adminRoutes, { pool: auth.pool, jwtSecret: auth.jwtSecret, hub });
    void app.register(betaRoutes, { pool: auth.pool, jwtSecret: auth.jwtSecret });
    void app.register(syncRoutes, { ...auth, hub, photos: new PhotoBlobs(s3 ? new S3(s3) : null) });
  }

  return app;
}
