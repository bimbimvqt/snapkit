import { test, expect } from '@playwright/test';
test('detailed guide navigates to real actions, translates and fits a narrow window', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await page.goto('/?lang=en'); await page.locator('#guide-button').click();
  await expect(page.locator('#panel-guide')).toBeVisible(); await expect(page.locator('.guide-chapter')).toHaveCount(8);
  await page.locator('#guide-sets [data-go="sets"]').click(); await expect(page.locator('#panel-sets')).toBeVisible();
  await page.evaluate(() => window.SnapkitI18n.setLanguage('vi')); await expect(page.locator('#panel-sets h1')).toHaveText('Bộ thiết bị');
  await page.locator('#guide-button').click(); await expect(page.locator('#guide-tools h2')).toHaveText('Chuẩn bị máy tính');
  await page.setViewportSize({ width: 900, height: 680 }); await page.screenshot({ path: '/tmp/snapkit-guide-beta14.png', fullPage: true, animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
test('device sets start offline members, then explicitly select ready devices for IDE', async ({ page }) => {
  await page.goto('/?lang=en'); await page.locator('.sidebar [data-app-page="sets"]').click();
  await page.locator('#set-name').fill('Daily test'); await page.locator('#set-devices input[value="demo-ios-2"]').check(); await page.locator('#set-devices input[value="demo-android-1"]').check();
  await page.locator('#set-form button[type="submit"]').click(); const set = page.locator('#set-list article').filter({ has: page.getByRole('heading', { name: 'Daily test', exact: true }) });
  await expect(set).toBeVisible(); await set.locator('[data-set-start]').click(); await expect(page.locator('#set-jobs')).toContainText('Finished');
  await set.locator('[data-set-select]').click(); await expect(page.locator('#stat-selected')).toHaveText('2');
  page.once('dialog', dialog => dialog.accept()); await set.locator('[data-set-delete]').click(); await expect(set).toHaveCount(0);
});
test('device card logs filter and export, screenshots preview and download within current project', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await page.goto('/?lang=en');
  await page.locator('[data-device="demo-android-1"] [data-tool-action="logs"]').click();
  await expect(page.locator('#log-output')).toContainText('Sample system log');
  await page.locator('#log-level').selectOption('warning'); await expect(page.locator('#log-output')).not.toContainText('Sample system log'); await expect(page.locator('#log-output')).toContainText('Sample warning');
  await page.screenshot({ path: '/tmp/snapkit-logs-beta14.png', fullPage: true, animations: 'disabled' });
  const download = page.waitForEvent('download'); await page.locator('#log-export').click(); expect((await download).suggestedFilename()).toMatch(/Snapkit-logs.*\.txt/);
  await page.locator('#log-stop').click(); await expect(page.locator('#log-status')).toHaveText('Stopped');
  await page.locator('.sidebar [data-app-page="devices"]').click(); await page.locator('[data-device="demo-android-1"] [data-tool-action="screenshot"]').click();
  const capture = page.locator('#capture-list article').first(); await expect(capture).toContainText('Pixel 9 Pro'); await capture.locator('[data-capture-preview]').click(); await expect(capture.locator('img')).toBeVisible();
  expect(await capture.locator('img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  const file = page.waitForEvent('download'); await capture.locator('[data-capture-download]').click(); expect((await file).suggestedFilename()).toMatch(/Snapkit-.*\.png/);
  page.once('dialog', dialog => dialog.accept()); await capture.locator('[data-capture-delete]').click(); await expect(page.locator('#capture-list')).toContainText('No captures');
  await page.screenshot({ path: '/tmp/snapkit-captures-beta14.png', fullPage: true, animations: 'disabled' }); expect(errors).toEqual([]);
});
