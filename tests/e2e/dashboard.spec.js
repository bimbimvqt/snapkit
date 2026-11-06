import { choose } from './choices.js';
import { test, expect } from './fixtures.js';

test('device manager boots devices and saves one or two IDE selections; app controls are absent', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.device-card')).toHaveCount(6);
  await expect(page.locator('.brand')).toContainText('Snapkit');
  await expect(page.locator('[data-device="demo-physical-1"] [data-action="boot"], [data-device="demo-physical-1"] [data-action="shutdown"]')).toHaveCount(0);
  await expect(page.locator('[data-device="demo-physical-1"] .spec')).toHaveCount(1);
  await expect(page.locator('[data-device="demo-physical-1"] .device-specs')).toContainText('1179×2556');
  await expect(page.locator('#console-output, #devtools-page, #sessions-page, #screenshots-page')).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Select iPhone 16 Pro for IDE debug', exact: true }).check();
  await expect(page.locator('#stat-selected')).toHaveText('1');
  await page.getByRole('checkbox', { name: 'Select Pixel 9 Pro for IDE debug', exact: true }).check();
  await expect(page.locator('#stat-selected')).toHaveText('2');
  await expect(page.locator('#ide-summary')).toContainText('Press F5 in your editor');
  await page.locator('#ide-use-dashboard').uncheck();
  await expect(page.locator('#ide-summary')).toContainText('normal debug configuration');
  await expect(page.locator('#stat-selected')).toHaveText('2');
  await page.locator('#ide-use-dashboard').check();
  await expect(page.locator('#ide-summary')).toContainText('Press F5 in your editor');
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
  // Cards render before the startup overlay releases focusable controls.
  await expect(page.locator('body')).toHaveAttribute('data-ui-ready', 'true');
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
  await expect(page.locator('#create-model-trigger')).toBeVisible();
  await choose(page, 'create-model', 'legacy:iphone-5');
  await expect(page.locator('#compatibility-note')).toContainText('32-bit');
  await expect(page.getByRole('button', { name: 'Create device', exact: true })).toBeDisabled();
  await choose(page, 'create-model', 'demo:iphone17');
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
  await expect(page.locator('#create-model-trigger')).toBeVisible();
  await page.locator('[data-create-platform="android"]').click();
  await choose(page, 'create-runtime', 'system-images;android-34;google_apis;arm64-v8a');
  await expect(page.locator('#create-device-submit')).toBeDisabled();
  await page.getByRole('button', { name: 'Install image', exact: true }).click();
  await expect(page.locator('#create-device-submit')).toBeEnabled();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.locator('#create-dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});
test('missing iOS runtime opens recovery tools, filters Apple versions and blocks legacy downloads', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add device', exact: true }).click();
  await choose(page, 'create-model', 'demo:iphone8');
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
  await choose(page, 'create-model', 'legacy:iphone-5');
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
  await expect(page.locator('#pairing-link')).toHaveAttribute('href', /^https:\/\/snapkit\.vn\/control\/#pair=/);
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
  await choose(page, 'workspace-profile', { label: 'Merchant dev' });
  await expect(page.locator('#workspace-flavor')).toHaveValue('dev');
  await expect(page.locator('#workspace-target')).toHaveValue('lib/main_dev.dart');
  await expect(page.locator('#workspace-defines')).toHaveValue('../dashboard/dev.json');
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.locator('#workspace-dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.getByRole('button', { name: 'Save IDE setup' }).click();
  await expect(page.locator('#workspace-dialog')).not.toBeVisible();
  expect(saved).toEqual({ path: '/Projects/merchant', framework: 'flutter', flavor: 'dev', target: 'lib/main_dev.dart', defineFile: '../dashboard/dev.json' });
});

test('compact view persists, tabs support arrow keys, and empty filters recover', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.device-card')).toHaveCount(6);
  await page.getByRole('button', { name: 'Switch to compact view' }).click();
  await expect(page.locator('#devices-grid')).toHaveClass(/compact/);
  await page.reload();
  await expect(page.locator('#view-toggle')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('tab', { name: 'All devices' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'iOS simulators' })).toBeFocused();
  await expect(page.locator('.device-card')).toHaveCount(3);
  await page.getByRole('searchbox').fill('missing device');
  await expect(page.locator('#filter-summary')).toHaveText('0 of 6 devices');
  await page.locator('#empty-reset').click();
  await expect(page.locator('.device-card')).toHaveCount(6);
  await expect(page.getByRole('searchbox')).toBeFocused();
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 375, height: 812 });
  const summary = page.locator('#ide-summary');
  expect(await summary.evaluate(el => el.clientWidth)).toBeGreaterThan(180);
});

