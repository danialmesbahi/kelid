// سرور در حالت توسعه: با هر ذخیرهٔ فایل دوباره ساخته و راه‌اندازی می‌شود.
// پیش‌فرض‌ها به PostgreSQL محلی compose.yaml وصل می‌شوند (npm run db:up)؛ ‎.env‎ ریشه آن‌ها را عوض می‌کند.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { context } from 'esbuild';

const rootEnv = new URL('../../../.env', import.meta.url);
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
process.env.DATABASE_URL ??= 'postgres://kelid_app:kelid_app@localhost:5433/kelid';
process.env.MIGRATION_DATABASE_URL ??= 'postgres://kelid_owner:kelid_owner@localhost:5433/kelid';
process.env.LOG_LEVEL ??= 'debug';
// فقط توسعه: کلید تازه در هر اجرا (توکن‌های کوتاه‌عمر باطل می‌شوند، ورود دستگاه‌ها می‌ماند).
process.env.JWT_SECRET ??= randomBytes(48).toString('base64');
process.env.CORS_ORIGINS ??= 'http://localhost:5173,http://127.0.0.1:5173,null';

let child;
const start = () => {
  child = spawn(process.execPath, ['--enable-source-maps', 'dist/main.js'], { stdio: 'inherit' });
};
const restart = {
  name: 'restart',
  setup(build) {
    build.onEnd((result) => {
      if (result.errors.length) return;
      if (!child || child.exitCode !== null) return start();
      // صبر تا پورت آزاد شود، بعد نمونهٔ تازه.
      child.once('exit', start);
      child.kill('SIGTERM');
    });
  },
};

const ctx = await context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  // کتابخانه‌های npm بیرون می‌مانند؛ @kelid/core (TypeScript خام) داخل بسته می‌آید.
  external: ['fastify', 'pg'],
  sourcemap: true,
  outfile: 'dist/main.js',
  logLevel: 'info',
  plugins: [restart],
});
await ctx.watch();
