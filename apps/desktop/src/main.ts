import { app, BrowserWindow, dialog, Menu, screen, shell } from 'electron';
import path from 'node:path';
import { closeDatabase, openDatabase } from './database';
import { registerSessionStore } from './session';
import { startUpdater } from './updater';

const DEV_URL = process.env.KELID_DEV_URL;

// پوشهٔ اطلاعات برنامه در ویندوز: %APPDATA%\Kelid (دیتابیس رمزگذاری‌شده و کلیدش اینجاست).
app.setName('Kelid');
app.setPath('userData', path.join(app.getPath('appData'), 'Kelid'));

function webEntry(): string {
  // در نسخهٔ نصب‌شده، رابط کاربری کنار برنامه در پوشهٔ resources/web است؛
  // در اجرای بدون نصب، خروجی ساخته‌شدهٔ apps/web.
  return app.isPackaged
    ? path.join(process.resourcesPath, 'web', 'index.html')
    : path.join(__dirname, '..', '..', 'web', 'dist', 'index.html');
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const win = new BrowserWindow({
    width: Math.min(1440, width),
    height: Math.min(940, height),
    minWidth: 1024,
    minHeight: 680,
    title: 'کلید',
    backgroundColor: '#EFEEEA',
    // در نسخهٔ نصب‌شده آیکون داخل خود exe است؛ این فقط برای اجرای توسعه است تا نوار وظیفه آیکون Electron نشان ندهد.
    icon: app.isPackaged ? undefined : path.join(__dirname, '..', 'build', 'icon.ico'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  win.once('ready-to-show', () => win.show());

  // لینک‌های بیرونی در مرورگر سیستم باز شوند، نه داخل برنامه.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    const allowed = DEV_URL ? url.startsWith(DEV_URL) : url.startsWith('file://');
    if (!allowed) e.preventDefault();
  });

  if (DEV_URL) void win.loadURL(DEV_URL);
  else void win.loadFile(webEntry());
}

// یک نسخه از برنامه کافی است؛ اجرای دوباره همان پنجره را جلو می‌آورد.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    if (!DEV_URL) Menu.setApplicationMenu(null);
    try {
      openDatabase();
    } catch (err) {
      dialog.showErrorBox('کلید', `دیتابیس باز نشد.
${err instanceof Error ? err.message : String(err)}`);
      app.quit();
      return;
    }
    registerSessionStore();
    startUpdater();
    createWindow();
  });

  app.on('before-quit', closeDatabase);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
