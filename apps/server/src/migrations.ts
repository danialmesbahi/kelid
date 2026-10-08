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
  // 3: ورود با رمز عبور (کد پیامکی گزینهٔ دوم است). بعد از پنج رمز اشتباه، شماره ربع ساعت قفل می‌شود.
  // otp_at: این دستگاه کی با کد پیامکی وارد شد؛ فقط تا چند دقیقه بعدش می‌شود بدون رمز قبلی رمز تازه گذاشت (فراموشی رمز).
  `
  alter table users add column password_hash text;
  alter table users add column failed_logins int not null default 0;
  alter table users add column locked_until timestamptz;
  alter table devices add column otp_at timestamptz;
  `,
  // 4: همگام‌سازی. هر رکورد دفتر (فایل، مشتری، قرار، کار، معامله، مشخصات عکس) یک ردیف با مقدار و زمان HLC هر فیلد.
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
  // 5: بایت عکس فایل‌ها؛ مشخصات عکس مثل بقیه در entities است. هر عکس یک بار نوشته می‌شود و دیگر عوض نمی‌شود.
  `
  create table photo_blobs (
    office_id uuid not null default kelid_office() references offices (id),
    id text not null check (id ~ '^[A-Za-z0-9_-]{1,64}$'),
    mime text not null check (mime in ('image/webp', 'image/jpeg', 'image/png')),
    bytes bytea not null check (octet_length(bytes) <= 2097152),
    thumb bytea not null check (octet_length(thumb) <= 262144),
    created_at timestamptz not null default now(),
    primary key (office_id, id)
  );
  alter table photo_blobs enable row level security;
  alter table photo_blobs force row level security;
  create policy office_isolation on photo_blobs
    using (office_id = kelid_office())
    with check (office_id = kelid_office());
  `,
  // 6: همکاران دفتر. نقش مدیر/مشاور؛ مشاور فقط با اجازهٔ مدیر شمارهٔ مالک‌ها را می‌بیند. کسی که از دفتر برداشته شد
  // ردیفش می‌ماند (removed_at) تا شماره‌اش بعداً بتواند دفتر تازه بسازد یا به دفتر دیگری بپیوندد.
  // دعوت‌ها مثل users مال هیچ دفتری نیستند: پیش از ورود، با شمارهٔ دعوت‌شده پیدا می‌شوند. فقط auth/ به آن‌ها دست می‌زند.
  `
  alter table users add column role text not null default 'manager' check (role in ('manager', 'agent'));
  alter table users add column see_owner_phones boolean not null default true;
  alter table users add column removed_at timestamptz;
  alter table offices add column seats int not null default 5 check (seats between 1 and 500);

  create table invites (
    office_id uuid not null references offices (id),
    phone text not null check (phone ~ '^09[0-9]{9}$'),
    name text not null check (length(name) between 1 and 100),
    role text not null check (role in ('manager', 'agent')),
    see_owner_phones boolean not null default false,
    invited_by uuid not null references users (id),
    created_at timestamptz not null default now(),
    primary key (office_id, phone)
  );
  create index invites_phone on invites (phone);
  `,
  // 7: بایت عکس‌ها می‌تواند در فضای ذخیره‌سازی S3 (آروان، لیارا) باشد؛ آن‌وقت این جدول فقط مشخصات را دارد و
  // دسترسی همچنان از همین ردیف (پشت RLS) می‌گذرد. object_key: پیشوند یکتای همان بارِ بالا رفتن، تا هیچ ارسالی
  // شیء عکسی را که قبلاً ثبت شده بازنویسی نکند. thumb_mime: نوع بندانگشتی که با خود عکس فرق دارد.
  `
  alter table photo_blobs alter column bytes drop not null;
  alter table photo_blobs alter column thumb drop not null;
  alter table photo_blobs add column stored text not null default 'db' check (stored in ('db', 's3'));
  alter table photo_blobs add column object_key text check (object_key ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,64}/[0-9a-f]{32}$');
  alter table photo_blobs add column size int;
  alter table photo_blobs add column thumb_mime text check (thumb_mime in ('image/webp', 'image/jpeg', 'image/png'));
  alter table photo_blobs add constraint photo_blobs_bytes check (case when stored = 's3' then object_key is not null else bytes is not null and thumb is not null end);
  `,
  // 8: اشتراک. هر دفتر یک پلن و پایان اعتبار دارد؛ دفتر تازه (و دفترهای موجود) ۱۴ روز آزمایشی با پلن «دفتر» می‌گیرند.
  // پرداخت‌ها مال دفترند و پشت RLS؛ برگشت از درگاه شناسهٔ دفتر را در نشانی دارد و ردیف را فقط از راه همان دفتر می‌خواند.
  // amount به ریال، همان که درگاه می‌گیرد. authority شناسهٔ درگاه برای همان پرداخت است.
  `
  alter table offices add column plan text not null default 'office' check (plan ~ '^[a-z]{2,20}$');
  alter table offices add column trial boolean not null default true;
  alter table offices add column expires_at timestamptz not null default now() + interval '14 days';

  create table payments (
    office_id uuid not null default kelid_office() references offices (id),
    id uuid not null,
    plan text not null check (plan ~ '^[a-z]{2,20}$'),
    period text not null check (period in ('month', 'year')),
    amount bigint not null check (amount > 0),
    gateway text not null check (gateway in ('zarinpal', 'dev')),
    authority text check (authority ~ '^[A-Za-z0-9_-]{1,64}$'),
    status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'canceled')),
    ref_id text check (length(ref_id) <= 64),
    card text check (length(card) <= 32),
    created_by uuid not null references users (id),
    created_at timestamptz not null default now(),
    paid_at timestamptz,
    expires_at timestamptz,
    primary key (office_id, id)
  );
  create index payments_recent on payments (office_id, created_at desc);
  alter table payments enable row level security;
  alter table payments force row level security;
  create policy office_isolation on payments
    using (office_id = kelid_office())
    with check (office_id = kelid_office());
  `,
  // 9: پنل فروشنده (تیم کلید). حساب‌های مدیر فروشنده جدا از کاربران دفترهاست و با رمز + کد دومرحله‌ای وارد می‌شود.
  // دسترسی فروشنده به همهٔ دفترها فقط در تراکنشی است که withVendor (db.ts) پرچم kelid.vendor را برایش روشن کرده؛
  // سیاست‌های تازه کنار office_isolation می‌نشینند و جای آن را نمی‌گیرند. از جدول‌های دادهٔ دفتر (entities، عکس‌ها)
  // چیزی به فروشنده نمی‌رسد. vendor_notes یادداشت‌های پشتیبانی و سابقهٔ تمدید و تعلیق هر دفتر است و دفترها آن را نمی‌بینند.
  // totp_secret خام می‌ماند چون کد هر بار با آن ساخته می‌شود؛ totp_last_step جلوی استفادهٔ دوباره از همان کد را می‌گیرد.
  `
  create function kelid_vendor() returns boolean
    language sql stable
    as $$ select coalesce(current_setting('kelid.vendor', true), '') = 'on' $$;

  alter table offices add column suspended_at timestamptz;
  alter table offices add column suspend_reason text check (length(suspend_reason) between 1 and 500);
  create policy vendor_access on offices
    using (kelid_vendor())
    with check (kelid_vendor());
  create policy vendor_read on payments for select
    using (kelid_vendor());

  create table vendor_admins (
    id uuid primary key,
    phone text not null unique check (phone ~ '^09[0-9]{9}$'),
    name text not null check (length(name) between 1 and 100),
    password_hash text not null,
    totp_secret text not null check (totp_secret ~ '^[A-Z2-7]{32}$'),
    totp_last_step bigint not null default 0,
    failed_logins int not null default 0,
    locked_until timestamptz,
    disabled_at timestamptz,
    last_login_at timestamptz,
    created_at timestamptz not null default now()
  );
  alter table vendor_admins enable row level security;
  alter table vendor_admins force row level security;
  create policy vendor_only on vendor_admins
    using (kelid_vendor())
    with check (kelid_vendor());

  create table vendor_notes (
    office_id uuid not null references offices (id),
    id uuid not null,
    admin_id uuid not null references vendor_admins (id),
    kind text not null check (kind in ('note', 'extend', 'suspend', 'resume')),
    body text not null check (length(body) between 1 and 2000),
    created_at timestamptz not null default now(),
    primary key (office_id, id)
  );
  create index vendor_notes_recent on vendor_notes (office_id, created_at desc);
  alter table vendor_notes enable row level security;
  alter table vendor_notes force row level security;
  create policy vendor_only on vendor_notes
    using (kelid_vendor())
    with check (kelid_vendor());
  `,
  // 10: خبر زنده از خود دیتابیس، تا هیچ راه نوشتنی (مسیر، خط فرمان، دست مدیر) جا نماند.
  // kelid_vendor: «دفتر X عوض شد» برای پنل فروشنده (فقط شناسه؛ داده همچنان از مسیرهای پنل و RLS می‌آید).
  // kelid_live با k=billing: دستگاه‌های همان دفتر همان لحظه مجوز تازه می‌گیرند (تمدید، تعلیق، پرداخت، تغییر پلن).
  // last_seen دستگاه‌ها عمداً خبر نمی‌دهد؛ با هر تمدید توکن عوض می‌شود و پنل را بی‌دلیل شلوغ می‌کرد.
  `
  create function kelid_vendor_notify() returns trigger
    language plpgsql
    as $$
    declare
      r jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
    begin
      perform pg_notify('kelid_vendor', r ->> case when tg_table_name = 'offices' then 'id' else 'office_id' end);
      return null;
    end $$;

  create trigger vendor_notify after insert or update or delete on offices for each row execute function kelid_vendor_notify();
  create trigger vendor_notify after insert or update or delete on users for each row execute function kelid_vendor_notify();
  create trigger vendor_notify after insert or update or delete on invites for each row execute function kelid_vendor_notify();
  create trigger vendor_notify after insert or update or delete on payments for each row execute function kelid_vendor_notify();
  create trigger vendor_notify after insert or update or delete on vendor_notes for each row execute function kelid_vendor_notify();

  create function kelid_billing_notify() returns trigger
    language plpgsql
    as $$
    begin
      perform pg_notify('kelid_live', json_build_object('o', new.id, 'k', 'billing')::text);
      return null;
    end $$;

  create trigger billing_notify after update on offices for each row
    when ((old.plan, old.trial, old.expires_at, old.seats, old.suspended_at, old.suspend_reason)
      is distinct from (new.plan, new.trial, new.expires_at, new.seats, new.suspended_at, new.suspend_reason))
    execute function kelid_billing_notify();
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
