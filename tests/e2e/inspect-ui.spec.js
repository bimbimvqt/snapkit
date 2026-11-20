import { test, expect } from './fixtures.js';

test('Inspect UI is device scoped and opens the matched source', async ({ page }) => {
  const deviceId = 'demo-ios-1', workspace = '/work/widget-project', sessionId = 'flutter-debug';
  const replies = [];
  await page.route('**/api/state', async route => {
    const response = await route.fetch();
    const state = await response.json();
    await route.fulfill({ response, json: { ...state, demo: false, settings: { ...state.settings, workspace }, debugSessions: [{ id: sessionId, deviceId, inspectable: true }] } });
  });
  await page.route(`**/api/devices/${deviceId}/inspect-ui`, async route => {
    const body = route.request().postDataJSON();
    replies.push(body);
    const selected = { phase: 'selected', widget: { name: 'RichText' }, project: { name: 'Text', file: 'lib/main.dart', line: 12, column: 7, enclosing: 'build' } };
    await route.fulfill({ json: { sessionId, ...(body.command === 'inspectUI' ? { phase: 'starting' } : selected) } });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Inspect UI', exact: true })).toHaveCount(1);
  await page.locator(`[data-device="${deviceId}"]`).getByRole('button', { name: 'Inspect UI', exact: true }).click();
  const inspector = page.getByRole('dialog', { name: 'Inspect UI' });
  await expect(inspector.getByText('Selected widget: RichText')).toBeVisible();
  await expect(inspector.getByText('lib/main.dart:12:7 · build')).toBeVisible();
  await inspector.getByRole('button', { name: 'Open in IDE' }).click();
  await expect.poll(() => replies.some(body => body.command === 'openInspectedSource' && body.sessionId === sessionId)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(inspector).not.toBeVisible();
  await expect.poll(() => replies.some(body => body.command === 'closeInspector' && body.sessionId === sessionId && body.expectedWorkspace === workspace)).toBe(true);
});
