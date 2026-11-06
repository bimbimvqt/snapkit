import { test, expect } from './fixtures.js';
test('appearance follows the system, persists manual choices and syncs native chrome', async ({page}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => { window.snapkitDesktop = { setAppearance: async value => { window.lastAppearance = value; } }; });
  await page.goto('/?lang=en');
  await page.locator('#theme-toggle').click();
  await expect(page.getByRole('radio', {name:'Auto',exact:true})).toBeChecked();
  await expect(page.locator('html')).not.toHaveClass(/light/);
  await page.emulateMedia({ colorScheme:'light' });
  await expect(page.locator('html')).toHaveClass(/light/);
  await page.getByRole('radio', {name:'Dark',exact:true}).check();
  await expect.poll(() => page.evaluate(() => window.lastAppearance)).toBe('dark');
  await expect(page.locator('html')).not.toHaveClass(/light/);
  await page.reload(); await page.locator('#theme-toggle').click();
  await expect(page.getByRole('radio', {name:'Dark',exact:true})).toBeChecked();
  await page.getByRole('radio', {name:'Light',exact:true}).check();
  await page.emulateMedia({colorScheme:'dark', reducedMotion:'reduce'});
  await expect(page.locator('html')).toHaveClass(/light/);
  for (const width of [375, 900, 1440]) {
    await page.setViewportSize({width,height:1000});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('.appearance-card').screenshot({path:'/tmp/snapkit-appearance-light.png'});
  await page.getByRole('radio', {name:'Dark',exact:true}).check();
  await page.locator('.appearance-card').screenshot({path:'/tmp/snapkit-appearance-dark.png'});
  await page.evaluate(() => window.SnapkitI18n.setLanguage('vi'));
  await expect(page.getByRole('radio', {name:'Tối',exact:true})).toBeChecked();
});
for (const platform of ['darwin', 'win32']) test(`computer card displays ${platform} hardware and OS`, async ({page}) => {
  await page.route('**/api/diagnostics*', route => route.fulfill({json: { ready:true, platform, arch: platform === 'darwin' ? 'arm64':'x64', memoryGB:16, freeDiskGB:180, computer: platform === 'darwin' ? {model:'Mac mini',chip:'Apple M4',name:'Desk Mac',osName:'macOS',osVersion:'macOS 26.1',form:'mini'} : {model:'Dell XPS 15',chip:'Intel Core i7',name:'Work PC',osName:'Windows 11 Pro',osVersion:'10.0.26100 · Build 26100',form:'laptop'}, checks:[], storage:{}, advice:'Start only the devices you need.' }}));
  await page.goto('/?lang=en'); await page.locator('[data-app-page="setup"]').click();
  await expect(page.locator('#computer-label')).toHaveText(platform === 'darwin' ? 'Mac mini':'Dell XPS 15');
  await expect(page.locator('#computer-specs')).toContainText('16 GB');
  await expect(page.locator('#computer-specs')).toContainText('180 GB');
  await expect(page.locator('#computer-os-name')).toHaveText(platform === 'darwin' ? 'macOS':'Windows 11 Pro');
  await expect(page.locator('.sidebar')).not.toContainText(/\bbeta\b/i);
  await expect(page.locator('#panel-plan')).not.toContainText(/\bbeta\b/i);
  await page.locator('.computer-card').screenshot({path:`/tmp/snapkit-computer-${platform}.png`});
});
