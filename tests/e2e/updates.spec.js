import { test, expect } from '@playwright/test';
test('in-app update controls show progress, separate install action and cache feedback in EN/VI', async ({ page }) => {
  await page.addInitScript(() => {
    let state = { status: 'idle', current: '0.2.0-beta.19' };
    window.snapkitDesktop = { setLanguage: async () => {}, ready: () => {},
      updateState: async () => state,
      checkUpdates: async () => state = { status: 'available', version: '0.2.0-beta.20' },
      downloadUpdate: async () => state = { status: 'downloading', version: '0.2.0-beta.20', received: 50, size: 100, percent: 50 },
      cancelUpdate: async () => state = { status: 'available', version: '0.2.0-beta.20' },
      installUpdate: async () => { throw Error('Finish builds, uploads, recordings and debugging before installing the update.'); },
      clearCache: async () => {},
      testReady: () => state = { status: 'ready', version: '0.2.0-beta.20' }
    };
  });
  await page.goto('/?lang=en'); await page.locator('[data-app-page="preferences"]').click();
  await page.locator('#check-updates').click(); await expect(page.locator('#update-download')).toBeVisible(); await expect(page.locator('#update-install')).toBeHidden();
  await page.locator('#update-download').click(); await expect(page.locator('#update-progress')).toHaveAttribute('value', '50'); await expect(page.locator('#update-cancel')).toBeVisible();
  await page.locator('#update-cancel').click(); await expect(page.locator('#update-download')).toBeVisible();
  await page.evaluate(() => window.snapkitDesktop.testReady()); await expect(page.locator('#update-install')).toBeVisible();
  await page.locator('#update-install').click(); await expect(page.locator('#update-detail')).toContainText('Finish builds');
  await page.locator('#clear-app-cache').click(); await expect(page.locator('#cache-result')).toHaveText('Temporary app cache cleared.');
  await page.evaluate(() => window.SnapkitI18n.setLanguage('vi')); await expect(page.locator('#update-install')).toHaveText('Khởi động lại và cài đặt');
  await expect(page.locator('#update-status')).toContainText('đã sẵn sàng để cài');
});
