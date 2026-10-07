import type { Pool } from './db';

/**
 * فقط به انتها اضافه کنید؛ migration منتشرشده هرگز ویرایش نمی‌شود.
 * هر جدول تازه باید RLS را enable و force کند (تست db.test.ts جدول بی‌RLS را رد می‌کند).
 */
export const migrations: readonly string[] = [
  // 1: دفترها و شناسهٔ دفترِ تراکنش جاری
  `
  create function kelid_office() returns uuid
    language sql stable
    as $$ select nullif(current_setting('kelid.office_id', true), '')::uuid $$;

  create table offices (
    id uuid primary key,
    name text not null check (length(name) between 1 and 200),
    created_at timestamptz not null default now()
  );
  alter table offices enable row level security;
  alter table offices force row level security;
  create policy office_isolation on offices
    using (id = kelid_office())
    with check (id = kelid_office());
  `,
];

/** migrationهای اجرانشده را در یک تراکنش اجرا می‌کند؛ قفل advisory دو نمونهٔ هم‌زمان سرور را پشت هم می‌گذارد. */
export async function migrate(pool: Pool): Promise<number> {
  const db = await pool.connect();
  try {
    await db.query('begin');
    await db.query("select pg_advisory_xact_lock(hashtext('kelid:migrate'))");
    await db.query('create table if not exists schema_migrations (version int primary key, applied_at timestamptz not null default now())');
    const { rows } = await db.query<{ v: number }>('select coalesce(max(version), 0) as v from schema_migrations');
    const from = rows[0]?.v ?? 0;
    for (let i = from; i < migrations.length; i++) {
      await db.query(migrations[i]!);
      await db.query('insert into schema_migrations (version) values ($1)', [i + 1]);
    }
    await db.query('commit');
    return migrations.length - from;
  } catch (e) {
    await db.query('rollback').catch(() => {});
    throw e;
  } finally {
    db.release();
  }
}
