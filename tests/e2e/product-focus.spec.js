import { test, expect } from './fixtures.js';
import { demoDevices } from '../../apps/agent/src/fixtures/demo.js';

test('ready workspace leads with devices, keeps debug feedback visible and lets users reopen setup', async ({ page }) => {
  await page.route('**/api/state', async route => {
    const result = await (await route.fetch()).json();
    result.devices = demoDevices;
    result.settings = { ...result.settings, workspace: '/Projects/focus-demo', targetIds: [] };
    await route.fulfill({ json: result });
  });
  await page.goto('/?lang=en');
  await expect(page.locator('.device-card')).toHaveCount(6);
  await expect(page.locator('#journey-progress')).toContainText('Project connected');
  await expect(page.locator('#setup-card')).not.toHaveAttribute('open');
  await expect(page.locator('.device-card').first()).toBeInViewport();
  const summaryY = await page.locator('.ide-selection').evaluate(node => node.getBoundingClientRect().top);
  const listY = await page.locator('#devices-grid').evaluate(node => node.getBoundingClientRect().top);
  expect(summaryY).toBeLessThan(listY);
  await page.locator('#setup-card>summary').click();
  await expect(page.locator('#journey-project')).toBeVisible();
  await page.locator('#setup-card>summary').click();
  await expect(page.locator('#setup-card')).not.toHaveAttribute('open');
  for (const theme of ['dark', 'light']) {
    await page.evaluate(theme => document.documentElement.classList.toggle('light', theme === 'light'), theme);
    await page.evaluate(async () => { scrollTo({top:0,behavior:'instant'}); await Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))); });
    await page.screenshot({ path: `/tmp/snapkit-focus-devices-${theme}.png` });
  }
});

test('setup prioritizes missing tools and keeps the computer summary compact in both languages and themes', async ({ page }) => {
  await page.route('**/api/diagnostics*', route => route.fulfill({ json: {
    ready: false, platform: 'win32', arch: 'x64', memoryGB: 16, freeDiskGB: 120,
    computer: { model: 'Windows PC', chip: 'Intel Core i7', name: 'Dev PC', osName: 'Windows 11', osVersion: '24H2', form: 'desktop' },
    checks: [{ id: 'android', title: 'Android tools', status: 'ready', detail: 'Installed' }, { id: 'flutter', title: 'Flutter', status: 'attention', detail: 'Install the Flutter SDK', help: 'https://docs.flutter.dev/get-started/install' }],
    storage: {}, advice: 'Start only the devices you need.'
  } }));
  await page.goto('/?lang=en');
  await page.locator('[data-app-page=setup]').click();
  await expect(page.locator('#readiness-summary')).toHaveText('1 ready · 1 need setup');
  await expect(page.locator('.tool-check').first()).toHaveClass(/attention/);
  expect(await page.locator('#tool-checks').evaluate(node => node.compareDocumentPosition(document.querySelector('.computer-card')) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();
  expect((await page.locator('.computer-card').boundingBox()).height).toBeLessThan(420);
  for (const theme of ['dark', 'light']) for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(theme => document.documentElement.classList.toggle('light', theme === 'light'), theme);
    await page.evaluate(async () => { await Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))); });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `/tmp/snapkit-focus-setup-${theme}-${width}.png`, fullPage: true });
  }
  await page.evaluate(() => window.SnapkitI18n.setLanguage('vi'));
  await expect(page.locator('#readiness-summary')).toHaveText('1 sẵn sàng · 1 cần thiết lập');
});
