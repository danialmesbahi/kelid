# راه‌اندازی روی سرور واقعی (پیش‌انتشار)

فهرست کامل چیزهایی که برای بالا آمدن کلید روی سرور لازم است. متغیرها و پیش‌فرض‌هایشان در `.env.example` توضیح داده شده‌اند؛
سرور در `NODE_ENV=production` بدون تنظیمات امن بالا نمی‌آید و می‌گوید چه چیزی کم است (`apps/server/src/config.ts`).

## ۱. چیزهایی که باید تهیه شود
| چه | برای چه | نکته |
|---|---|---|
| سرور لینوکس با Node 22 و PostgreSQL 16 | API و دیتابیس | سرور در ایران تا برای کاربر سریع و در دسترس باشد |
| چهار دامنه با گواهی HTTPS | دامنهٔ اصلی سایت معرفی، `app.` برنامهٔ وب، `api.` سرور، `admin.` پنل فروشنده | مثلاً kelid.ir، app.kelid.ir، api.kelid.ir، admin.kelid.ir |
| حساب کاوه‌نگار + یک قالب «تأیید» با یک `%token` | پیامک کد ورود | قالب باید پیش از انتشار تأیید شده باشد |
| مرچنت زرین‌پال (با اینماد) | پرداخت اشتراک | نشانی بازگشت = `PUBLIC_URL` همان سرور |
| فضای ذخیره‌سازی S3 (آروان، لیارا…) با سطل **خصوصی** | عکس فایل‌ها | بدون آن عکس‌ها در PostgreSQL می‌مانند؛ برای شروع هم کار می‌کند |
| پشتیبان‌گیری روزانهٔ دیتابیس (`pg_dump`) بیرون از همان سرور | جلوگیری از گم شدن اطلاعات دفترها | بازگردانی را یک بار امتحان کنید |

## ۲. دیتابیس
1. نقش‌ها و دیتابیس را با `apps/server/db/init.sql` بسازید، ولی **رمزها را عوض کنید** (رمزهای آن فایل فقط برای توسعه‌اند).
2. `kelid_owner` جدول‌ها را می‌سازد (migrationها هنگام بالا آمدن سرور خودکار اجرا می‌شوند) و `kelid_app` فقط ردیف می‌خواند و می‌نویسد؛ سرور با نقش superuser بالا نمی‌آید.

## ۳. سرور (`apps/server`)
```sh
npm ci
npm run build -w @kelid/server
npm run license-keys -w @kelid/server   # یک بار؛ نیمهٔ خصوصی → LICENSE_PRIVATE_KEY، نیمهٔ عمومی → VITE_KELID_LICENSE_KEY
NODE_ENV=production node --enable-source-maps apps/server/dist/main.js   # با systemd یا pm2 همیشه روشن بماند
```
متغیرهای لازم در production:
`DATABASE_URL`، `MIGRATION_DATABASE_URL`، `JWT_SECRET` (`openssl rand -base64 48`)، `SMS_PROVIDER=kavenegar` + `KAVENEGAR_API_KEY` + `KAVENEGAR_TEMPLATE`،
`LICENSE_PRIVATE_KEY`، `PAYMENT_GATEWAY=zarinpal` + `ZARINPAL_MERCHANT_ID`، `PUBLIC_URL=https://api.kelid.ir`،
`CORS_ORIGINS=https://app.kelid.ir,https://admin.kelid.ir,null` (`null` = برنامهٔ ویندوز)، `TRUST_PROXY=true` پشت nginx، و در صورت داشتن S3 هر چهار `S3_*`.

سرور در production به‌طور پیش‌فرض روی هر هستهٔ پردازنده یک پروسه بالا می‌آورد (حداکثر ۸)؛ `WEB_CONCURRENCY` عددش را عوض می‌کند.
هر پروسه تا ۱۰ اتصال دیتابیس باز می‌کند، پس `max_connections` در Postgres باید از `۱۰ × WEB_CONCURRENCY` به‌اضافهٔ چند اتصال برای خودتان بیشتر باشد (پیش‌فرض ۱۰۰ تا ۸ پروسه کافی است).
pm2 را در حالت fork بگذارید، نه cluster؛ خود سرور پروسه‌هایش را می‌سازد.

