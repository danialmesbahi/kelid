// حساب‌های پنل فروشنده (src/admin/cli.ts): می‌سازد و همان‌جا اجرا می‌کند. راهنما در بالای cli.ts.
import { existsSync } from 'node:fs';
import { build } from 'esbuild';

const rootEnv = new URL('../../../.env', import.meta.url);
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
process.env.DATABASE_URL ??= 'postgres://kelid_app:kelid_app@localhost:5433/kelid';

await build({
  entryPoints: ['src/admin/cli.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['pg'],
  outfile: 'dist/admin/cli.js',
  logLevel: 'warning',
});
await import(new URL('../dist/admin/cli.js', import.meta.url).href);
