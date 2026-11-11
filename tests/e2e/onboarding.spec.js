import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  let saved = null;
  await page.route('**/api/product', async route => {
    const response = await route.fetch(), result = await response.json();
    result.preferences.developerProfile = saved;
    await route.fulfill({ json: result });
  });
  await page.route('**/api/preferences', async route => {
    const body = route.request().postDataJSON();
    if (body.developerProfile) saved = body.developerProfile;
    await route.fulfill({ json: { preferences: { developerProfile: saved, editor: 'vscode' }, message: 'Preferences saved' } });
  });
});

test('onboarding selects React Native, persists on reload, and can change to Backend', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  const modal = page.getByRole('dialog', { name: 'What do you build?' });
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Open my workspace' })).toBeDisabled();
  await page.keyboard.press('Escape'); await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: 'React Native JavaScript / TypeScript' }).click();
  await expect(modal).toContainText('Expo Go');
  await page.screenshot({ path: '/tmp/snapkit-onboarding-dark.png', animations: 'disabled' });
  await modal.getByRole('button', { name: 'Open my workspace' }).click();
  await expect(modal).not.toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-framework', 'react-native');
  await page.reload(); await expect(page.locator('body')).toHaveAttribute('data-framework', 'react-native');
  await expect(modal).not.toBeVisible();
  await page.getByRole('button', { name: 'Preferences', exact: true }).click();
  await expect(page.locator('#profile-preference-root')).toContainText('Frontend · React Native');
  await page.getByRole('button', { name: 'Change profile' }).click();
  await modal.getByRole('button', { name: 'Backend Services, APIs and infrastructure. Coming soon' }).click();
  await expect(modal.locator('fieldset')).toHaveCount(1);
  await modal.getByRole('button', { name: 'Save Backend profile' }).click();
  await expect(page.locator('#panel-backend')).toBeVisible();
  await expect(page.locator('#panel-backend')).toContainText('Coming soon');
  await page.reload(); await expect(page.locator('#panel-backend')).toBeVisible();
  await page.locator('[data-app-page="devices"]').click(); await expect(page.locator('#panel-backend')).toBeVisible();
  await page.getByRole('button', { name: 'Explore Frontend tools' }).click();
  await modal.getByRole('button', { name: 'Frontend Build experiences. Ship to devices.' }).click();
  await modal.getByRole('button', { name: 'Flutter Dart' }).click();
  await modal.getByRole('button', { name: 'Open my workspace' }).click();
  await expect(page.locator('#panel-devices')).toBeVisible();
  expect(errors).toEqual([]);
});

test('onboarding is accessible at small widths, supports light mode and Vietnamese, and reports save failures', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('snapkit-theme', 'light'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?lang=vi');
  const modal = page.locator('#developer-onboarding');
  await expect(modal).toContainText('Bạn phát triển gì?');
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 812 });
    await expect(modal).toBeVisible();
    expect(await modal.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    const box = await modal.boundingBox(); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await modal.getByRole('button', { name: 'Flutter Dart' }).focus();
  await page.keyboard.press('Enter');
  await expect(modal.getByRole('button', { name: 'Flutter Dart' })).toHaveAttribute('aria-pressed', 'true');
  await page.route('**/api/preferences', route => route.fulfill({ status: 500, json: { error: 'Could not save profile' } }));
  await modal.getByRole('button', { name: 'Bắt đầu làm việc' }).click();
  await expect(modal.getByRole('alert')).toContainText('Could not save profile');
  await expect(modal.getByRole('button', { name: 'Bắt đầu làm việc' })).toBeEnabled();
  await page.screenshot({ path: '/tmp/snapkit-onboarding-mobile.png', animations: 'disabled' });
});

test('onboarding React Native connects a detected native workspace and blocks Flutter release actions', async ({ page }) => {
  await page.goto('/');
  const modal = page.locator('#developer-onboarding');
  await modal.getByRole('button', { name: 'React Native JavaScript / TypeScript' }).click();
  await modal.getByRole('button', { name: 'Open my workspace' }).click();
  await page.route('**/api/workspace/profiles?*', route => route.fulfill({ json: { framework: 'react-native', flavors: [], profiles: [] } }));
  const state = await page.request.get('/api/state').then(r => r.json());
  try {
    await page.locator('#settings-button').click();
    await page.locator('#workspace-path').fill('/Projects/native-app');
    await page.locator('#workspace-path').dispatchEvent('change');
    await expect(page.locator('#flutter-project-fields')).toBeHidden();
    await expect(page.locator('#react-native-project-help')).toBeVisible();
    await page.getByRole('button', { name: 'Save IDE setup' }).click();
    await expect(page.locator('#workspace-dialog')).not.toBeVisible();
    await expect(page.locator('#workspace-switch small')).toHaveText('React Native · Workspace');
    await page.locator('.sidebar [data-app-page="setup"]').click();
    await expect(page.locator('#editor-help')).toContainText('Snapkit Debug Sync 1.6.0');
    await expect(page.locator('#tool-checks')).toContainText('Node.js');
    await expect(page.locator('#tool-checks')).not.toContainText('Flutter');
    await page.locator('.sidebar [data-app-page="guide"]').click();
    await expect(page.locator('#guide-debug')).toContainText('Hermes');
    const result = await page.request.post('/api/releases/run', { headers: { 'X-Snapkit-Token': state.token }, data: { deviceId: 'demo-physical-1' } });
    expect(result.status()).toBe(409);
    expect((await result.json()).error).toContain('React Native');
  } finally {
    await page.request.post('/api/workspace', { headers: { 'X-Snapkit-Token': state.token }, data: { path: state.settings.workspace, framework: 'flutter' } });
  }
});


test('everyday users enter Kit without choosing a developer framework', async ({page}) => {
  await page.goto('/');
  const modal=page.getByRole('dialog',{name:'What do you build?'});
  await modal.getByRole('button',{name:'Use everyday tools',exact:true}).click();
  await expect(modal).not.toBeVisible();
  await expect(page.locator('#kit-root h1')).toHaveText('Your day. Your kit.');
  await page.reload();
  await expect(modal).not.toBeVisible();
  await page.getByRole('button',{name:'Preferences',exact:true}).click();
  await expect(page.locator('#profile-preference-root')).toContainText('Everyday tools');
});

 test('onboarding entry actions stay separated in both languages and themes at desktop and mobile widths',async({page})=>{
 for(const theme of ['dark','light'])for(const language of ['en','vi']){
  await page.addInitScript(value=>localStorage.setItem('snapkit-theme',value),theme);
  await page.goto('/?lang='+language);const modal=page.locator('#developer-onboarding');await expect(modal).toBeVisible();
  for(const width of [375,768,1440]){await page.setViewportSize({width,height:900});const buttons=modal.locator('.profile-entry-actions > button');await expect(buttons).toHaveCount(2);const a=await buttons.nth(0).boundingBox(),b=await buttons.nth(1).boundingBox();expect(Math.max(b.x-a.x-a.width,b.y-a.y-a.height)).toBeGreaterThanOrEqual(11.9);for(const box of [a,b])expect(box.height).toBeGreaterThanOrEqual(44);expect(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);}
 }
});