test('unchanged devices and icons keep their DOM and focus across scans', async ({ page }) => {
  await page.goto('/');
  const target = page.locator('[data-device="demo-ios-1"] [data-action="select"]');
  await target.focus();
  const card = await page.locator('[data-device="demo-ios-1"]').elementHandle();
  const svg = await page.locator('[data-device="demo-ios-1"] svg').first().elementHandle();
  await page.locator('#refresh-button').click();
  await expect(page.locator('#refresh-button')).toBeEnabled();
  expect(await card.evaluate(el => el.isConnected)).toBe(true);
  expect(await svg.evaluate(el => el.isConnected)).toBe(true);
  // Scan with focus inside a card (the refresh button normally takes focus).
  await target.focus();
  await page.evaluate(() => document.querySelector('#refresh-button').click());
  await expect(page.locator('#refresh-button')).toBeEnabled();
  await expect(target).toBeFocused();
});

test('pending boot stays disabled across a scan and cannot be submitted twice', async ({ page }) => {
  let boots = 0, release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route('**/api/devices/demo-ios-2/boot', async route => {
    boots++; await pending; await route.fulfill({ json: { message: 'Boot accepted' } });
  });
  await page.goto('/');
  const card = page.locator('[data-device="demo-ios-2"]');
  await card.getByRole('button', { name: 'Start device', exact: true }).click();
  await expect(card.getByRole('button', { name: 'Starting…', exact: true })).toBeDisabled();
  await page.locator('#refresh-button').click();
  await expect(page.locator('#refresh-button')).toBeEnabled();
  await expect(card.getByRole('button', { name: 'Starting…', exact: true })).toBeDisabled();
  expect(boots).toBe(1);
  release();
  await expect(card.getByRole('button', { name: 'Start device', exact: true })).toBeEnabled();
});

