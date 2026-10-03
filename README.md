# کلید — سامانهٔ فایل املاک

برنامهٔ ویندوز، وب و موبایل (PWA) برای دفترهای املاک.

| سند | برای |
|---|---|
| [docs/ONBOARDING.md](docs/ONBOARDING.md) | هم‌تیمی تازه: نصب، اجرا، روند کار تیمی، مشکلات رایج |
| [AGENTS.md](AGENTS.md) | قوانین پروژه برای ایجنت‌های هوش مصنوعی و آدم‌ها (Claude Code از راه [CLAUDE.md](CLAUDE.md)) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | جریان داده، نقشهٔ ماژول‌ها، مسیرها، دستورالعمل افزودن صفحه و فیلد |
| [docs/TECH_STACK.md](docs/TECH_STACK.md) | دلیل انتخاب هر فناوری و نقشهٔ فازها |
| [graphify-out/GRAPH_REPORT.md](graphify-out/GRAPH_REPORT.md) | گراف دانش پروژه (نودها، گروه‌ها، ارتباط‌ها) |
| [docs/ROADMAP.md](docs/ROADMAP.md) | فازها، کارهای باز و تقسیم کار بین هم‌تیمی‌ها |

## شروع سریع با Claude Code

پیش‌نیاز: Node 22+، Git و GitHub CLI که با `gh auth login` وارد حساب دارای دسترسی به این مخزن شده باشد. این متن را به Claude Code بدهید:

> Clone https://github.com/danialmesbahi/kelid into this folder, open it, run `npm run setup`, then read AGENTS.md and docs/ROADMAP.md and show me the open Phase 1 issues so I can pick one with /kelid-task.

بعد از آن روند هر کار: `/kelid-task` ← کد ← `/kelid-ship`. اگر هم‌تیمی چیزی merge کرد: `/kelid-sync`.

## ساختار

```
apps/web       رابط کاربری (React + Vite) — مشترک بین وب، گوشی و ویندوز
apps/desktop   پوستهٔ ویندوز (Electron) و ساخت فایل نصب
packages/core  مدل داده، جستجوی فارسی، تطبیق مشتری و فایل، لایهٔ داده
packages/ui    سیستم طراحی (توکن‌های رنگ، پلاک، آیکون‌ها، اجزا)
```

## اجرا

```bash
npm install
```

```bash
npm run dev
```
نسخهٔ وب روی http://localhost:5173 باز می‌شود.

```bash
npm run dev:desktop
```
برنامهٔ ویندوز در حالت توسعه.

```bash
npm test
```

```bash
npm run dist:win
```
فایل نصب ویندوز (`.exe`) در `apps/desktop/release` ساخته می‌شود.

## میانبرها

- `Ctrl+K` جستجوی سراسری (فایل، مشتری، کار)
- `Ctrl+N` فایل جدید
- در حالت نمایش به مشتری: `←` و `→` برای فایل بعدی و قبلی، `Esc` برای پایان

## داده‌ها کجا ذخیره می‌شوند

| نسخه | دیتابیس | محل |
|---|---|---|
| ویندوز | SQLite رمزگذاری‌شده (SQLCipher v4، AES-256)؛ کلیدش با DPAPI ویندوز محافظت می‌شود | `%APPDATA%\Kelid\kelid.db` |
| وب و گوشی | SQLite WASM روی حافظهٔ ماندگار مرورگر (OPFS) در یک Worker | حافظهٔ همان مرورگر |

- هر تغییر در جدول `outbox` هم ثبت می‌شود تا در فاز ۲ با سرور همگام شود.
- ساختار دیتابیس با مهاجرت‌های شماره‌دار در `packages/core/src/sql/schema.ts` تعریف می‌شود. مهاجرت قبلی را هرگز ویرایش نکنید؛ همیشه مهاجرت تازه اضافه کنید.
- دادهٔ نمونه فقط در اولین اجرا وارد می‌شود و از «تنظیمات» پاک می‌شود.
- کلید در هر لحظه فقط در یک تب مرورگر می‌تواند به دیتابیس وصل شود. تب‌های دیگر پیام می‌دهند.

## وضعیت

فاز ۰ تمام شده است. در فاز ۱ دیتابیس ماندگار، حرکت‌ها و فایل نصب آماده‌اند. باقی‌ماندهٔ فاز ۱: عکس‌ها، ویرایش فایل و ثبت مشتری.
