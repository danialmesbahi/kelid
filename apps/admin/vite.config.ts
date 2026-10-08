import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// پنل فروشنده جدا از برنامهٔ دفترها ساخته و منتشر می‌شود (نشانی خودش، مثلاً admin.kelid.ir) تا هیچ‌چیزش در برنامهٔ مشتری نباشد.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5174, strictPort: true },
  preview: { port: 4174, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true },
});
