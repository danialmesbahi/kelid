import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // نصب روی گوشی و کار بدون اینترنت. Service Worker را خود برنامه فقط در وب ثبت می‌کند (main.tsx)، نه در ویندوز.
    VitePWA({
      injectRegister: false,
      registerType: 'autoUpdate',
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
        orientation: 'portrait',
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
});
