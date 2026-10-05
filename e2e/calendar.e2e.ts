import { expect, test } from '@playwright/test';

/** تقویم: ثبت قرار برای روز انتخاب‌شده و ماندنش بعد از تازه کردن صفحه. */
test('add a visit for a picked day and keep it after reload', async ({ page }) => {
  await page.goto('/#/calendar');
  await page.getByRole('button', { name: 'ماه بعد' }).click();
  const day = page.locator('.cal-d:not(.out)').nth(9);
  await day.click();
  await expect(day).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'قرار تازه' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('عنوان').fill('بازدید آزمایشی تقویم');
  await dialog.getByRole('button', { name: 'ثبت قرار' }).click();
  await expect(dialog).toBeHidden();

  const row = page.getByRole('button', { name: /بازدید: بازدید آزمایشی تقویم/ });
  await expect(row).toBeVisible();
  await expect(day).toHaveAttribute('aria-label', /۱ قرار/);

  await page.reload();
  await expect(page.getByRole('button', { name: /بازدید: بازدید آزمایشی تقویم/ })).toBeVisible();
});
