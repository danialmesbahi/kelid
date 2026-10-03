import type Database from 'better-sqlite3';
import type { SqlDriver, SqlParams } from './driver';

/**
 * درایور SQLite برای Node و پروسهٔ اصلی Electron (better-sqlite3-multiple-ciphers).
 * فقط در ویندوز و تست‌ها استفاده می‌شود؛ وارد بستهٔ وب نمی‌شود.
 */
export function nodeSqliteDriver(db: Database.Database): SqlDriver {
  const run = (sql: string, params: SqlParams = []) => {
    const st = db.prepare(sql);
    if (st.reader) return st.all(...params);
    st.run(...params);
    return [];
  };
  return {
    async all<T>(sql: string, params?: SqlParams) {
      return run(sql, params) as T[];
    },
    async transaction(statements) {
      db.transaction(() => {
        for (const s of statements) run(s.sql, s.params);
      })();
    },
    async execScript(sql) {
      db.exec(sql);
    },
  };
}

/** باز کردن دیتابیس رمزگذاری‌شده (AES-256، سازگار با SQLCipher v4). */
export function openEncrypted(DatabaseCtor: typeof Database, file: string, key: string): Database.Database {
  const db = new DatabaseCtor(file);
  try {
    db.pragma("cipher='sqlcipher'");
    db.pragma('legacy=4');
    db.pragma(`key='${key.replace(/'/g, "''")}'`);
    // اگر کلید غلط باشد، همین خواندن خطا می‌دهد.
    db.prepare('SELECT count(*) FROM sqlite_master').get();
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    return db;
  } catch (err) {
    // فایل نباید قفل بماند؛ وگرنه حتی با کلید درست هم دیگر باز نمی‌شود.
    db.close();
    throw err;
  }
}
