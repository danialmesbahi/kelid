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
npm run setup
```

این دستور یک‌جا همه کارها را انجام می‌دهد:
- وابستگی‌ها را نصب می‌کند؛
- hook گیت را می‌گذارد تا جلوی push مستقیم به `main` را بگیرد؛
- graphify و دستور `/graphify` را برای Claude Code نصب می‌کند (اگر uv نصب باشد)؛
- typecheck و تست‌ها را اجرا می‌کند.

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

کارها در [GitHub Issues](https://github.com/danialmesbahi/kelid/issues) هستند. نمای کلی و تقسیم کار در [ROADMAP.md](ROADMAP.md) آمده است.

1. در Claude Code بنویسید `/kelid-task`. یک issue آزاد پیشنهاد می‌دهد، آن را به اسم شما می‌کند و شاخهٔ `feat/<شماره>-<نام>` می‌سازد.
2. کار کنید. `/kelid-ship` بررسی‌ها را اجرا می‌کند، push می‌کند و Pull Request با `Closes #N` می‌سازد.
3. هم‌تیمی PR را بازبینی می‌کند. وقتی CI سبز شد، با squash merge ادغام می‌شود.
4. هر وقت هم‌تیمی چیزی merge کرد، `/kelid-sync` تغییرات main را به شاخهٔ شما می‌آورد و تداخل‌ها را طبق قانون حل می‌کند.
5. اگر روی دادهٔ دیتابیس تغییر دادید، فقط migration تازه اضافه کنید؛ migration قبلی را هرگز ویرایش نکنید.

ایجنت‌های دیگر مثل Codex و Cursor همین مراحل را از فایل‌های `.claude/skills/*/SKILL.md` می‌خوانند (AGENTS.md به آن‌ها اشاره می‌کند).

## ۵. مشکلات رایج

| نشانه | راه‌حل |
|---|---|
| هشدار `install scripts blocked … better-sqlite3-multiple-ciphers (node-gyp rebuild)` | **عادی است؛ تأییدش نکنید.** این ماژول نسخهٔ آماده دارد و اسکریپتش فقط سعی می‌کند با Visual Studio دوباره بسازد |
| بستهٔ دیگری install script مسدودشده دارد (npm ۱۲) | `npm install-scripts approve <نام بسته>` و بستهٔ تأییدشده در `allowScripts` فایل `package.json` ریشه ثبت می‌شود |
| برنامهٔ ویندوزِ نصب‌شده باز نمی‌شود | نسخهٔ dev (`npm run dev:desktop`) هنوز باز است؛ اول آن را ببندید |
| در مرورگر پیام «تب دیگری باز است» | کلید را فقط در یک تب باز نگه دارید |
| تست‌ها با `Missing field moduleType` خطا می‌دهند | نسخهٔ اصلی Vite در `apps/web` و Vitest باید یکی باشد |
| `npm run dist:win` دنبال Visual Studio می‌گردد | `npmRebuild: false` در `apps/desktop/package.json` نباید حذف شود |

## ۶. داده‌های برنامه روی سیستم شما

- ویندوز: `%APPDATA%\Kelid\kelid.db` (رمزگذاری‌شده) و `kelid.key` (قفل‌شده با حساب ویندوز شما). برای شروع از صفر هر دو را پاک کنید.
- وب: از DevTools مرورگر ← Application ← Storage ← Clear site data.
