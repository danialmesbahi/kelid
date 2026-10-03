# راه‌اندازی برای هم‌تیمی‌ها

این راهنما شما را از یک ویندوز خالی به برنامهٔ در حال اجرا می‌رساند. حدود ۱۵ دقیقه طول می‌کشد.

## ۱. پیش‌نیازها

| ابزار | نسخه | چرا |
|---|---|---|
| [Node.js](https://nodejs.org) | ۲۲ یا بالاتر (همراهش npm ۱۰+ نصب می‌شود) | اجرای پروژه |
| [Git](https://git-scm.com) | هر نسخهٔ جدید | گرفتن کد |
| [GitHub CLI](https://cli.github.com) | اختیاری | ساخت PR از ترمینال |
| [uv](https://docs.astral.sh/uv/) + graphify | اختیاری ولی پیشنهادی | گراف پروژه برای ایجنت‌های هوش مصنوعی |
| VS Code یا Cursor | — | ویرایشگر |

به Visual Studio یا Python برای ساخت ماژول‌ها نیازی نیست. ماژول SQLite رمزگذاری‌شده نسخهٔ آماده (prebuilt) دارد.

## ۲. گرفتن و اجرای پروژه

```bash
git clone https://github.com/danialmesbahi/kelid.git
```

```bash
cd kelid
```

```bash
npm install
```

```bash
npm run dev
```

نسخهٔ وب روی http://localhost:5173 باز می‌شود. برای نسخهٔ ویندوز:

```bash
npm run dev:desktop
```

قبل از هر Pull Request:

```bash
npm run typecheck
```

```bash
npm test
```

## ۳. کار با ایجنت هوش مصنوعی

- **Claude Code** فایل `CLAUDE.md` را خودکار می‌خواند (که خودش `AGENTS.md` را وارد می‌کند).
- **Codex، Cursor، Copilot، Gemini** و بقیه `AGENTS.md` را می‌خوانند.
- قوانین پروژه (داده، طراحی، امنیت، گیت) همه در `AGENTS.md` است. اگر قانون تازه‌ای گذاشتید، همان‌جا بنویسید تا همهٔ ایجنت‌ها ببینند.

### گراف پروژه (graphify)

پوشهٔ `graphify-out/` نقشهٔ کامل پروژه است: هر فایل، تابع، کلاس و مفهوم یک نود است و رابطه‌ها یال‌اند.
ایجنت به‌جای خواندن ده‌ها فایل، اول گزارش گراف را می‌خواند. این یعنی توکن خیلی کمتر و جواب دقیق‌تر.

| فایل | کاربرد |
|---|---|
| `graphify-out/GRAPH_REPORT.md` | خلاصهٔ معماری: نودهای مرکزی، گروه‌ها، ارتباط‌های مهم |
| `graphify-out/graph.html` | نمایش تعاملی گراف؛ در مرورگر باز کنید |
| `graphify-out/graph.json` | دادهٔ خام گراف برای ابزارها |

نصب یک‌باره:

```bash
uv tool install graphifyy
```

```bash
graphify hook install
```

دستور دوم یک git hook نصب می‌کند که بعد از هر commit گراف را برای فایل‌های کد تغییرکرده به‌روز می‌کند (بدون هزینهٔ توکن).
اگر فایل‌های مستند (`.md`) را زیاد تغییر دادید، در Claude Code دستور `/graphify . --update` را بزنید.

نمونهٔ پرسش از گراف:

```bash
graphify query "فایل جدید چطور ذخیره می‌شود؟"
```

```bash
graphify affected "KelidStore"
```

## ۴. روند کار تیمی

1. از `main` شاخه بسازید: `feat/edit-listing` یا `fix/search-digits`.
2. کار کنید، `typecheck` و `test` را پاس کنید، برنامه را واقعاً باز کنید و ببینید.
3. Pull Request بزنید. GitHub Actions خودش typecheck و تست را اجرا می‌کند و تا سبز نشود merge نکنید.
4. اگر روی دادهٔ دیتابیس تغییر دادید، فقط migration تازه اضافه کنید؛ migration قبلی را هرگز ویرایش نکنید.

## ۵. مشکلات رایج

| نشانه | راه‌حل |
|---|---|
| `npm install` می‌گوید install script مسدود شد (npm ۱۲) | `npm install-scripts approve <نام بسته>` و بستهٔ تأییدشده در `allowScripts` فایل `package.json` ریشه ثبت می‌شود |
| برنامهٔ ویندوزِ نصب‌شده باز نمی‌شود | نسخهٔ dev (`npm run dev:desktop`) هنوز باز است؛ اول آن را ببندید |
| در مرورگر پیام «تب دیگری باز است» | کلید را فقط در یک تب باز نگه دارید |
| تست‌ها با `Missing field moduleType` خطا می‌دهند | نسخهٔ اصلی Vite در `apps/web` و Vitest باید یکی باشد |
| `npm run dist:win` دنبال Visual Studio می‌گردد | `npmRebuild: false` در `apps/desktop/package.json` نباید حذف شود |

## ۶. داده‌های برنامه روی سیستم شما

- ویندوز: `%APPDATA%\Kelid\kelid.db` (رمزگذاری‌شده) و `kelid.key` (قفل‌شده با حساب ویندوز شما). برای شروع از صفر هر دو را پاک کنید.
- وب: از DevTools مرورگر ← Application ← Storage ← Clear site data.