test('guided desktop dashboard explains setup, editor compatibility and the free beta without checkout', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#setup-card')).toBeVisible();
  await page.getByRole('button', { name: 'Setup and tools' }).click();
  await expect(page.locator('.tool-check.ready')).toHaveCount(3);
  await expect(page.locator('[data-editor]')).toHaveCount(3);
  await expect(page.locator('[data-editor="android-studio"], [data-editor="intellij"], [data-editor="other"]')).toHaveCount(0);
  await page.locator('[data-editor="cursor"]').click();
  await expect(page.locator('[data-editor="cursor"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#editor-help')).toContainText('In Cursor');
  await expect(page.locator('#editor-preference-note')).toBeHidden();
  const help = page.locator('.extension-card .interface-details > summary');
  await help.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#editor-preference-note')).toBeVisible();
  await expect(page.locator('#editor-preference-note')).toContainText('does not open your editor');
  await help.click();
  await expect(page.locator('#editor-preference-note')).toBeHidden();
  await expect(page.locator('#extension-download')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Setup and tools' }).click();
  await expect(page.locator('[data-editor="cursor"]')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Your plan', exact: true }).click();
  await expect(page.locator('#plan-title')).toHaveText('Your plan');
  await expect(page.locator('.beta-banner')).toContainText('No automatic subscription');
  await expect(page.locator('#panel-plan button')).toHaveCount(0);
  await page.getByRole('button', { name: 'Preferences', exact: true }).click();
  await page.locator('#pref-flutter').fill('/A Folder/Flutter');
  await page.locator('#save-preferences').click();
  await expect(page.locator('#preferences-result')).toContainText('Restart Snapkit');
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole('button', { name: 'Your plan', exact: true }).click();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('add device shows its form immediately, keeps typing and reopens from cache', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let requests = 0;
  await page.route('**/api/provision/catalog?*', async route => {
    requests++;
    await gate;
    await route.fulfill({ response: await route.fetch() });
  });
  await page.goto('/');
  await page.locator('#add-device').click();
  await expect(page.locator('#create-form')).toBeVisible();
  await expect(page.locator('#create-loading')).toBeVisible();
  await expect(page.locator('#create-model')).toBeDisabled();
  await expect(page.locator('#create-device-submit')).toBeDisabled();
  await page.locator('#create-name').fill('My test device');
  release();
  await expect(page.locator('#create-loading')).toBeHidden();
  await expect(page.locator('#create-model')).toBeEnabled();
  await expect(page.locator('#create-name')).toHaveValue('My test device');
  await page.locator('#create-dialog .close-dialog').first().click();
  await page.locator('#add-device').click();
  await expect(page.locator('#create-loading')).toBeHidden();
  await expect(page.locator('#create-model')).toBeEnabled();
  expect(requests).toBe(1);
});

test('switching platforms ignores a late catalog response and failed loads can retry', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/provision/catalog?platform=ios', async route => {
    await gate;
    await route.fulfill({ response: await route.fetch() });
  });
  let failAndroid = true;
  await page.route('**/api/provision/catalog?platform=android', async route => {
    if (failAndroid) await route.fulfill({ status: 503, json: { error: 'SDK temporarily unavailable' } });
    else await route.fulfill({ response: await route.fetch() });
  });
  await page.goto('/');
  await page.locator('#add-device').click();
  await page.locator('[data-create-platform="android"]').click();
  await expect(page.locator('#create-error')).toContainText('SDK temporarily unavailable');
  await expect(page.locator('#create-device-submit')).toBeDisabled();
  failAndroid = false;
  await page.locator('#refresh-catalog').click();
  await expect(page.locator('#create-model')).toBeEnabled();
  const model = await page.locator('#create-model').inputValue();
  const lateResponse = page.waitForResponse('**/api/provision/catalog?platform=ios');
  release();
  await (await lateResponse).finished();
  await expect.poll(() => page.locator('#create-model').inputValue()).toBe(model);
  await expect(page.locator('[data-create-platform="android"]')).toHaveAttribute('aria-pressed', 'true');
});

