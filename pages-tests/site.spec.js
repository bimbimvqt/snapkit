import { test, expect } from '@playwright/test';
test('Pages works under a project prefix and preview never calls local APIs', async ({ page }) => {
  const errors = [], apiRequests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (r.url().includes('/api/')) apiRequests.push(r.url()); });
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Mọi thiết bị. Một nơi điều khiển.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Mở Dashboard local' })).toHaveAttribute('href', 'http://127.0.0.1:4310/');
  await page.getByRole('link', { name: 'Khám phá Dashboard' }).click();
  await expect(page.locator('#server-status')).toHaveText('Static preview · sample data');
  await expect(page.locator('.device-card')).toHaveCount(6);
  await page.locator('[data-device="demo-ios-1"] [data-action="run"]').click();
  await expect(page.locator('.toast')).toContainText('Preview only');
  await page.getByRole('button', { name: 'Add device', exact: true }).click();
  await expect(page.locator('#create-model')).toContainText('iPhone 5');
  await expect(page.locator('#create-storage-label')).toHaveText('iOS DATA ON INTERNAL DISK');
  expect(errors).toEqual([]); expect(apiRequests).toEqual([]);
});
test('landing and preview fit a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const url of ['./', 'preview/']) {
    await page.goto(url);
    await expect(page.locator('h1')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
