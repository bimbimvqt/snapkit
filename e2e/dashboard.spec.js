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
  await page.getByRole('button', { name: 'Workspace settings' }).click();
  await page.locator('#workspace-path').fill('/Projects/merchant');
  await page.locator('#workspace-path').dispatchEvent('change');
  await page.locator('#workspace-profile').selectOption({ label: 'Merchant dev' });
  await expect(page.locator('#workspace-flavor')).toHaveValue('dev');
  await expect(page.locator('#workspace-target')).toHaveValue('lib/main_dev.dart');
  await expect(page.locator('#workspace-defines')).toHaveValue('../dashboard/dev.json');
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.locator('#workspace-dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.getByRole('button', { name: 'Save workspace' }).click();
  await expect(page.locator('#workspace-dialog')).not.toBeVisible();
  expect(saved).toEqual({ path: '/Projects/merchant', flavor: 'dev', target: 'lib/main_dev.dart', defineFile: '../dashboard/dev.json' });
});

test('console expands without losing logs, Escape restores it, and inline logs can be resized', async ({ page }) => {
  await page.goto('/');
  const logs = page.locator('#console-output');
  await expect(logs.locator('.log-line').first()).toBeVisible();
  const original = await logs.textContent();
  await page.getByRole('button', { name: 'Collapse console', exact: true }).click();
  await expect(logs).not.toBeVisible();
  await page.getByRole('button', { name: 'Expand console', exact: true }).click();
  await expect(page.locator('#console-dialog')).toBeVisible();
  await expect(logs).toBeVisible();
  expect(await logs.textContent()).toBe(original);
  expect(await logs.evaluate(el => el.clientHeight)).toBeGreaterThan(500);
  await page.keyboard.press('Escape');
  await expect(page.locator('#console-dialog')).not.toBeVisible();
  await expect(page.locator('#console-dock #console-output')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Expand console', exact: true })).toBeFocused();
  expect(await logs.evaluate(el => getComputedStyle(el).resize)).toBe('vertical');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('button', { name: 'Expand console', exact: true }).click();
  expect(await page.locator('#console-dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.getByRole('button', { name: 'Restore console', exact: true }).click();
  await expect(page.locator('#console-dialog')).not.toBeVisible();
});

test('DevTools waits for debug connections and falls back to an explicit link if popups are blocked', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Flutter DevTools', exact: true }).click();
  await expect(page.locator('#devtools-list')).toContainText('Run an app');
  await page.getByRole('button', { name: /Device manager/ }).click();
  await page.locator('[data-device="demo-ios-1"] [data-action="run"]').click();
  await page.getByRole('button', { name: 'Flutter DevTools', exact: true }).click();
  await expect(page.locator('#devtools-list [data-devtools]')).toHaveCount(6);
  await expect(page.locator('#devtools-list [data-devtools="inspector"]')).toBeDisabled();
  await page.route('**/api/state', async route => {
    const response = await route.fetch(); const state = await response.json();
    state.sessions.forEach(s => { s.devtoolsReady = true; });
    await route.fulfill({ json: state });
  });
  await page.route('**/api/sessions/*/devtools', async route => {
    expect(route.request().postDataJSON()).toEqual({ screen: 'network' });
    await route.fulfill({ json: { url: 'http://127.0.0.1:9100/?uri=ws%3A%2F%2F127.0.0.1%3A1234%2Ftest%2Fws&page=network' } });
  });
  await page.addInitScript(() => { window.open = () => null; });
  await page.reload();
  await page.getByRole('button', { name: 'Flutter DevTools', exact: true }).click();
  await page.locator('#devtools-list [data-devtools="network"]').click();
  await expect(page.locator('#devtools-dialog')).toBeVisible();
  await expect(page.locator('#devtools-open')).toHaveAttribute('href', /page=network/);
  await page.locator('#devtools-dialog .close-dialog').click();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
