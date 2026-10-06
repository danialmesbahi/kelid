import type { SqlDriver } from './driver';

/**
 * مهاجرت‌های دیتابیس، به ترتیب. هر نسخهٔ برنامه فقط مهاجرت‌های تازه را اجرا می‌کند.
 * هرگز مهاجرت قبلی را ویرایش نکنید؛ همیشه یک مورد تازه اضافه کنید.
 */
export const migrations: string[] = [
  /* 1: جدول‌های پایه */ `
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

  CREATE TABLE IF NOT EXISTS listings (
    id TEXT PRIMARY KEY,
    plaque INTEGER,
    deal TEXT NOT NULL,
    status TEXT NOT NULL,
    kind TEXT NOT NULL,
    neighborhood TEXT NOT NULL,
    street TEXT NOT NULL DEFAULT '',
    address TEXT,
    area INTEGER NOT NULL,
    bedrooms INTEGER NOT NULL DEFAULT 0,
    floor INTEGER,
    floors_total INTEGER,
    year_built INTEGER,
    features TEXT NOT NULL DEFAULT '[]',
    price_total INTEGER,
    price_deposit INTEGER,
    price_rent INTEGER,
    negotiable INTEGER NOT NULL DEFAULT 1,
    description TEXT,
    owner_name TEXT NOT NULL DEFAULT '',
    owner_phone TEXT NOT NULL DEFAULT '',
    owner_best_time TEXT,
    cover TEXT NOT NULL DEFAULT 'f',
    photo_count INTEGER NOT NULL DEFAULT 0,
    search TEXT NOT NULL DEFAULT '',
    sample INTEGER NOT NULL DEFAULT 0,
    deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS listings_deal ON listings(deal) WHERE deleted = 0;
  CREATE INDEX IF NOT EXISTS listings_created ON listings(created_at) WHERE deleted = 0;
  CREATE UNIQUE INDEX IF NOT EXISTS listings_plaque ON listings(plaque) WHERE plaque IS NOT NULL;

  CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    need TEXT NOT NULL,
    temperature TEXT NOT NULL DEFAULT 'warm',
    waiting INTEGER NOT NULL DEFAULT 0,
    last_contact_at TEXT NOT NULL,
    search TEXT NOT NULL DEFAULT '',
    sample INTEGER NOT NULL DEFAULT 0,
    deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS visits (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    listing_id TEXT,
    client_id TEXT,
    done INTEGER NOT NULL DEFAULT 0,
    sample INTEGER NOT NULL DEFAULT 0,
    deleted INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS visits_start ON visits(starts_at) WHERE deleted = 0;

  CREATE TABLE IF NOT EXISTS todos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    action TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    sample INTEGER NOT NULL DEFAULT 0,
    deleted INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  );

  /* صف ارسال برای همگام‌سازی با سرور (فاز ۲). هر تغییر محلی اینجا هم ثبت می‌شود. */
  CREATE TABLE IF NOT EXISTS outbox (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    op TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  `,
  /* 2: عکس فایل‌ها؛ داخل همین دیتابیس تا روی ویندوز رمزگذاری شوند و با همگام‌سازی جابه‌جا شوند */ `
  CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    listing_id TEXT NOT NULL,
    ord INTEGER NOT NULL DEFAULT 0,
    mime TEXT NOT NULL,
    w INTEGER NOT NULL,
    h INTEGER NOT NULL,
    bytes BLOB NOT NULL,
    thumb BLOB NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS photos_listing ON photos(listing_id, ord) WHERE deleted = 0;
  `,
  /* 3: یادداشت داخلی برای مشتری */ `
  ALTER TABLE clients ADD COLUMN notes TEXT;
  `,
  /* 4: معامله‌ها و قراردادها (خط معامله) */ `
  CREATE TABLE IF NOT EXISTS deals (
    id TEXT PRIMARY KEY,
    listing_id TEXT NOT NULL,
    client_id TEXT,
    stage TEXT NOT NULL,
    price INTEGER,
    rent INTEGER,
    commission_buyer INTEGER,
    commission_seller INTEGER,
    checklist TEXT NOT NULL DEFAULT '[]',
    due_day TEXT,
    notes TEXT,
    closed_at TEXT,
    sample INTEGER NOT NULL DEFAULT 0,
    deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS deals_listing ON deals(listing_id) WHERE deleted = 0;
  `,
];

export async function migrate(db: SqlDriver): Promise<void> {
  const [row] = await db.all<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (let v = current; v < migrations.length; v++) {
    await db.execScript(`BEGIN; ${migrations[v]} PRAGMA user_version = ${v + 1}; COMMIT;`);
  }
}
