import { expect, test } from '@playwright/test';

/** قراردادها: شروع معامله از پروندهٔ فایل، رفتن به مرحلهٔ بعد، و ماندن بعد از تازه کردن صفحه. */
test('start a deal from a file and move it along', async ({ page }) => {
  await page.goto('/#/files');
  await page.getByRole('link', { name: 'فایل جدید' }).click();
  await page.getByLabel('محله').fill('دروس');
  await page.getByLabel('خیابان').fill('ناطق نوری');
  await page.getByLabel('متراژ').fill('۱۴۰');
  await page.getByLabel('قیمت کل (تومان)').fill('۳۰۰۰۰۰۰۰۰۰۰');
  await page.getByRole('button', { name: 'ثبت فایل' }).click();
  await expect(page.getByRole('heading', { name: 'آپارتمان ۱۴۰ متری' })).toBeVisible();

  await page.getByRole('link', { name: 'شروع معامله' }).click();
  await page.getByRole('button', { name: 'شروع معامله' }).click();
  const panel = page.getByRole('dialog', { name: 'پروندهٔ معامله' });
  await expect(panel.getByRole('heading', { name: 'آپارتمان ۱۴۰ متری' })).toBeVisible();
  // کمیسیون پیشنهادی: نیم درصد از هر طرف
  await expect(panel.getByText('۳۰۰ میلیون')).toBeVisible();
  await panel.getByRole('button', { name: /رفتن به «بیعانه»/ }).click();
  await expect(page.getByText('معامله به «بیعانه» رفت')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();

  await page.reload();
  await expect(page.getByRole('region', { name: 'بیعانه' }).getByRole('button', { name: /آپارتمان ۱۴۰ متری/ })).toBeVisible();
});
