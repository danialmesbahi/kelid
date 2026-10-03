# نقشهٔ راه و تقسیم کار

منبع اصلی کارها **GitHub Issues** است: https://github.com/danialmesbahi/kelid/issues
هر کار یک issue دارد با هدف، محدوده، معیار پذیرش (Acceptance) و فایل‌های مرتبط. این صفحه فقط نمای کلی است.

## فازها

| فاز | هدف | Milestone |
|---|---|---|
| ۰ ✅ | پایهٔ پروژه، سیستم طراحی، قاب برنامه | — |
| ۱ 🟡 | کاملاً آفلاین روی یک دستگاه؛ قابل استفاده برای یک مشاور | [Phase 1](https://github.com/danialmesbahi/kelid/milestone/1) |
| ۲ | سرور، ورود با پیامک، همگام‌سازی چنددستگاهی | [Phase 2](https://github.com/danialmesbahi/kelid/milestone/2) |
| ۳ | دفترها و همکاران، اشتراک، پرداخت، پنل فروشنده | [Phase 3](https://github.com/danialmesbahi/kelid/milestone/3) |
| ۴ | تقویم، قراردادها، نقشه، به‌روزرسانی خودکار | [Phase 4](https://github.com/danialmesbahi/kelid/milestone/4) |
| ۵ | آزمایش با دفترهای واقعی | [Phase 5](https://github.com/danialmesbahi/kelid/milestone/5) |

## فاز ۱ — کارهای باز

| # | کار | اولویت |
|---|---|---|
| [#1](https://github.com/danialmesbahi/kelid/issues/1) | عکس فایل‌ها: افزودن، گرفتن با گوشی، ترتیب، نمایش | بالا |
| [#2](https://github.com/danialmesbahi/kelid/issues/2) | ویرایش فایل | بالا |
| [#3](https://github.com/danialmesbahi/kelid/issues/3) | ثبت و ویرایش مشتری | بالا |
| [#4](https://github.com/danialmesbahi/kelid/issues/4) | ثبت بازدید و کار | |
| [#5](https://github.com/danialmesbahi/kelid/issues/5) | نسخهٔ گوشی و نصب PWA | |
| [#6](https://github.com/danialmesbahi/kelid/issues/6) | آیکون برنامه و فایل نصب | |
| [#7](https://github.com/danialmesbahi/kelid/issues/7) | ESLint، Prettier و تست سرتاسری | |
| [#21](https://github.com/danialmesbahi/kelid/issues/21) | به‌روزرسانی Electron به نسخهٔ امن | بالا |
| [#8](https://github.com/danialmesbahi/kelid/issues/8) | تصمیم‌های صاحب کار (اینماد، سرور، درگاه، قیمت) | فقط صاحب کار |

## تقسیم کار پیشنهادی برای دو نفر هم‌زمان

کارها طوری تقسیم شده‌اند که کمترین فایل مشترک را داشته باشند:

| نفر الف: «فرم‌ها و داده» | نفر ب: «رسانه و دستگاه» |
|---|---|
| #2 ویرایش فایل ← #3 مشتری ← #4 بازدید و کار | #1 عکس‌ها ← #5 گوشی و PWA ← #6 آیکون |
| بیشتر در `pages/Add.tsx`، `Clients.tsx`، `Today.tsx` | بیشتر در `FileDetail.tsx`، `Show.tsx`، `vite.config.ts`، `apps/desktop` |

#21 (به‌روزرسانی Electron) قبل از ساخت فایل نصب بعدی لازم است و به نفر ب نزدیک‌تر است. #7 را هر کس زودتر آزاد شد برمی‌دارد.

**نقاط برخورد احتمالی** (قبل از شروع در issue هماهنگ کنید):
- `packages/core/src/sql/schema.ts`: هر دو نفر migration اضافه می‌کنند. کسی که دیرتر merge می‌کند، migration خودش را بعد از migration‌های main قرار می‌دهد (`/kelid-sync`).
- `packages/core/src/store.ts`: متدهای تازه را در انتهای بخش مربوط اضافه کنید، نه وسط کد دیگران.

## روند هر کار

```
issue  →  /kelid-task  →  کد + تست  →  /kelid-ship  →  PR  →  بازبینی هم‌تیمی + CI سبز  →  squash merge  →  همه: git pull
```

- هر issue یک شاخه و یک PR. PRها را کوچک نگه دارید (کمتر از یک روز کار).
- قبل از شروع، issue را به خودتان assign کنید تا هم‌تیمی آن را برندارد.
- push مستقیم به `main` ممنوع است. hook محلی جلویش را می‌گیرد، چون GitHub رایگان برای مخزن خصوصی قفل شاخه ندارد.
- کار تازه‌ای پیدا کردید؟ issue بسازید (`gh issue create`) و milestone و برچسب بزنید.

## طراحی

همهٔ صفحه‌ها (از جمله گوشی، ثبت‌نام، پلن‌ها، تمدید، حالت منقضی و پنل فروشنده) روی بوم طراحی کشیده شده‌اند:
https://claude.ai/artifact/HgeZgzpg7APUnbTYKKQXBt — صاحب کار باید دسترسی‌اش را با هم‌تیمی‌ها به اشتراک بگذارد.
قوانین طراحی که در کد اجباری‌اند در `AGENTS.md` آمده‌اند.
