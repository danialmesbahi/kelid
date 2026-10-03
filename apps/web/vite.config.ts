import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // مسیر نسبی تا خروجی در Electron (file://) هم درست بارگذاری شود.
  base: './',
  server: { port: 5173, strictPort: true },
  // فایل wasm باید همان‌طور که هست سرو شود؛ پیش‌بسته‌بندی Vite آن را خراب می‌کند.
  optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
  worker: { format: 'es' },
  build: { outDir: 'dist', emptyOutDir: true },
});
