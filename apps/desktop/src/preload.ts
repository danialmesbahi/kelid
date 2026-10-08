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
  session: {
    get: () => ipcRenderer.invoke('session:get'),
    set: (value: string) => ipcRenderer.invoke('session:set', value),
    clear: () => ipcRenderer.invoke('session:clear'),
  },
  updates: {
    get: () => ipcRenderer.invoke('update:get'),
    check: () => ipcRenderer.invoke('update:check'),
    install: () => ipcRenderer.invoke('update:install'),
    // فقط خود وضعیت به صفحه می‌رسد، نه رویداد IPC (که فرستنده را هم دارد).
    onChange: (fn: (state: unknown) => void) => {
      const listener = (_e: unknown, s: unknown) => fn(s);
      ipcRenderer.on('update:state', listener);
      return () => void ipcRenderer.removeListener('update:state', listener);
    },
  },
});
