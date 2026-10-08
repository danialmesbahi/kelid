import type { Queryable } from '../db';
import { normalizePhone } from '../auth/phone';

/** یادآوری چقدر پیش از قرار فرستاده می‌شود. */
export const REMIND_BEFORE_MS = 2 * 60 * 60 * 1000;
// قراری که کمتر از این مانده، دیگر یادآوری نمی‌گیرد (پیامک دیر بیشتر گیج می‌کند تا کمک).
const TOO_LATE_MS = 10 * 60 * 1000;
const PLACE_MAX = 60;

export interface ChangedEntity {
  kind: string;
  id: string;
  fields: Record<string, unknown>;
}

const text = (v: unknown) => (typeof v === 'string' ? v : '');

/**
 * صف یادآوری را با قرارها و مشتری‌هایی که همین push عوض کرد هم‌خوان می‌کند. داخل همان تراکنش withOffice صدا زده
 * می‌شود؛ پس فقط دادهٔ همین دفتر دیده می‌شود و یادآوری با خود تغییر commit یا برگشت می‌خورد.
 * قراری که یادآوری‌اش فرستاده شده، فقط اگر ساعتش یا شمارهٔ مشتری عوض شود دوباره پیامک می‌گیرد.
 */
export async function syncReminders(db: Queryable, changed: ChangedEntity[], now = Date.now()): Promise<void> {
  const visitIds = new Set(changed.filter((c) => c.kind === 'visit').map((c) => c.id));
  const clientIds = changed.filter((c) => c.kind === 'client').map((c) => c.id);
  const visits = new Map(changed.filter((c) => c.kind === 'visit').map((c) => [c.id, c.fields]));
  // مشتری‌ای که شماره‌اش عوض شد ⇒ قرارهای یادآوری‌دارش هم دوباره حساب می‌شوند.
  if (clientIds.length) {
    const r = await db.query<{ id: string; fields: Record<string, unknown> }>(
      "select id, fields from entities where kind = 'visit' and fields ->> 'clientId' = any($1::text[]) and fields ->> 'remind' = 'true'",
      [clientIds],
    );
    for (const v of r.rows) if (!visitIds.has(v.id)) visits.set(v.id, v.fields);
  }
  if (!visits.size) return;

  const want = [...visits].filter(([, f]) => f.remind === true && f.done !== true && f.deleted !== true && text(f.clientId));
  const refs = new Set<string>();
  for (const [, f] of want) {
    refs.add(`client:${text(f.clientId)}`);
    if (text(f.listingId)) refs.add(`listing:${text(f.listingId)}`);
  }
  const lookup = new Map<string, Record<string, unknown>>();
  if (refs.size) {
    const keys = [...refs].map((k) => k.split(':') as [string, string]);
    const r = await db.query<{ kind: string; id: string; fields: Record<string, unknown> }>(
      "select kind, id, fields from entities where (kind, id) in (select * from unnest($1::text[], $2::text[])) and coalesce(fields ->> 'deleted', 'false') <> 'true'",
      [keys.map((k) => k[0]), keys.map((k) => k[1])],
    );
    for (const e of r.rows) lookup.set(`${e.kind}:${e.id}`, e.fields);
  }

  const rows: Array<{ visit_id: string; phone: string; starts_at: string; send_at: string; place: string }> = [];
  for (const [id, f] of want) {
    const starts = Date.parse(text(f.startsAt));
    const phone = normalizePhone(text(lookup.get(`client:${text(f.clientId)}`)?.phone));
    if (!phone || !Number.isFinite(starts) || starts - now < TOO_LATE_MS) continue;
    const place = text(lookup.get(`listing:${text(f.listingId)}`)?.neighborhood).trim().slice(0, PLACE_MAX);
    rows.push({ visit_id: id, phone, starts_at: new Date(starts).toISOString(), send_at: new Date(Math.max(now, starts - REMIND_BEFORE_MS)).toISOString(), place });
  }
  const keep = new Set(rows.map((r) => r.visit_id));
  const drop = [...visits.keys()].filter((id) => !keep.has(id));

  if (rows.length) {
    await db.query(
      `insert into reminders (visit_id, phone, starts_at, send_at, place)
       select visit_id, phone, starts_at, send_at, place from jsonb_to_recordset($1::jsonb)
         as x(visit_id text, phone text, starts_at timestamptz, send_at timestamptz, place text)
       on conflict (office_id, visit_id) do update set
         status = case when reminders.status in ('sent', 'sending') and reminders.starts_at = excluded.starts_at and reminders.phone = excluded.phone
                       then reminders.status else 'pending' end,
         attempts = case when reminders.starts_at = excluded.starts_at and reminders.phone = excluded.phone then reminders.attempts else 0 end,
         phone = excluded.phone, starts_at = excluded.starts_at, send_at = excluded.send_at, place = excluded.place, updated_at = now()`,
      [JSON.stringify(rows)],
    );
  }
  if (drop.length) {
    await db.query("update reminders set status = 'canceled', updated_at = now() where visit_id = any($1::text[]) and status in ('pending', 'sending')", [drop]);
  }
}
