import { test, expect } from '@playwright/test';
test('Pages works under a project prefix and preview never calls local APIs', async ({ page }) => {
  const errors = [], apiRequests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (r.url().includes('/api/')) apiRequests.push(r.url()); });
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Mọi thiết bị. Một nơi điều khiển.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Mở Dashboard local' })).toHaveAttribute('href', 'http://127.0.0.1:4310/');
  await page.goto('demo/');
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
  for (const url of ['./', 'demo/', 'preview/']) {
    await page.goto(url);
    await expect(page.locator('h1')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
test('hosted controller pairs across origins, runs commands and stops access after revocation', async ({ page }) => {
  const base = 'http://127.0.0.1:14323';
  const local = await fetch(base + '/api/state').then(r => r.json());
  const localPost = route => fetch(base + route, { method: 'POST', headers: { 'X-Snapkit-Token': local.token, 'Content-Type': 'application/json' }, body: '{}' });
  const pair = await localPost('/api/pairing/code').then(r => r.json());
  await page.goto('preview/');
  await expect(page.locator('#devices-grid')).toContainText('Connect your local device lab');
  await expect(page.locator('.device-card')).toHaveCount(0);
  await expect(page.locator('#pairing-dialog')).toBeVisible();
  await page.locator('#agent-url').fill(base);
  await page.locator('#agent-code').fill(pair.code);
  await page.locator('#pairing-submit').click();
  await expect(page.locator('.device-card')).toHaveCount(6);
  await page.locator('[data-device="demo-ios-1"] [data-action="run"]').click();
  await page.getByRole('button', { name: /Running sessions/ }).click();
  await expect(page.locator('.session-row')).toContainText('running');
  await page.getByRole('button', { name: 'Hot reload', exact: true }).click();
  await expect(page.locator('.toast').last()).toContainText('reload completed');
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await page.reload();
  await expect(page.locator('.device-card')).toHaveCount(6);
  await localPost('/api/pairing/revoke');
  await expect(page.locator('.device-card')).toHaveCount(0, { timeout: 10000 });
  await expect(page.locator('#server-status')).toHaveText('Local server not connected');
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#connection-button').click();
  expect(await page.locator('#pairing-dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});
