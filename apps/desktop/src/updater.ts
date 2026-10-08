import { app, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater, type UpdateInfo } from 'electron-updater';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { verifyUpdate } from './updateSignature';

export type UpdatePhase = 'off' | 'idle' | 'checking' | 'downloading' | 'ready' | 'error';
export interface UpdateState {
  phase: UpdatePhase;
  current: string;
  /** نسخهٔ تازه‌ای که در راه یا آماده است. */
  version?: string;
  percent?: number;
  notes?: string;
  /** همین اجرا اولین بار بعد از به‌روزرسانی است. */
  justUpdated?: { version: string; notes: string };
}

// اولین بررسی کمی بعد از باز شدن، تا شروع برنامه کند نشود؛ بعد هر چند ساعت یک بار تا وقتی برنامه باز است.
const FIRST_CHECK_MS = 20_000;
const EVERY_MS = 4 * 60 * 60_000;
const NOTES_MAX = 4000;

let state: UpdateState = { phase: 'off', current: app.getVersion() };

function set(patch: Partial<UpdateState>) {
  state = { ...state, ...patch };
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('update:state', state);
}

/** یادداشت نسخه فقط متن ساده است (هرگز HTML اجرا نمی‌شود) و کوتاه. */
function notesOf(info: UpdateInfo): string {
  const raw = Array.isArray(info.releaseNotes) ? info.releaseNotes.map((n) => n.note ?? '').join('\n') : (info.releaseNotes ?? '');
  return raw.replace(/<[^>]*>/g, '').trim().slice(0, NOTES_MAX);
}

/** نشانی سرور و کلید عمومی امضا کنار برنامه (build/update.json)؛ خالی یعنی به‌روزرسانی خودکار خاموش. */
function readConfig(): { url: string; publicKey: string } | null {
  try {
    const c = JSON.parse(readFileSync(path.join(process.resourcesPath, 'update.json'), 'utf8')) as { url?: unknown; publicKey?: unknown };
    if (typeof c.url !== 'string' || typeof c.publicKey !== 'string' || !c.publicKey) return null;
    return new URL(c.url).protocol === 'https:' ? { url: c.url, publicKey: c.publicKey } : null;
  } catch {
    return null;
  }
}

export function startUpdater() {
  const pendingFile = path.join(app.getPath('userData'), 'update-pending.json');
  // نسخه‌ای که دفعهٔ قبل دریافت شد و حالا نصب شده: یک بار «تازه‌ها» نشان داده می‌شود.
  try {
    if (existsSync(pendingFile)) {
      const p = JSON.parse(readFileSync(pendingFile, 'utf8')) as { version?: string; notes?: string };
      if (p.version === app.getVersion()) state.justUpdated = { version: p.version, notes: p.notes ?? '' };
      if (p.version === app.getVersion() || !p.version) rmSync(pendingFile, { force: true });
    }
  } catch {
    rmSync(pendingFile, { force: true });
  }

  ipcMain.handle('update:get', () => state);
  ipcMain.handle('update:check', () => {
    if (state.phase === 'idle' || state.phase === 'error') void autoUpdater.checkForUpdates().catch(() => {});
  });
  // فقط وقتی خود کاربر خواست؛ وگرنه نصب بی‌صدا هنگام بستن برنامه است.
  ipcMain.handle('update:install', () => {
    if (state.phase === 'ready') autoUpdater.quitAndInstall(true, true);
  });

  const config = app.isPackaged ? readConfig() : null;
  if (!config) return;

  // تنظیمات electron-updater در پوشهٔ برنامه، تا نشانی سرور فقط از update.json بیاید.
  const configPath = path.join(app.getPath('userData'), 'app-update.yml');
  writeFileSync(configPath, `provider: generic\nurl: ${JSON.stringify(config.url)}\nupdaterCacheDirName: kelid-updater\n`);
  autoUpdater.updateConfigPath = configPath;
  autoUpdater.autoDownload = true;
  // تا امضای نسخه سنجیده نشده، هیچ نصبی هنگام بستن برنامه انجام نمی‌شود.
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.disableWebInstaller = true;

  autoUpdater.on('checking-for-update', () => state.phase !== 'ready' && set({ phase: 'checking' }));
  autoUpdater.on('update-not-available', () => set({ phase: 'idle', version: undefined, percent: undefined, notes: undefined }));
  autoUpdater.on('update-available', (info) => set({ phase: 'downloading', version: info.version, percent: 0, notes: notesOf(info) }));
  autoUpdater.on('download-progress', (p) => set({ phase: 'downloading', percent: Math.floor(p.percent) }));
  // همزمان با همین رویداد (پیش از ثبت نصب هنگام بستن) سنجیده می‌شود؛ پس نسخهٔ نامعتبر هیچ‌وقت نصب نمی‌شود.
  autoUpdater.on('update-downloaded', (info) => {
    const ok = verifyUpdate(config.publicKey, info as UpdateInfo & { kelidSignature?: unknown });
    autoUpdater.autoInstallOnAppQuit = ok;
    if (!ok) {
      console.error(`update ${info.version} rejected: bad signature`);
      return set({ phase: 'error', version: undefined, percent: undefined, notes: undefined });
    }
    const notes = notesOf(info);
    try {
      writeFileSync(pendingFile, JSON.stringify({ version: info.version, notes }));
    } catch {
      // فقط «تازه‌ها»ی بعد از نصب از دست می‌رود.
    }
    set({ phase: 'ready', version: info.version, percent: 100, notes });
  });
  // نبودن اینترنت یا سرور در دسترس نیست: کاربر هیچ پیامی نمی‌بیند؛ دور بعد دوباره.
  autoUpdater.on('error', (e) => {
    console.error('update check failed:', e instanceof Error ? e.message : String(e));
    if (state.phase !== 'ready') set({ phase: 'error', percent: undefined });
  });

  set({ phase: 'idle' });
  const check = () => {
    if (state.phase === 'ready' || state.phase === 'downloading') return;
    void autoUpdater.checkForUpdates().catch(() => {});
  };
  setTimeout(check, FIRST_CHECK_MS);
  setInterval(check, EVERY_MS);
}
