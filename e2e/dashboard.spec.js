import { test, expect } from '@playwright/test';

test('device filters, target, session lifecycle, and tools work together', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.device-card')).toHaveCount(6);
  await expect(page.locator('#demo-notice')).toBeVisible();
  await page.getByRole('tab', { name: 'Android emulators' }).click();
  await expect(page.locator('.device-card')).toHaveCount(2);
  await page.getByRole('button', { name: 'Set target', exact: true }).first().click();
  await expect(page.locator('.device-card.target')).toContainText('Pixel 9 Pro');
  await page.getByRole('button', { name: 'Run app', exact: true }).click();
  await page.getByRole('button', { name: /Running sessions/ }).click();
  await expect(page.locator('.session-row')).toContainText('running');
  await page.getByRole('button', { name: 'Hot reload', exact: true }).click();
  await expect(page.locator('.toast').last()).toContainText('reload completed');
  await page.getByRole('button', { name: 'Hot reload all', exact: false }).click();
  await expect(page.locator('.toast').last()).toContainText('1/1');
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.locator('.session-row')).toContainText('stopped');
  await page.getByRole('button', { name: /Device manager/ }).click();
  await page.getByRole('button', { name: 'Tools for Pixel 9 Pro', exact: true }).click();
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await page.getByRole('button', { name: 'Resize', exact: true }).click();
  await expect(page.locator('.toast').last()).toContainText('window-size');
  await page.locator('#tools-dialog .close-dialog').click();
  await page.getByRole('button', { name: 'Screenshots', exact: true }).click();
  await expect(page.locator('#screenshot-grid')).toContainText('Demo mode does not generate captures');
  expect(errors).toEqual([]);
});

test('responsive dashboard, search, keyboard navigation, and light theme', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.device-card')).toHaveCount(6);
  await page.keyboard.press('/');
  await expect(page.getByRole('searchbox')).toBeFocused();
  await page.getByRole('searchbox').fill('iPad');
  await expect(page.locator('.device-card')).toHaveCount(1);
  await page.getByRole('searchbox').fill('');
  await page.locator('#online-only').check();
  await expect(page.locator('.device-card')).toHaveCount(3);
  await page.locator('#online-only').uncheck();
  await page.getByRole('button', { name: 'Switch appearance' }).click();
  await expect(page.locator('html')).toHaveClass('light');
  for (const width of [1440, 1024, 768, 390, 375]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Workspace settings' }).click();
  await expect(page.getByRole('dialog', { name: '' }).filter({ has: page.locator('#workspace-form') })).toBeVisible();
  await page.locator('#workspace-dialog .close-dialog').first().click();
});

test('workspace folder chooser fills path; model selector enforces iOS runtime compatibility', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.device-card')).toHaveCount(6);
  await page.getByRole('button', { name: 'Workspace settings' }).click();
  await page.getByRole('button', { name: 'Choose folder' }).click();
  await expect(page.locator('#workspace-path')).toHaveValue('/Volumes/SanDiskSSDData/flutter_projects/demo_app');
  await page.locator('#workspace-dialog .close-dialog').first().click();
  await page.getByRole('button', { name: 'Add device', exact: true }).click();
  await expect(page.locator('#create-model')).toBeVisible();
  await page.locator('#create-model').selectOption('legacy:iphone-5');
  await expect(page.locator('#compatibility-note')).toContainText('32-bit');
  await expect(page.getByRole('button', { name: 'Create device', exact: true })).toBeDisabled();
  await page.locator('#create-model').selectOption('demo:iphone17');
  await expect(page.locator('#create-runtime option')).toHaveCount(1);
  await expect(page.locator('#create-runtime')).toHaveValue('demo:ios26');
  await page.locator('#create-name').fill('My iPhone Test');
  await page.getByRole('button', { name: 'Create device', exact: true }).click();
  await expect(page.locator('.device-card').filter({ hasText: 'My iPhone Test' })).toBeVisible();
});

test('Android image must be installed before creating a device and modal fits mobile', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add device', exact: true }).click();
  await expect(page.locator('#create-model')).toBeVisible();
  await page.locator('[data-create-platform="android"]').click();
  await page.locator('#create-runtime').selectOption('system-images;android-34;google_apis;arm64-v8a');
  await expect(page.locator('#create-device-submit')).toBeDisabled();
  await page.getByRole('button', { name: 'Install image', exact: true }).click();
  await expect(page.locator('#create-device-submit')).toBeEnabled();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.locator('#create-dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});
