// سرور در حالت توسعه: با هر ذخیرهٔ فایل دوباره ساخته و راه‌اندازی می‌شود.
// پیش‌فرض‌ها به PostgreSQL محلی compose.yaml وصل می‌شوند (npm run db:up)؛ ‎.env‎ ریشه آن‌ها را عوض می‌کند.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { context } from 'esbuild';

const rootEnv = new URL('../../../.env', import.meta.url);
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
process.env.DATABASE_URL ??= 'postgres://kelid_app:kelid_app@localhost:5433/kelid';
process.env.MIGRATION_DATABASE_URL ??= 'postgres://kelid_owner:kelid_owner@localhost:5433/kelid';
process.env.LOG_LEVEL ??= 'debug';

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
  packages: 'external',
  sourcemap: true,
  outfile: 'dist/main.js',
  logLevel: 'info',
  plugins: [restart],
});
await ctx.watch();
