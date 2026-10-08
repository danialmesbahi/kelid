// یک بار برای همیشه: جفت‌کلید امضای نسخه‌ها. کلید خصوصی فقط روی کامپیوتر انتشار می‌ماند (هرگز در مخزن)،
// کلید عمومی در build/update.json می‌رود تا هر برنامهٔ نصب‌شده فقط نسخه‌های امضاشده را بپذیرد.
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const keyFile = process.env.KELID_UPDATE_PRIVATE_KEY_FILE || path.join(homedir(), '.kelid', 'update-private.pem');
if (existsSync(keyFile)) {
  // کلید تازه یعنی همهٔ برنامه‌های نصب‌شده دیگر هیچ نسخه‌ای را نمی‌پذیرند.
  console.error(`✗ کلید از قبل هست: ${keyFile}. پاکش نکنید؛ از آن نسخهٔ پشتیبان امن بگیرید.`);
  process.exit(1);
}
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
mkdirSync(path.dirname(keyFile), { recursive: true });
writeFileSync(keyFile, privateKey.export({ format: 'pem', type: 'pkcs8' }), { mode: 0o600, flag: 'wx' });

const cfgFile = path.join(import.meta.dirname, '..', 'build', 'update.json');
const cfg = JSON.parse(readFileSync(cfgFile, 'utf8'));
cfg.publicKey = publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
writeFileSync(cfgFile, `${JSON.stringify(cfg, null, 2)}\n`);
console.log(`✓ کلید خصوصی: ${keyFile} (از آن پشتیبان امن بگیرید؛ گم شدنش یعنی برنامه‌های نصب‌شده دیگر به‌روز نمی‌شوند)`);
console.log('✓ کلید عمومی در build/update.json نوشته شد؛ نشانی سرور (url) را هم همان‌جا بگذارید و commit کنید.');
