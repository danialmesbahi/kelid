import { defineConfig, devices } from '@playwright/test';

/**
 * تست سرتاسری روی خروجی ساخته‌شدهٔ وب (همان چیزی که کاربر می‌گیرد): npm run e2e
 * دیتابیس وب روی OPFS است؛ هر تست زمینهٔ مرورگر تازه و دیتابیس خالی دارد.
 */
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    locale: 'fa-IR',
    timezoneId: 'Asia/Tehran',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build -w @kelid/web && npm run preview -w @kelid/web -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
