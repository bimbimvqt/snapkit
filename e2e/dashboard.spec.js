import { test, expect } from '@playwright/test';

test('device manager boots devices and saves one or two IDE selections; app controls are absent', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.device-card')).toHaveCount(6);
  await expect(page.locator('#console-output, #devtools-page, #sessions-page, #screenshots-page')).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Select iPhone 16 Pro for IDE debug', exact: true }).check();
  await expect(page.locator('#stat-selected')).toHaveText('1');
  await page.getByRole('checkbox', { name: 'Select Pixel 9 Pro for IDE debug', exact: true }).check();
  await expect(page.locator('#stat-selected')).toHaveText('2');
  await expect(page.locator('#ide-summary')).toContainText('Project files unchanged');
  await page.locator('#ide-use-dashboard').uncheck();
  await expect(page.locator('#ide-summary')).toContainText('normal debug configuration');
  await expect(page.locator('#stat-selected')).toHaveText('2');
  await page.locator('#ide-use-dashboard').check();
  await expect(page.locator('#ide-summary')).toContainText('Project files unchanged');
  await page.getByRole('checkbox', { name: 'Select Pixel 9 Pro for IDE debug', exact: true }).uncheck();
  await expect(page.locator('#stat-selected')).toHaveText('1');
  const offline = page.locator('[data-device="demo-android-2"]');
  await expect(offline.getByRole('checkbox')).toBeDisabled();
  await offline.getByRole('button', { name: 'Start device', exact: true }).click();
  await expect(offline.getByRole('checkbox')).toBeEnabled();
  await page.getByRole('tab', { name: 'Android emulators' }).click();
  await expect(page.locator('.device-card')).toHaveCount(2);
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
  const current = await page.request.get('/api/state').then(r => r.json());
  await page.locator('#online-only').check();
  await expect(page.locator('.device-card')).toHaveCount(current.devices.filter(d => d.state === 'online').length);
  await page.locator('#online-only').uncheck();
  await page.getByRole('button', { name: 'Switch appearance' }).click();
  await expect(page.locator('html')).toHaveClass('light');
  for (const width of [1440, 1024, 768, 390, 375]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#settings-button').click();
  await expect(page.getByRole('dialog', { name: '' }).filter({ has: page.locator('#workspace-form') })).toBeVisible();
  await page.locator('#workspace-dialog .close-dialog').first().click();
});

test('workspace folder chooser fills path; model selector enforces iOS runtime compatibility', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.device-card')).toHaveCount(6);
  await page.locator('#settings-button').click();
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
  const created = page.locator('.device-card').filter({ hasText: 'My iPhone Test' });
  await expect(created).toBeVisible();
  await expect(page.locator('[data-device="demo-physical-1"] [data-action="delete"]')).toHaveCount(0);
  await created.getByRole('button', { name: 'Delete My iPhone Test', exact: true }).click();
  await expect(page.locator('#delete-device-name')).toHaveText('My iPhone Test');
  await expect(page.locator('#delete-device-note')).toContainText('cannot be undone');
  await page.locator('#delete-device-dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(created).toBeVisible();
  await created.getByRole('button', { name: 'Delete My iPhone Test', exact: true }).click();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.locator('#delete-device-dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.locator('#delete-device-submit').click();
  await expect(page.locator('#delete-device-dialog')).not.toBeVisible();
  await expect(created).toHaveCount(0);
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
test('missing iOS runtime opens recovery tools, filters Apple versions and blocks legacy downloads', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add device', exact: true }).click();
  await page.locator('#create-model').selectOption('demo:iphone8');
  await expect(page.locator('#runtime-downloads')).toHaveAttribute('open', '');
  await expect(page.locator('#ios-model-help')).toContainText('11.0.0–16.9.0');
  await page.getByRole('button', { name: 'Load Apple iOS versions' }).click();
  await expect(page.locator('#ios-download-choice option')).toHaveCount(1);
  await expect(page.locator('#ios-download-version')).toHaveValue('16.4');
  await expect(page.locator('#download-ios-runtime')).toBeEnabled();
  await page.locator('#ios-download-version').fill('18.5');
  await expect(page.locator('#download-ios-runtime')).toBeDisabled();
  await page.getByRole('button', { name: 'Open Xcode', exact: true }).click();
  await expect(page.locator('.toast').last()).toContainText('Components');
  await page.locator('#create-model').selectOption('legacy:iphone-5');
  await expect(page.locator('#download-ios-runtime')).toBeDisabled();
  await expect(page.locator('#load-ios-versions')).toBeDisabled();
  await page.getByRole('button', { name: 'Choose a supported model' }).click();
  await expect(page.locator('#create-model')).toHaveValue('demo:iphone16');
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.locator('#create-dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});
test('local Dashboard explicitly generates a website pairing link and revokes it', async ({ page }) => {
  await page.goto('/');
  await page.locator('#connection-button').click();
  await expect(page.locator('#pairing-code')).toHaveText(/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
  await expect(page.locator('#pairing-link')).toHaveAttribute('href', /^https:\/\/bimbimvqt\.github\.io\/snapkit\/control\/#pair=/);
  await page.getByRole('button', { name: 'Revoke all website connections' }).click();
  await expect(page.locator('#pairing-code')).toHaveText('Connections revoked');
});

test('workspace imports a debug profile and submits flavor, entrypoint and defines file together', async ({ page }) => {
  await page.route('**/api/workspace/profiles?*', route => route.fulfill({ json: { flavors: ['dev', 'prod'], profiles: [{ name: 'Merchant dev', flavor: 'dev', target: 'lib/main_dev.dart', defineFile: '../dashboard/dev.json' }] } }));
  let saved;
  await page.route('**/api/workspace', route => {
    saved = route.request().postDataJSON();
    return route.fulfill({ json: { settings: saved, message: 'Configuration saved' } });
  });
  await page.goto('/');
  await page.locator('#settings-button').click();
  await page.locator('#workspace-path').fill('/Projects/merchant');
  await page.locator('#workspace-path').dispatchEvent('change');
  await page.locator('#workspace-profile').selectOption({ label: 'Merchant dev' });
  await expect(page.locator('#workspace-flavor')).toHaveValue('dev');
  await expect(page.locator('#workspace-target')).toHaveValue('lib/main_dev.dart');
  await expect(page.locator('#workspace-defines')).toHaveValue('../dashboard/dev.json');
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.locator('#workspace-dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.getByRole('button', { name: 'Save IDE setup' }).click();
  await expect(page.locator('#workspace-dialog')).not.toBeVisible();
  expect(saved).toEqual({ path: '/Projects/merchant', flavor: 'dev', target: 'lib/main_dev.dart', defineFile: '../dashboard/dev.json' });
});
