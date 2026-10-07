import { app, ipcMain, safeStorage } from 'electron';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// نشست ورود هیچ‌وقت به شکل خوانا روی دیسک نمی‌رود؛ اگر DPAPI در دسترس نباشد فقط تا بستن برنامه می‌ماند.
const MAX_BYTES = 8 * 1024;

export function registerSessionStore() {
  const file = path.join(app.getPath('userData'), 'session.bin');
  let memory: string | null = null;

  ipcMain.handle('session:get', () => {
    if (!safeStorage.isEncryptionAvailable()) return memory;
    if (!existsSync(file)) return null;
    try {
      return safeStorage.decryptString(readFileSync(file));
    } catch {
      // فایل خراب یا مال کاربر دیگر ویندوز: مثل خارج شده رفتار می‌شود.
      return null;
    }
  });
  ipcMain.handle('session:set', (_e, value: unknown) => {
    if (typeof value !== 'string' || value.length > MAX_BYTES) throw new TypeError('session must be a short string');
    if (!safeStorage.isEncryptionAvailable()) {
      memory = value;
      return;
    }
    writeFileSync(file, safeStorage.encryptString(value), { mode: 0o600 });
  });
  ipcMain.handle('session:clear', () => {
    memory = null;
    rmSync(file, { force: true });
  });
}
