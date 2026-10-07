import type { FastifyInstance } from 'fastify';
import { applyServerChange, decodeHlc, Hlc, SYNC_KINDS, type EntityState, type SyncKind } from '@kelid/core/sync';
import { authGuard, type AuthOptions } from '../auth/routes';
import { withOffice } from '../db';

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

/** فقط تصویر واقعی پذیرفته می‌شود: امضای چند بایت اول باید با نوعش بخواند. */
function looksLike(mime: string, b: Buffer): boolean {
  if (mime === 'image/jpeg') return b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (mime === 'image/png') return b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return b.length > 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP';
}

/** نوع بندانگشتی را از خود بایت‌ها؛ برنامه همیشه webp یا jpeg می‌سازد. */
function thumbOk(b: Buffer): boolean {
  return looksLike('image/webp', b) || looksLike('image/jpeg', b) || looksLike('image/png', b);
}
export const PULL_MAX = 500;
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
export async function syncRoutes(app: FastifyInstance, { pool, jwtSecret }: AuthOptions) {
  const requireAuth = authGuard(pool, jwtSecret);
  const serverClock = new Hlc('srv');

  app.post('/sync/push', { preHandler: requireAuth, bodyLimit: 8 * 1024 * 1024, schema: pushSchema }, async (req) => {
    const changes = (req.body as { changes: Change[] }).changes;
    const office = req.auth!.off;
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
        const { state, changed } = applyServerChange(cur, { kind: c.kind, fields: c.fields, hlc }, (proposed) => {
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
    });
    return { ok: true, hlc: maxHlc };
  });

  // بایت عکس‌ها جدا از تغییرها: هر عکس یک بار بالا می‌رود و هر دستگاه یک بار پایین می‌آوردش.
  app.post('/sync/photos/:id', { preHandler: requireAuth, bodyLimit: 4 * 1024 * 1024, schema: photoSchema }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { mime: string; bytes: string; thumb: string };
    const bytes = Buffer.from(body.bytes, 'base64');
    const thumb = Buffer.from(body.thumb, 'base64');
    if (bytes.length > PHOTO_MAX || thumb.length > THUMB_MAX || !looksLike(body.mime, bytes) || !thumbOk(thumb)) return reply.status(400).send({ error: 'bad_photo' });
    await withOffice(pool, req.auth!.off, (db) =>
      db.query('insert into photo_blobs (id, mime, bytes, thumb) values ($1, $2, $3, $4) on conflict (office_id, id) do nothing', [id, body.mime, bytes, thumb]),
    );
    return reply.status(204).send();
  });

  app.get('/sync/photos/:id', { preHandler: requireAuth, schema: { params: idParam } }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = await withOffice(pool, req.auth!.off, (db) => db.query<{ mime: string; bytes: Buffer; thumb: Buffer }>('select mime, bytes, thumb from photo_blobs where id = $1', [id]));
    const row = r.rows[0];
    // هنوز بالا نیامده (دستگاه صاحبش آفلاین است)؛ دستگاه دفعهٔ بعد دوباره می‌پرسد.
    if (!row) return reply.status(404).send({ error: 'not_found' });
    return { mime: row.mime, bytes: row.bytes.toString('base64'), thumb: row.thumb.toString('base64') };
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
    return {
      entities: rows.map((r) => ({ kind: r.kind, id: r.id, fields: r.fields })),
      cursor: rows.at(-1)?.version ?? q.cursor ?? '0',
      more: rows.length === limit,
      hlc,
    };
  });
}
