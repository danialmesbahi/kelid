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
  // 2: ورود با موبایل. این جدول‌ها عمداً مال هیچ دفتری نیستند (پیش از ورود، دفتری معلوم نیست)
  // و فقط auth/routes.ts به آن‌ها دست می‌زند؛ کدها و توکن‌ها فقط به شکل هش ذخیره می‌شوند.
  `
  create table users (
    id uuid primary key,
    office_id uuid not null references offices (id),
    phone text not null unique check (phone ~ '^09[0-9]{9}$'),
    name text not null check (length(name) between 1 and 100),
    created_at timestamptz not null default now()
  );
  create index users_office on users (office_id);

  create table devices (
    id uuid primary key,
    user_id uuid not null references users (id),
    name text not null check (length(name) between 1 and 100),
    refresh_hash bytea not null unique,
    prev_refresh_hash bytea,
    rotated_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    revoked_at timestamptz
  );
  create index devices_user on devices (user_id) where revoked_at is null;
  create index devices_prev on devices (prev_refresh_hash) where prev_refresh_hash is not null;

  create table otp_codes (
    phone text primary key,
    code_hash bytea,
    expires_at timestamptz not null,
    attempts int not null default 0,
    sent_count int not null default 0,
    window_start timestamptz not null default now(),
    last_sent_at timestamptz not null default now()
  );

  create table signup_tickets (
    hash bytea primary key,
    phone text not null,
    expires_at timestamptz not null
  );
  `,
  // 3: همگام‌سازی. هر رکورد دفتر (فایل، مشتری، قرار، کار، معامله، مشخصات عکس) یک ردیف با مقدار و زمان HLC هر فیلد.
  // version از یک دنباله می‌آید و ارسال‌های هر دفتر پشت یک قفل‌اند، پس «همه چیز بعد از نسخهٔ N» هیچ‌وقت چیزی جا نمی‌اندازد.
  `
  create sequence entity_version;
  create table entities (
    office_id uuid not null default kelid_office() references offices (id),
    kind text not null check (kind in ('listing', 'client', 'visit', 'todo', 'deal', 'photo')),
    id text not null check (id ~ '^[A-Za-z0-9_-]{1,64}$'),
    fields jsonb not null,
    clocks jsonb not null,
    version bigint not null default nextval('entity_version'),
    primary key (office_id, kind, id)
  );
  create index entities_pull on entities (office_id, version);
  create unique index entities_plaque on entities (office_id, ((fields ->> 'plaque')::int)) where kind = 'listing' and fields ? 'plaque';
  alter table entities enable row level security;
  alter table entities force row level security;
  create policy office_isolation on entities
    using (office_id = kelid_office())
    with check (office_id = kelid_office());
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