test('SDK folder buttons select local folders, preserve inputs on cancel and expose picker errors', async ({ page }) => {
  const selections = [];
  let result = { path: '/Tools/Flutter SDK' };
  await page.route('**/api/folders/pick', async route => {
    selections.push(route.request().postDataJSON());
    await route.fulfill({ status: result.error ? 500 : 200, json: result });
  });
  await page.goto('/?lang=vi');
  await page.locator('[data-app-page="preferences"]').click();
  await page.locator('#browse-flutter-sdk').click();
  await expect(page.locator('#pref-flutter')).toHaveValue('/Tools/Flutter SDK');
  await expect(page.locator('#preferences-result')).toContainText('Lưu tùy chọn');
  result = { path: '/Tools/Android SDK' };
  await page.locator('#browse-android-sdk').click();
  await expect(page.locator('#pref-android')).toHaveValue('/Tools/Android SDK');
  expect(selections).toEqual([{ purpose: 'flutterSDK', language: 'vi' }, { purpose: 'androidSDK', language: 'vi' }]);
  result = { cancelled: true };
  await page.locator('#browse-flutter-sdk').click();
  await expect(page.locator('#browse-flutter-sdk')).toBeEnabled();
  await expect(page.locator('#pref-flutter')).toHaveValue('/Tools/Flutter SDK');
  result = { error: 'Folder picker could not open' };
  await page.locator('#browse-android-sdk').click();
  await expect(page.locator('#preferences-error')).toContainText('Folder picker could not open');
  await expect(page.locator('#pref-android')).toHaveValue('/Tools/Android SDK');
  const saving = page.waitForRequest(request => request.url().endsWith('/api/preferences') && request.method() === 'POST');
  await page.locator('#save-preferences').click();
  expect((await saving).postDataJSON()).toEqual({ flutterSDK: '/Tools/Flutter SDK', androidSDK: '/Tools/Android SDK' });
  await expect(page.locator('#preferences-result')).toContainText('Khởi động lại');
  await page.setViewportSize({ width: 375, height: 844 });
  await expect(page.locator('#browse-android-sdk')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('device cards turn off one simulator and request stopping only its IDE debug session', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.device-card')).toHaveCount(6);
  const initial = await page.request.get('/api/state').then(r => r.json());
  const headers = { 'X-Snapkit-Token': initial.token };
  const sessions = [
    { id: 'first-debug', deviceId: 'demo-ios-1', name: 'First debug' },
    { id: 'second-debug', deviceId: 'demo-android-1', name: 'Second debug' },
  ];
  const report = list => page.request.post('/api/ide/sessions', { headers, data: { ownerId: 'ui-test-ide', sessions: list } });
  await report(sessions);
  const first = page.locator('[data-device="demo-ios-1"]');
  const second = page.locator('[data-device="demo-android-1"]');
  await expect(first.locator('[data-action="stop-debug"]')).toBeVisible();
  let releaseState, stateCaptured;
  const captured = new Promise(resolve => { stateCaptured = resolve; });
  const staleState = new Promise(resolve => { releaseState = resolve; });
  await page.route('**/api/state', async route => {
    const response = await route.fetch(); stateCaptured(); await staleState;
    await route.fulfill({ response });
  });
  await first.locator('[data-action="stop-debug"]').click();
  await expect(first.locator('[data-action="stop-debug"]')).toBeDisabled();
  await expect(second.locator('[data-action="stop-debug"]')).toBeEnabled();
  const response = await report(sessions);
  expect((await response.json()).stopSessionIds).toEqual(['first-debug']);
  await captured;
  await report(sessions.slice(1));
  await expect(first.locator('[data-action="stop-debug"]')).toHaveCount(0);
  const delivered = page.waitForResponse('**/api/state');
  releaseState();
  await (await delivered).finished();
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await expect(first.locator('[data-action="stop-debug"]')).toHaveCount(0);
  await page.unroute('**/api/state');
  await expect(first.locator('[data-action="shutdown"]')).toBeEnabled();
  let release, requests = 0;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/devices/demo-ios-1/shutdown', async route => {
    requests++; await gate; await route.fulfill({ response: await route.fetch() });
  });
  await first.locator('[data-action="shutdown"]').click();
  await expect(first.locator('[data-action="shutdown"]')).toBeDisabled();
  release();
  await expect(first.locator('[data-action="boot"]')).toBeEnabled();
  expect(requests).toBe(1);
  await expect(second.locator('[data-action="shutdown"]')).toBeEnabled();
  await expect(page.locator('[data-device="demo-physical-1"] [data-action="shutdown"]')).toHaveCount(0);
  await report([]);
});

test('sidebar groups separate workspace, setup, account and support while retaining navigation and help', async ({page}) => {
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.sidebar-note')).toHaveCount(0);
  await expect(page.locator('.sidebar-group')).toHaveCount(6);
  await expect(page.locator('#nav-setup')).toHaveText('SETUP');
  await page.locator('.sidebar [data-app-page="preferences"]').click();
  await expect(page.locator('#panel-preferences')).toBeVisible();
  await page.locator('.sidebar [data-app-page="plan"]').click();
  await expect(page.locator('#panel-plan')).toBeVisible();
  await expect(page.locator('.sidebar [data-app-page].active')).toHaveCount(1);
  await page.locator('#guide-button').click();
  await expect(page.locator('#panel-guide')).toBeVisible();
  await expect(page.locator('.guide-chapter')).toHaveCount(8);
  await expect(page.locator('#guide-dialog')).toHaveCount(0);
  await page.setViewportSize({width:900,height:680});
  const status=await page.locator('.local-status').boundingBox(); expect(status.y+status.height).toBeLessThanOrEqual(680);
  await page.screenshot({path:'/tmp/snapkit-sidebar-beta13.png',fullPage:true});
  expect(errors).toEqual([]);
});
