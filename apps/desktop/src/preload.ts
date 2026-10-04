import { contextBridge, ipcRenderer } from 'electron';

type Params = Array<string | number | null | Uint8Array>;

/**
 * پل امن بین رابط کاربری و ویندوز. رابط کاربری مستقیم به فایل‌ها دسترسی ندارد؛
 * فقط از همین چند تابع استفاده می‌کند.
 */
contextBridge.exposeInMainWorld('kelid', {
  platform: 'desktop' as const,
  db: {
    all: (sql: string, params?: Params) => ipcRenderer.invoke('db:all', sql, params),
    transaction: (statements: Array<{ sql: string; params?: Params }>) => ipcRenderer.invoke('db:tx', statements),
    execScript: (sql: string) => ipcRenderer.invoke('db:exec', sql),
  },
});
