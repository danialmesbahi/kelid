import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';

export interface MapOptions {
  /** پوشهٔ فایل‌های نقشه (‎*.pmtiles‎)؛ برنامه هر بار فقط تکه‌ای از فایل را می‌خواهد. */
  dir: string;
}

// فقط نام سادهٔ فایل؛ هیچ مسیر نسبی‌ای (‎../‎) به بیرون پوشه نمی‌رسد.
const NAME = /^[a-z0-9][a-z0-9-]{0,62}\.pmtiles$/;
// تکهٔ بزرگ‌تر از این را کسی نمی‌خواهد؛ جلوی بیرون کشیدن یک‌جای فایل‌های چندگیگابایتی را می‌گیرد.
const MAX_CHUNK = 16 * 1024 * 1024;

/** نقشهٔ خودمان (OpenStreetMap)؛ بی‌وابستگی به هیچ سرویس بیرونی و در نت ملی هم در دسترس. ورود لازم ندارد چون داده عمومی است. */
export async function mapRoutes(app: FastifyInstance, { dir }: MapOptions) {
  app.get<{ Params: { name: string } }>('/map/:name', async (req, reply) => {
    const { name } = req.params;
    if (!NAME.test(name)) return reply.status(404).send({ error: 'not_found' });
    const path = join(dir, name);
    const info = await stat(path).catch(() => null);
    if (!info?.isFile()) return reply.status(404).send({ error: 'not_found' });

    const etag = `"${info.size.toString(36)}-${Math.floor(info.mtimeMs).toString(36)}"`;
    // فایل نقشه که عوض شود، برنامه تکه‌های قدیمی را دور می‌ریزد (tileCache.ts)
    const ifMatch = req.headers['if-match'];
    if (ifMatch && ifMatch !== etag) return reply.status(412).send({ error: 'changed' });

    reply.header('etag', etag).header('accept-ranges', 'bytes').header('cache-control', 'public, max-age=3600');
    const m = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range ?? '');
    if (!m) {
      if (req.headers.range) return reply.status(416).header('content-range', `bytes */${info.size}`).send();
      return reply.status(400).send({ error: 'range_required' });
    }
    const start = Number(m[1]);
    const end = Math.min(m[2] ? Number(m[2]) : info.size - 1, info.size - 1, start + MAX_CHUNK - 1);
    if (start >= info.size || end < start) return reply.status(416).header('content-range', `bytes */${info.size}`).send();
    return reply
      .status(206)
      .type('application/octet-stream')
      .header('content-range', `bytes ${start}-${end}/${info.size}`)
      .header('content-length', end - start + 1)
      .send(createReadStream(path, { start, end }));
  });
}
