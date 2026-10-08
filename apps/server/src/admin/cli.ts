import { randomBytes, randomUUID } from 'node:crypto';
import { createPool, withVendor } from '../db';
import { hashPassword } from '../auth/password';
import { normalizePhone } from '../auth/phone';
import { newTotpSecret, totpUri } from './totp';
import { kickVendor } from '../sync/live';

// حساب‌های پنل فروشنده فقط از همین خط فرمان ساخته می‌شوند؛ هیچ مسیر ثبت‌نامی روی اینترنت ندارند.
//   npm run admin -w @kelid/server -- add --phone 09121234567 --name "مهدی"
//   npm run admin -w @kelid/server -- reset --phone 09121234567   (رمز و کد دومرحله‌ای تازه، قفل باز)
//   npm run admin -w @kelid/server -- disable --phone 09121234567
//   npm run admin -w @kelid/server -- list
// روی سرور: node dist/admin/cli.js <همان فرمان‌ها> با همان DATABASE_URL سرور.

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

/** رمز و کلید کد دومرحله‌ای فقط همین یک بار چاپ می‌شوند؛ جای دیگری ذخیره نمی‌شوند (رمز فقط به شکل هش). */
function printSecrets(phone: string, password: string, secret: string) {
  console.log(`
شماره:  ${phone}
رمز:    ${password}
کلید کد دومرحله‌ای (در Google Authenticator یا برنامهٔ مشابه: «وارد کردن کلید راه‌اندازی»، نوع «بر پایهٔ زمان»):
        ${secret.replace(/(.{4})/g, '$1 ').trim()}
یا این نشانی را به QR تبدیل کنید:
        ${totpUri(secret, phone)}

این‌ها را همین حالا جای امنی نگه دارید؛ دوباره نشان داده نمی‌شوند.`);
}

async function main() {
  const cmd = process.argv[2];
  const url = process.env.DATABASE_URL;
  if (!url) fail('DATABASE_URL تنظیم نشده است');
  const pool = createPool(url);
  try {
    if (cmd === 'list') {
      const rows = await withVendor(
        pool,
        async (db) =>
          (
            await db.query<{ phone: string; name: string; disabled_at: Date | null; last_login_at: Date | null }>(
              'select phone, name, disabled_at, last_login_at from vendor_admins order by created_at',
            )
          ).rows,
      );
      if (!rows.length) console.log('هنوز حسابی ساخته نشده است.');
      for (const r of rows) console.log(`${r.phone}  ${r.name}  ${r.disabled_at ? 'غیرفعال' : 'فعال'}  آخرین ورود: ${r.last_login_at?.toISOString() ?? '-'}`);
      return;
    }

    const phone = normalizePhone(arg('phone'));
    if (!phone) fail('شمارهٔ موبایل را با --phone 09xxxxxxxxx بدهید');

    if (cmd === 'add') {
      const name = arg('name')?.trim();
      if (!name || name.length > 100) fail('نام را با --name "نام" بدهید');
      const password = randomBytes(18).toString('base64url');
      const secret = newTotpSecret();
      const hash = await hashPassword(password);
      const added = await withVendor(pool, async (db) => {
        const r = await db.query(
          'insert into vendor_admins (id, phone, name, password_hash, totp_secret) values ($1, $2, $3, $4, $5) on conflict (phone) do nothing',
          [randomUUID(), phone, name, hash, secret],
        );
        return r.rowCount === 1;
      });
      if (!added) fail('این شماره از قبل حساب دارد؛ برای رمز تازه از reset استفاده کنید');
      printSecrets(phone, password, secret);
      return;
    }

    if (cmd === 'reset') {
      const password = randomBytes(18).toString('base64url');
      const secret = newTotpSecret();
      const hash = await hashPassword(password);
      const done = await withVendor(pool, async (db) => {
        const r = await db.query(
          `update vendor_admins set password_hash = $2, totp_secret = $3, totp_last_step = 0, failed_logins = 0,
                  locked_until = null, disabled_at = null where phone = $1`,
          [phone, hash, secret],
        );
        return r.rowCount === 1;
      });
      if (!done) fail('حسابی با این شماره نیست');
      printSecrets(phone, password, secret);
      return;
    }

    if (cmd === 'disable') {
      const done = await withVendor(
        pool,
        async (db) => {
          const r = await db.query<{ id: string }>('update vendor_admins set disabled_at = now() where phone = $1 returning id', [phone]);
          // پنجره‌های باز پنل همان لحظه بسته می‌شوند.
          if (r.rows[0]) await kickVendor(db, r.rows[0].id);
          return r.rowCount === 1;
        },
      );
      if (!done) fail('حسابی با این شماره نیست');
      console.log('حساب غیرفعال شد؛ ورودهای باز همان لحظه بیرون می‌افتند.');
      return;
    }

    fail('فرمان: add | reset | disable | list');
  } finally {
    await pool.end();
  }
}

main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  fail(/vendor_admins/.test(msg) && /does not exist/.test(msg) ? 'جدول‌ها هنوز ساخته نشده‌اند؛ یک بار سرور را اجرا کنید (npm run dev:server).' : msg);
});
