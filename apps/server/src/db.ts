import pg from 'pg';

export type Pool = pg.Pool;
export type Db = pg.PoolClient;
/** کمترین چیزی که بررسی‌ها و مسیر سلامت از دیتابیس لازم دارند. */
export type Queryable = Pick<pg.Pool, 'query'>;

export function createPool(url: string): Pool {
  return new pg.Pool({
    connectionString: url,
    max: 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    // یک کوئری گیرکرده نباید اتصال‌ها را قفل کند.
    statement_timeout: 15_000,
    application_name: 'kelid-server',
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * تنها راه دسترسی به دادهٔ یک دفتر: یک تراکنش که شناسهٔ دفتر را فقط برای همان تراکنش تنظیم می‌کند.
 * سیاست‌های RLS هر ردیفی را که office_id دیگری داشته باشد پنهان می‌کنند؛ بیرون از این تابع هیچ ردیفی دیده نمی‌شود.
 */
export async function withOffice<T>(pool: Pool, officeId: string, fn: (db: Db) => Promise<T>): Promise<T> {
  if (!UUID.test(officeId)) throw new Error('شناسهٔ دفتر نامعتبر است');
  return transaction(pool, async (db) => {
    // true = محلی برای همین تراکنش؛ بعد از commit/rollback به اتصال بعدی در pool نشت نمی‌کند.
    await db.query("select set_config('kelid.office_id', $1, true)", [officeId]);
    return fn(db);
  });
}

/** یک تراکنش روی یک اتصال؛ اگر rollback هم شکست بخورد اتصال دور انداخته می‌شود، نه برگردانده به pool. */
export async function transaction<T>(pool: Pool, fn: (db: Db) => Promise<T>): Promise<T> {
  const db = await pool.connect();
  let broken: Error | undefined;
  try {
    await db.query('begin');
    const out = await fn(db);
    await db.query('commit');
    return out;
  } catch (e) {
    await db.query('rollback').catch((r: Error) => (broken = r));
    throw e;
  } finally {
    db.release(broken);
  }
}

/** سرور با نقشی که RLS را دور می‌زند بالا نمی‌آید؛ وگرنه جدایی دفترها فقط روی کاغذ است. */
export async function assertSafeRole(db: Queryable): Promise<{ ownsTables: boolean }> {
  const { rows } = await db.query<{ rolsuper: boolean; rolbypassrls: boolean; owns: boolean }>(
    `select rolsuper, rolbypassrls,
            exists (select 1 from pg_tables where schemaname = 'public' and tableowner = current_user) as owns
       from pg_roles where rolname = current_user`,
  );
  const role = rows[0];
  if (!role) throw new Error('نقش دیتابیس پیدا نشد');
  if (role.rolsuper || role.rolbypassrls) {
    throw new Error('نقش DATABASE_URL نباید superuser یا BYPASSRLS باشد؛ یک نقش معمولی بسازید (apps/server/db/init.sql)');
  }
  return { ownsTables: role.owns };
}
