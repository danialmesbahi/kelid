import type { FastifyInstance } from 'fastify';
import { applyServerChange, decodeHlc, Hlc, SYNC_KINDS, type EntityState, type SyncKind } from '@kelid/core/sync';
import { authGuard, type AuthOptions } from '../auth/routes';
import { accessExpiry } from '../auth/tokens';
import { withOffice } from '../db';
import { securityHeaders } from '../headers';
import { announce, type LiveHub } from './live';
import { requireActive } from '../billing/subscription';
import { syncReminders } from '../reminders/schedule';
import { PhotoBlobs, sniffImage, type ImageMime, type PhotoPart } from '../storage/photos';

export const PUSH_MAX = 500;
const PHOTO_MAX = 2 * 1024 * 1024;
const THUMB_MAX = 256 * 1024;
const idParam = { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,64}$' } } } as const;
const b64 = (max: number) => ({ type: 'string', maxLength: Math.ceil(max / 3) * 4, pattern: '^[A-Za-z0-9+/]*={0,2}$' }) as const;
const photoSchema = {
  params: idParam,
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['mime', 'bytes', 'thumb'],
    properties: { mime: { type: 'string', enum: ['image/webp', 'image/jpeg', 'image/png'] }, bytes: b64(PHOTO_MAX), thumb: b64(THUMB_MAX) },
  },
} as const;

const partParam = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'part'],
  properties: { id: idParam.properties.id, part: { type: 'string', enum: ['full', 'thumb'] } },
} as const;

/**
 * مشاوری که اجازهٔ دیدن شمارهٔ مالک‌ها را ندارد: شماره هرگز به دستگاهش نمی‌رسد. نام مالک و بقیهٔ فایل می‌رسد.
 */
export function hideOwnerPhone(fields: Record<string, unknown>): Record<string, unknown> {
  const o = fields.owner;
  if (!o || typeof o !== 'object' || Array.isArray(o) || !(o as { phone?: unknown }).phone) return fields;
  return { ...fields, owner: { ...o, phone: '' } };
}

/**
 * و چون شماره را ندیده، نمی‌تواند عوضش کند یا پاکش کند (ویرایش نام مالک روی دستگاهش شمارهٔ خالی می‌فرستد).
 * شمارهٔ خالی را می‌تواند پر کند: فایلی که خودش ثبت می‌کند.
 */
export function keepOwnerPhone(incoming: Record<string, unknown>, current: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!('owner' in incoming)) return incoming;
  const cur = current?.owner as { phone?: unknown } | undefined;
  const phone = cur && typeof cur === 'object' && typeof cur.phone === 'string' ? cur.phone : '';
  if (!phone) return incoming;
  const o = incoming.owner;
  if (!o || typeof o !== 'object' || Array.isArray(o)) {
    const { owner: _drop, ...rest } = incoming;
    return rest;
  }
  return { ...incoming, owner: { ...o, phone } };
}

export const PULL_MAX = 500;
// پراکسی‌ها و NATها اتصال بی‌صدا را می‌بندند؛ یک خط خالی هر چند ثانیه بازش نگه می‌دارد.
const HEARTBEAT_MS = 25_000;
// دستگاهی که ساعتش جلوست نباید تا ابد برنده باشد؛ زمان‌های بیش از یک دقیقه جلوتر از سرور با ساعت سرور عوض می‌شوند.
const FUTURE_SLACK_MS = 60_000;

interface Change {
  seq: number;
  kind: SyncKind;
  id: string;
  fields: Record<string, unknown>;
  hlc: string;
}

const pushSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['changes'],
    properties: {
      changes: {
        type: 'array',
        maxItems: PUSH_MAX,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['seq', 'kind', 'id', 'fields', 'hlc'],
          properties: {
            seq: { type: 'integer', minimum: 0 },
            kind: { type: 'string', enum: [...SYNC_KINDS] },
            id: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,64}$' },
            fields: { type: 'object', maxProperties: 60, propertyNames: { pattern: '^[a-zA-Z][a-zA-Z0-9]{0,39}$' } },
            hlc: { type: 'string', pattern: '^[0-9a-z]{10}-[0-9a-z]{5}-[0-9a-z]{1,16}$' },
          },
        },
      },
    },
  },
} as const;

const pullSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: { cursor: { type: 'string', pattern: '^[0-9]{1,19}$' }, limit: { type: 'integer', minimum: 1, maximum: PULL_MAX } },
  },
} as const;

/**
 * همگام‌سازی دفتر: push صف تغییرهای یک دستگاه را ادغام می‌کند، pull هر چه بعد از نشانگر دستگاه عوض شده برمی‌گرداند.
 * همه‌چیز داخل withOffice است؛ RLS نمی‌گذارد دستگاهی حتی با شناسهٔ ساختگی به رکورد دفتر دیگری برسد.
 */
