import { expect, test } from '@playwright/test';

/** تقویم: ثبت قرار از تقویم، جابه‌جایی با صفحه‌کلید و ماندن بعد از تازه کردن صفحه. */
test('add a visit from the calendar and move it with the keyboard', async ({ page }) => {
  await page.goto('/#/calendar?v=week');
  await expect(page.getByRole('group', { name: 'نمای تقویم' })).toBeVisible();

  await page.getByRole('button', { name: 'قرار تازه' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('عنوان').fill('بازدید آزمایشی تقویم');
  await dialog.getByRole('button', { name: 'ثبت قرار' }).click();
  await expect(dialog).toBeHidden();

  const ev = page.getByRole('button', { name: /بازدید: بازدید آزمایشی تقویم/ });
  await expect(ev).toBeVisible();
  const before = await ev.getAttribute('aria-label');
  await ev.focus();
  await page.keyboard.press('Alt+ArrowDown');
  await expect(page.getByRole('button', { name: 'برگرداندن' })).toBeVisible();
  await expect(ev).not.toHaveAttribute('aria-label', before ?? '');

  const moved = await ev.getAttribute('aria-label');
  await page.reload();
  await expect(page.getByRole('button', { name: moved ?? '' })).toBeVisible();
});
