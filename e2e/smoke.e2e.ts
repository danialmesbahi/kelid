import { expect, test } from '@playwright/test';

/** مسیر اصلی یک مشاور: ثبت فایل ← پیدا کردن با Ctrl+K ← بعد از تازه کردن صفحه هنوز هست. */
test('add a file, find it with Ctrl+K, and keep it after reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('ذخیره روی همین مرورگر')).toBeVisible();

  await page.getByRole('link', { name: 'فایل جدید' }).click();
  await page.getByLabel('محله').fill('الهیه');
  await page.getByLabel('خیابان').fill('فرشته');
  await page.getByLabel('متراژ').fill('۱۸۵');
  await page.getByLabel('قیمت کل (تومان)').fill('۶۵۰۰۰۰۰۰۰۰۰');
  await page.getByRole('button', { name: 'ثبت فایل' }).click();
  await expect(page.getByRole('heading', { name: 'آپارتمان ۱۸۵ متری' })).toBeVisible();
  await expect(page.getByText('۶۵ میلیارد')).toBeVisible();

  const search = async (q: string) => {
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: 'جستجوی سراسری' });
    await dialog.getByLabel('جستجو').fill(q);
    await expect(dialog.getByRole('option', { name: /آپارتمان ۱۸۵ متری/ })).toBeVisible();
    return dialog;
  };

  const dialog = await search('الهیه');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'آپارتمان ۱۸۵ متری' })).toBeVisible();
  // جستجو با نام خیابان و ارقام فارسی/عربی
  await search('فرشته');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'آپارتمان ۱۸۵ متری' })).toBeVisible();
});
