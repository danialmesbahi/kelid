/* global process, URL, Image, document, Buffer, console -- اسکریپت Node که بخشی از آن در مرورگر اجرا می‌شود */
// عکس واقعی برنامه برای سایت: برنامهٔ وب در حال اجرا (npm run dev) را با دادهٔ نمونه باز می‌کند
// و از صفحه‌ها در اندازهٔ دسکتاپ و گوشی عکس WebP می‌گیرد تا پیش‌نمایش سایت همیشه همان طراحی امروز برنامه باشد.
// اجرا پیش از هر انتشار سایت: npm run shots -w @kelid/site   (نشانی دیگر: KELID_APP_URL=…)
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const app = process.env.KELID_APP_URL ?? 'http://localhost:5173';
const out = fileURLToPath(new URL('../public/art/', import.meta.url));

// نوار وضعیت آیفون در خود قاب سایت کشیده می‌شود؛ عکس گوشی از زیر آن شروع می‌شود.
const SHOTS = [
  { name: 'app-desktop', width: 1280, height: 800, scale: 2, tab: 'فایل‌ها', widths: [1280, 2560] },
  { name: 'app-phone', width: 390, height: 797, scale: 2, tab: 'فایل‌ها', widths: [780] },
  // کارت‌های «چهار قدم»: هر قدم همان صفحهٔ برنامه در اندازهٔ گوشی
  { name: 'step-add', width: 430, height: 560, scale: 2, clicks: ['ثبت فایل جدید'], widths: [860] },
  { name: 'step-clients', width: 430, height: 560, scale: 2, tab: 'مشتری‌ها', widths: [860] },
  { name: 'step-calendar', width: 430, height: 560, scale: 2, tab: 'تقویم', widths: [860] },
  { name: 'step-deals', width: 430, height: 560, scale: 2, clicks: ['بیشتر', 'قراردادها'], widths: [860] },
];

const browser = await chromium.launch({ channel: 'chrome' });
for (const s of SHOTS) {
  const ctx = await browser.newContext({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: s.scale, colorScheme: 'light', locale: 'fa-IR', timezoneId: 'Asia/Tehran' });
  const page = await ctx.newPage();
  await page.goto(app, { waitUntil: 'networkidle' });
  // اولین بار: آشنایی را رد می‌کنیم تا دادهٔ نمونه بماند.
  const later = page.getByText('بعداً').first();
  if (await later.count()) await later.click();
  if (s.tab) await page.getByRole('link', { name: s.tab }).first().click();
  // صفحه‌هایی که در نوار پایین گوشی نیستند: با همان دکمه‌هایی که کاربر می‌زند («ثبت فایل جدید»، «بیشتر»).
  for (const name of s.clicks ?? []) {
    await page.getByRole('link', { name }).or(page.getByRole('button', { name })).first().click();
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(1500);
  const png = (await page.screenshot()).toString('base64');
  for (const w of s.widths) {
    // تبدیل به WebP با خود مرورگر؛ وابستگی تازه‌ای لازم نیست.
    const webp = await page.evaluate(
      async ({ png, w }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${png}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = w;
        c.height = Math.round((img.height * w) / img.width);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        return c.toDataURL('image/webp', 0.86).split(',')[1];
      },
      { png, w },
    );
    writeFileSync(`${out}${s.name}-${w}.webp`, Buffer.from(webp, 'base64'));
    console.log(`${s.name}-${w}.webp`);
  }
  await ctx.close();
}
await browser.close();
