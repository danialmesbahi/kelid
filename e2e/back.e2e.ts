import { expect, test } from '@playwright/test';

/** دکمهٔ «برگشت» و «بستن» دقیقاً به صفحهٔ قبلی می‌روند، نه به یک صفحهٔ ثابت. */
test('back and close return to the exact previous page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  // بستن فرم فایل جدید = برگشت به «امروز»، نه «فایل‌ها»
  await page.getByRole('link', { name: 'فایل جدید' }).click();
  await page.getByRole('button', { name: 'بستن' }).click();
  await expect(page).toHaveURL(/:4173\/(#\/)?$/);

  await page.getByRole('link', { name: 'فایل جدید' }).click();
  await page.getByLabel('محله').fill('الهیه');
  await page.getByLabel('متراژ').fill('۱۲۰');
  await page.getByRole('button', { name: 'ثبت فایل' }).click();
  await expect(page.getByRole('heading', { name: 'آپارتمان ۱۲۰ متری' })).toBeVisible();
  // فایلی که از «امروز» باز شده زیر همان تب می‌ماند
  const nav = page.getByRole('navigation', { name: 'منوی اصلی' }).first();
  await expect(nav.getByRole('link', { name: 'امروز' })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: /فایل‌ها/ })).not.toHaveAttribute('aria-current', 'page');

  // ویرایش و ذخیره، بعد برگشت: یک بار برگشت باید به «امروز» برسد، نه دوباره به همین فایل
  await page.getByRole('link', { name: 'ویرایش' }).click();
  await page.getByLabel('خیابان').fill('فرشته');
  await page.getByRole('button', { name: 'ذخیرهٔ تغییرات' }).click();
  await expect(page.getByRole('heading', { name: 'آپارتمان ۱۲۰ متری' })).toBeVisible();
  await page.getByRole('button', { name: 'برگشت' }).click();
  await expect(page).toHaveURL(/:4173\/(#\/)?$/);

  // دکمهٔ برگشت مرورگر هم همان مسیر را برمی‌گردد
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'آپارتمان ۱۲۰ متری' })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/:4173\/(#\/)?$/);
});
