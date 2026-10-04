import { app, ipcMain, safeStorage } from 'electron';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import Database from 'better-sqlite3-multiple-ciphers';
import { openEncrypted } from '@kelid/core/node';

type Params = Array<string | number | null | Uint8Array>;

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

  const run = (sql: string, params: Params = []) => {
    const st = db!.prepare(sql);
    if (st.reader) return st.all(...params);
    st.run(...params);
    return [];
  };

  ipcMain.handle('db:all', (_e, sql: string, params?: Params) => run(sql, params));
  ipcMain.handle('db:tx', (_e, statements: Array<{ sql: string; params?: Params }>) => {
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
