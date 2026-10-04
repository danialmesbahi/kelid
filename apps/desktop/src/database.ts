import { app, ipcMain, safeStorage } from 'electron';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import Database from 'better-sqlite3-multiple-ciphers';
import { openEncrypted } from '@kelid/core/node';

type Params = Array<string | number | null | Uint8Array>;

// عکس‌ها پیش از ذخیره زیر ۱.۵ مگابایت می‌شوند؛ هر چیز بزرگ‌تر از رابط کاربری خطاست، نه داده.
const MAX_BLOB_BYTES = 4 * 1024 * 1024;

/** ورودی IPC از رندرر قابل‌اعتماد نیست؛ فقط انواعی که دیتابیس لازم دارد و با اندازهٔ محدود پذیرفته می‌شوند. */
function checkParams(params: unknown): Params {
  if (params === undefined) return [];
  if (!Array.isArray(params)) throw new TypeError('db params must be an array');
  for (const [i, v] of params.entries()) {
    if (v === null || typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v))) continue;
    if (v instanceof Uint8Array) {
      if (v.byteLength > MAX_BLOB_BYTES) throw new RangeError(`db param ${i} is ${v.byteLength} bytes; max is ${MAX_BLOB_BYTES}`);
      continue;
    }
    throw new TypeError(`db param ${i} has unsupported type ${typeof v}`);
  }
  return params as Params;
}

/**
 * کلید رمزگذاری دیتابیس: تصادفی، یک بار ساخته می‌شود و خودش با DPAPI ویندوز
 * (safeStorage) رمز می‌شود؛ پس فقط همین کاربرِ همین ویندوز می‌تواند دیتابیس را باز کند.
 */
function loadKey(dir: string): string {
  const file = path.join(dir, 'kelid.key');
  if (existsSync(file)) {
    const buf = readFileSync(file);
    return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(buf) : buf.toString('utf8');
  }
  const key = randomBytes(32).toString('hex');
  writeFileSync(file, safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(key) : Buffer.from(key, 'utf8'), { mode: 0o600 });
  return key;
}

let db: Database.Database | undefined;

export function openDatabase(): string {
  const dir = app.getPath('userData');
  const file = path.join(dir, 'kelid.db');
  db = openEncrypted(Database, file, loadKey(dir));

  const run = (sql: unknown, params: unknown) => {
    if (typeof sql !== 'string') throw new TypeError('db sql must be a string');
    const p = checkParams(params);
    const st = db!.prepare(sql);
    if (st.reader) return st.all(...p);
    st.run(...p);
    return [];
  };

  ipcMain.handle('db:all', (_e, sql: unknown, params: unknown) => run(sql, params));
  ipcMain.handle('db:tx', (_e, statements: Array<{ sql: unknown; params?: unknown }>) => {
    if (!Array.isArray(statements)) throw new TypeError('db statements must be an array');
    db!.transaction(() => {
      for (const s of statements) run(s.sql, s.params);
    })();
  });
  ipcMain.handle('db:exec', (_e, sql: string) => {
    db!.exec(sql);
  });
  return file;
}

export function closeDatabase() {
  db?.close();
  db = undefined;
}