حساب پنل فروشنده فقط از خط فرمان سرور ساخته می‌شود: `npm run admin -w @kelid/server -- add --phone 09xxxxxxxxx --name "…"` (رمز و کد TOTP یک بار چاپ می‌شود).

## ۴. برنامهٔ وب و پنل فروشنده
```sh
VITE_KELID_API_URL=https://api.kelid.ir VITE_KELID_LICENSE_KEY=… npm run build -w @kelid/web     # خروجی: apps/web/dist
VITE_ADMIN_API_URL=https://api.kelid.ir npm run build -w @kelid/admin                              # خروجی: apps/admin/dist
npm run build -w @kelid/site                                                                       # سایت معرفی kelid.ir، خروجی: apps/site/dist
```
سایت معرفی پیش‌فرض‌هایش را دارد (`VITE_SITE_*` در `.env.example`). پلن‌ها و قیمت‌ها را موقع ساخت و در مرورگر از `GET /plans` سرور (`VITE_SITE_API_URL`) می‌خواند و پنل فروشنده عوضشان می‌کند؛ نصب‌کنندهٔ ویندوز را کنار آن در `download/Kelid-Setup.exe` بگذارید.
هر سه پوشه ایستا هستند و nginx همان‌ها را سرو می‌کند. برنامهٔ ویندوز هم با همین دو متغیر ساخته می‌شود (`npm run dist:win`).

## ۵. nginx
```nginx
# api.kelid.ir → سرور Node
location / {
  proxy_pass http://127.0.0.1:3000;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  client_max_body_size 8m;          # هم‌اندازهٔ سقف خود سرور برای /sync/push
  proxy_buffering off;              # جریان زندهٔ /sync/events و /admin/events
  proxy_read_timeout 1h;
}

# app.kelid.ir → apps/web/dist
root /srv/kelid/web;
location = /index.html { add_header Cache-Control "no-cache"; include kelid-headers.conf; }
location = /sw.js      { add_header Cache-Control "no-cache"; }
location /assets/      { add_header Cache-Control "public, max-age=31536000, immutable"; }
```
`kelid-headers.conf` برای برنامهٔ وب (با همین سیاست امتحان شده و هیچ خطایی نداد):
```nginx
add_header Strict-Transport-Security "max-age=31536000" always;
add_header X-Content-Type-Options nosniff always;
add_header Referrer-Policy no-referrer always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' 'sha256-BNMZ7lUPlOUJHuJ8Er1yCVuWDnmjct9uIuf/aNP2vag='; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self' https://api.kelid.ir; worker-src 'self' blob:; manifest-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" always;
```
اگر اسکریپت کوچک داخل `apps/web/index.html` (اعمال پوسته پیش از نمایش) عوض شد، hash بالا را دوباره بسازید:
`node -e "const s=require('fs').readFileSync('apps/web/dist/index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];console.log('sha256-'+require('crypto').createHash('sha256').update(s).digest('base64'))"`

## ۶. برنامهٔ ویندوز
کلید امضای به‌روزرسانی، `apps/desktop/build/update.json` (نشانی https فایل‌های نسخه) و انتشار: docs/ARCHITECTURE.md → «Releasing the Windows app».

## ۷. پیش از باز کردن برای دفترها
- ثبت‌نام، ورود با رمز، ورود با کد پیامکی و «فراموش کردید؟» را با یک شمارهٔ واقعی امتحان کنید.
- یک پرداخت واقعی کم‌مبلغ از درگاه زرین‌پال و برگشت به برنامه.
- همگام‌سازی بین گوشی و کامپیوتر، و آمدن عکس‌ها.
- بازگردانی یک پشتیبان دیتابیس روی یک سرور دیگر.
