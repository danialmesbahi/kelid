// انتشار نسخهٔ تازهٔ برنامهٔ ویندوز: بعد از `npm run dist:win`، فهرست latest.yml را با امضای دفتر کلید می‌سازد.
// استفاده: KELID_UPDATE_PRIVATE_KEY_FILE=... npm run release -w @kelid/desktop -- [--notes build/release-notes.md] [--staging 20]
// بعد سه فایل release/ را به همان ترتیبی که چاپ می‌شود روی سرور به‌روزرسانی بگذارید (latest.yml آخر از همه).
import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

const root = path.join(import.meta.dirname, '..');
const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

/** همان متن src/updateSignature.ts؛ هر دو باید یکی بمانند (آزمون updateSignature.test.ts). */
export const signedText = (version, sha512) => `kelid-update\n${version}\n${sha512}`;

/** latest.yml همان شکلی که electron-updater می‌خواند. */
export function manifest({ version, file, sha512, size, notes, staging, signature, date = new Date() }) {
  const lines = [
    `version: ${version}`,
    'files:',
    `  - url: ${file}`,
    `    sha512: '${sha512}'`,
    `    size: ${size}`,
    `path: ${file}`,
    `sha512: '${sha512}'`,
    `releaseDate: '${date.toISOString()}'`,
  ];
  if (notes) lines.push('releaseNotes: |-', ...notes.split(/\r?\n/).map((l) => `  ${l}`));
  if (staging !== undefined) lines.push(`stagingPercentage: ${staging}`);
  lines.push(`kelidSignature: '${signature}'`);
  return `${lines.join('\n')}\n`;
}

function main() {
  const { values } = parseArgs({ options: { notes: { type: 'string', default: 'build/release-notes.md' }, staging: { type: 'string' } } });

  const cfg = JSON.parse(readFileSync(path.join(root, 'build/update.json'), 'utf8'));
  if (!cfg.url || !cfg.publicKey) fail('build/update.json خالی است: نشانی سرور (url) و کلید عمومی (npm run update-keys) را بگذارید و دوباره dist:win بگیرید');
  if (!cfg.url.startsWith('https://')) fail('نشانی سرور به‌روزرسانی باید https باشد');

  const keyFile = process.env.KELID_UPDATE_PRIVATE_KEY_FILE || path.join(homedir(), '.kelid', 'update-private.pem');
  if (!existsSync(keyFile)) fail(`کلید خصوصی پیدا نشد: ${keyFile}`);
  const privateKey = createPrivateKey(readFileSync(keyFile));
  const publicKey = createPublicKey(privateKey).export({ format: 'der', type: 'spki' }).toString('base64');
  if (publicKey !== cfg.publicKey) fail('این کلید خصوصی با کلید عمومی build/update.json نمی‌خواند؛ برنامه‌های نصب‌شده این نسخه را نمی‌پذیرند');

  const { version } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const file = `Kelid-Setup-${version}.exe`;
  const exe = path.join(root, 'release', file);
  if (!existsSync(exe)) fail(`${file} در release/ نیست؛ اول npm run dist:win`);
  // نصب‌کنندهٔ ساخته‌شده باید همین تنظیمات را داشته باشد، وگرنه برنامه‌ها دیگر به‌روز نمی‌شوند.
  const packed = path.join(root, 'release', 'win-unpacked', 'resources', 'update.json');
  if (existsSync(packed) && readFileSync(packed, 'utf8') !== readFileSync(path.join(root, 'build/update.json'), 'utf8')) fail('update.json داخل نسخهٔ ساخته‌شده کهنه است؛ دوباره npm run dist:win');

  let staging;
  if (values.staging !== undefined) {
    staging = Number(values.staging);
    if (!Number.isInteger(staging) || staging < 1 || staging > 100) fail('--staging باید عددی بین 1 و 100 باشد (درصد دستگاه‌ها)');
  }
  const notesFile = path.resolve(root, values.notes);
  const notes = existsSync(notesFile) ? readFileSync(notesFile, 'utf8').trim() : '';
  if (!notes) console.warn(`! یادداشت نسخه (${values.notes}) خالی است؛ کاربران «تازه‌ها» نمی‌بینند`);

  const sha512 = createHash('sha512').update(readFileSync(exe)).digest('base64');
  const signature = sign(null, Buffer.from(signedText(version, sha512)), privateKey).toString('base64');
  writeFileSync(path.join(root, 'release', 'latest.yml'), manifest({ version, file, sha512, size: statSync(exe).size, notes, staging, signature }));

  const blockmap = existsSync(`${exe}.blockmap`) ? `${file}.blockmap` : null;
  console.log(`✓ release/latest.yml برای نسخهٔ ${version}${staging ? ` (${staging}٪ دستگاه‌ها)` : ''}`);
  console.log(`به ${cfg.url} بفرستید، به همین ترتیب:\n  1. ${file}${blockmap ? `\n  2. ${blockmap}` : ''}\n  ${blockmap ? 3 : 2}. latest.yml (آخر از همه)`);
  console.log('فایل‌های نسخه‌های قبل را پاک نکنید: دریافت تکه‌ای به blockmap آن‌ها نیاز دارد.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) main();
