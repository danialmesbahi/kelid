import { expect, test } from '@playwright/test';

// بار اول: آشنایی باز می‌شود؛ بقیهٔ تست‌ها آن را با storageState رد می‌کنند.
test.use({ storageState: { cookies: [], origins: [] } });

test('first run welcome saves the name and greets on Today', async ({ page }) => {
  await page.goto('/');
  const dlg = page.getByRole('dialog', { name: 'به کلید خوش آمدید' });
  await expect(dlg).toBeVisible();
  await page.getByRole('button', { name: 'شروع آشنایی' }).click();
  await page.getByLabel('نام شما').fill('علی رضایی');
  await page.getByLabel('نام دفتر').fill('املاک پارسا');
  await page.getByRole('button', { name: 'ادامه' }).click();
  await page.getByRole('radio', { name: 'درشت', exact: true }).click();
  await page.getByRole('button', { name: 'ادامه' }).click();
  await page.getByRole('button', { name: 'ورود به کلید' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('، علی');

  // بعد از بارگذاری دوباره دیگر نمی‌آید
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('، علی');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