export async function syncRoutes(app: FastifyInstance, { pool, jwtSecret, hub, photos = new PhotoBlobs(null) }: AuthOptions & { hub: LiveHub; photos?: PhotoBlobs }) {
  const requireAuth = authGuard(pool, jwtSecret);
  // بعد از پایان اشتراک فقط خواندن: تغییرهای دستگاه در صفش می‌ماند تا تمدید، چیزی گم نمی‌شود.
  const writable = [requireAuth, requireActive(pool)];
  const serverClock = new Hlc('srv');

  app.post('/sync/push', { preHandler: writable, bodyLimit: 8 * 1024 * 1024, schema: pushSchema }, async (req) => {
    const changes = (req.body as { changes: Change[] }).changes;
    const office = req.auth!.off;
    const phones = req.member!.ownerPhones;
    let maxHlc: string | null = null;
    await withOffice(pool, office, async (db) => {
      // ارسال‌های هم‌زمان یک دفتر پشت هم؛ هم ترتیب نسخه‌ها درست می‌ماند هم پلاک تکراری داده نمی‌شود.
      await db.query('select pg_advisory_xact_lock(hashtext($1))', [`kelid:sync:${office}`]);
      const kinds = changes.map((c) => c.kind);
      const ids = changes.map((c) => c.id);
      const { rows } = await db.query<{ kind: SyncKind; id: string; fields: Record<string, unknown>; clocks: Record<string, string> }>(
        'select kind, id, fields, clocks from entities where (kind, id) in (select * from unnest($1::text[], $2::text[])) for update',
        [kinds, ids],
      );
      const states = new Map<string, EntityState>(rows.map((r) => [`${r.kind}:${r.id}`, { fields: r.fields, clocks: r.clocks }]));
      const dirty = new Set<string>();
      let taken: Set<number> | null = null;
      const assignPlaque = async () => {
        if (taken) return taken;
        const r = await db.query<{ p: number }>("select (fields ->> 'plaque')::int as p from entities where kind = 'listing' and fields ? 'plaque'");
        return (taken = new Set(r.rows.map((x) => x.p)));
      };

      for (const c of changes) {
        const key = `${c.kind}:${c.id}`;
        const wall = decodeHlc(c.hlc)?.wall ?? 0;
        const hlc = wall > Date.now() + FUTURE_SLACK_MS ? serverClock.now() : c.hlc;
        const cur = states.get(key);
        // پلاک‌های گرفته‌شده فقط وقتی خوانده می‌شوند که فایل تازه‌ای آمده باشد.
        const plaques = c.kind === 'listing' && typeof cur?.fields.plaque !== 'number' ? await assignPlaque() : null;
        const fields = !phones && c.kind === 'listing' ? keepOwnerPhone(c.fields, cur?.fields) : c.fields;
        const { state, changed } = applyServerChange(cur, { kind: c.kind, fields, hlc }, (proposed) => {
          const p = proposed !== null && !plaques!.has(proposed) ? proposed : Math.max(0, ...plaques!) + 1;
          plaques!.add(p);
          return p;
        });
        if (!changed) continue;
        states.set(key, state);
        dirty.add(key);
        if (!maxHlc || hlc > maxHlc) maxHlc = hlc;
      }

      if (!dirty.size) return;
      const records = [...dirty].map((key) => {
        const i = key.indexOf(':');
        const s = states.get(key)!;
        return { kind: key.slice(0, i), id: key.slice(i + 1), fields: s.fields, clocks: s.clocks };
      });
      await db.query(
        `insert into entities (kind, id, fields, clocks)
         select kind, id, fields, clocks from jsonb_to_recordset($1::jsonb) as x(kind text, id text, fields jsonb, clocks jsonb)
         on conflict (office_id, kind, id) do update set fields = excluded.fields, clocks = excluded.clocks, version = nextval('entity_version')`,
        [JSON.stringify(records)],
      );
      // یادآوری پیامکی با همان تراکنش: قرار یا شمارهٔ مشتری که عوض شد، صف هم همان لحظه درست می‌شود.
      await syncReminders(db, records);
      await announce(db, office, req.auth!.dev);
    });
    return { ok: true, hlc: maxHlc };
  });

  // بایت عکس‌ها جدا از تغییرها: هر عکس یک بار بالا می‌رود و هر دستگاه یک بار پایین می‌آوردش.
  app.post('/sync/photos/:id', { preHandler: writable, bodyLimit: 4 * 1024 * 1024, schema: photoSchema }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { mime: string; bytes: string; thumb: string };
    const bytes = Buffer.from(body.bytes, 'base64');
    const thumb = Buffer.from(body.thumb, 'base64');
    // فقط تصویر واقعی پذیرفته می‌شود: امضای چند بایت اول باید با نوعش بخواند.
    const thumbMime = sniffImage(thumb);
    if (bytes.length > PHOTO_MAX || thumb.length > THUMB_MAX || sniffImage(bytes) !== body.mime || !thumbMime) return reply.status(400).send({ error: 'bad_photo' });
    const office = req.auth!.off;
    // دستگاه‌هایی که مشخصات عکس را دارند ولی بایتش را نه، همین حالا می‌گیرندش.
    await photos.put(pool, office, id, { mime: body.mime as ImageMime, bytes, thumb, thumbMime }, (db) => announce(db, office, req.auth!.dev));
    return reply.status(204).send();
  });

  /**
   * اتصال زنده (Server-Sent Events): وقتی دستگاه دیگری از همین دفتر چیزی فرستاد، فقط «تازه داری» می‌آید و
   * دستگاه همان pull همیشگی را می‌زند. داده از این راه نمی‌آید؛ پس هر دسترسی همچنان از RLS و pull می‌گذرد.
   * عمر اتصال از توکنش بیشتر نیست و دستگاهِ بیرون‌شده همان لحظه قطع می‌شود.
   */
  app.get('/sync/events', { preHandler: requireAuth }, async (req, reply) => {
    const { off, dev } = req.auth!;
    if (!hub.hasRoom(off)) return reply.status(503).header('retry-after', '30').send({ error: 'busy' });
    await hub.ready();
    const ttl = accessExpiry(req.headers.authorization!.slice(7)) - Date.now();
    if (ttl <= 0) return reply.status(401).send({ error: 'unauthorized' });

    reply.hijack();
    const res = reply.raw;
    const head: Record<string, string> = { ...securityHeaders };
    for (const [k, v] of Object.entries(reply.getHeaders())) if (typeof v === 'string') head[k] = v;
    res.writeHead(200, { ...head, 'content-type': 'text/event-stream; charset=utf-8', 'x-accel-buffering': 'no' });
    res.write('retry: 3000\n: ready\n\n');

    let open = true;
    const close = () => {
      if (!open) return;
      open = false;
      clearInterval(beat);
      clearTimeout(expire);
      remove();
      res.end();
    };
    const beat = setInterval(() => res.write(': \n\n'), HEARTBEAT_MS);
    // توکن تمام شد ⇒ اتصال بسته می‌شود و دستگاه با توکن تازه (و بررسی دوبارهٔ دستگاه) برمی‌گردد.
    const expire = setTimeout(close, ttl);
    const remove = hub.add({
      office: off,
      device: dev,
      ping: () => open && res.write('data: change\n\n'),
      billing: () => open && res.write('event: billing\ndata: 1\n\n'),
      close,
    });
    req.raw.on('close', close);
    res.on('error', close);
  });

  /**
   * بایت خام عکس (بی base64، یک‌سوم سبک‌تر). دستگاه‌ها اول بندانگشتی همه را می‌گیرند تا فهرست‌ها پر شوند و
   * عکس کامل را بعداً، کم‌کم یا همان لحظه که کسی بازش کرد. دستگاه عکس را در دیتابیس خودش نگه می‌دارد، پس no-store می‌ماند.
   */
  app.get('/sync/photos/:id/:part', { preHandler: requireAuth, schema: { params: partParam } }, async (req, reply) => {
    const { id, part } = req.params as { id: string; part: PhotoPart };
    const office = req.auth!.off;
    const ref = await withOffice(pool, office, (db) => photos.ref(db, id, part));
    // هنوز بالا نیامده (دستگاه صاحبش آفلاین است)؛ دستگاه دفعهٔ بعد دوباره می‌پرسد.
    if (!ref) return reply.status(404).send({ error: 'not_found' });
    const bytes = await photos.bytes(ref);
    if (!bytes) {
      req.log.error({ photo: id, part }, 'photo object missing from storage');
      return reply.status(404).send({ error: 'not_found' });
    }
    return reply.header('content-type', ref.mime).send(bytes);
  });

  app.get('/sync/pull', { preHandler: requireAuth, schema: pullSchema }, async (req) => {
    const q = req.query as { cursor?: string; limit?: number };
    const limit = q.limit ?? PULL_MAX;
    const rows = await withOffice(pool, req.auth!.off, async (db) => {
      const r = await db.query<{ kind: SyncKind; id: string; fields: Record<string, unknown>; clocks: Record<string, string>; version: string }>(
        'select kind, id, fields, clocks, version from entities where version > $1 order by version limit $2',
        [q.cursor ?? '0', limit],
      );
      return r.rows;
    });
    let hlc: string | null = null;
    for (const r of rows) for (const h of Object.values(r.clocks)) if (!hlc || h > hlc) hlc = h;
    const phones = req.member!.ownerPhones;
    return {
      entities: rows.map((r) => ({ kind: r.kind, id: r.id, fields: phones || r.kind !== 'listing' ? r.fields : hideOwnerPhone(r.fields) })),
      // دستگاه از این می‌فهمد اجازه‌اش عوض شده: گرفته شد ⇒ شماره‌های محلی پاک، داده شد ⇒ دریافت دوباره از اول.
      ownerPhones: phones,
      cursor: rows.at(-1)?.version ?? q.cursor ?? '0',
      more: rows.length === limit,
      hlc,
    };
  });
}
