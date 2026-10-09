import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ command, mode }) => {
  // نسخه‌ای که به سرور واقعی وصل است بی کلید عمومی مجوز، همهٔ دفترها را فقط‌خواندنی می‌کند؛ ساختنش را همین‌جا می‌بندیم.
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'VITE_');
  const api = env.VITE_KELID_API_URL ?? '';
  const remote = api !== '' && api !== 'demo' && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(api);
  if (command === 'build' && remote && !env.VITE_KELID_LICENSE_KEY) {
    throw new Error('VITE_KELID_LICENSE_KEY is required when VITE_KELID_API_URL points to a real server (see .env.example).');
  }
  return config;
});

const config = {
  // نسخهٔ برنامه برای گزارش خطا و نظر کاربر
  define: { __KELID_VERSION__: JSON.stringify((JSON.parse(readFileSync(new URL('package.json', import.meta.url), 'utf8')) as { version: string }).version) },
  plugins: [
    react(),
    // نصب روی گوشی و کار بدون اینترنت. Service Worker را خود برنامه فقط در وب ثبت می‌کند (main.tsx)، نه در ویندوز.
    VitePWA({
      injectRegister: false,
      // نسخهٔ تازه با تأیید کاربر فعال می‌شود (pwa.tsx)، نه با تازه شدن ناگهانی صفحه
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'icons/apple-touch-icon.png'],
      manifest: {
        id: './',
        name: 'کلید — سامانهٔ فایل املاک',
        short_name: 'کلید',
        description: 'فایل‌ها، مشتری‌ها و بازدیدهای دفتر املاک؛ روی همین دستگاه و بدون اینترنت.',
        lang: 'fa',
        dir: 'rtl',
        start_url: './',
        scope: './',
        display: 'standalone',
        theme_color: '#0E4D3F',
        background_color: '#EFEEEA',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // پوستهٔ برنامه، SQLite (wasm) و فونت‌ها از قبل ذخیره می‌شوند تا بدون اینترنت هم باز شود.
        globPatterns: ['**/*.{js,css,html,wasm,woff2,png,ico,webmanifest}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  // مسیر نسبی تا خروجی در Electron (file://) هم درست بارگذاری شود.
  base: './',
  server: { port: 5173, strictPort: true },
  // فایل wasm باید همان‌طور که هست سرو شود؛ پیش‌بسته‌بندی Vite آن را خراب می‌کند.
  optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
  worker: { format: 'es' },
  build: { outDir: 'dist', emptyOutDir: true },
} satisfies UserConfig;
