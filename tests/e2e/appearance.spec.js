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
for (const [platform, model, form, image] of [['darwin', 'Mac mini', 'mini', 'mac-mini'], ['darwin', 'Mac Studio', 'studio', 'mac-studio'], ['darwin', 'MacBook Pro', 'laptop', 'macbook'], ['win32', 'Dell XPS 15', 'laptop', 'windows']]) test(`computer card displays ${model} hardware and OS`, async ({page}) => {
  await page.route('**/api/diagnostics*', route => route.fulfill({json: { ready:true, platform, arch: platform === 'darwin' ? 'arm64':'x64', memoryGB:16, freeDiskGB:180, computer: platform === 'darwin' ? {model,chip:'Apple M4',name:'Desk Mac',osName:'macOS',osVersion:'macOS 26.1',form} : {model,chip:'Intel Core i7',name:'Work PC',osName:'Windows 11 Pro',osVersion:'10.0.26100 · Build 26100',form}, checks:[], storage:{}, advice:'Start only the devices you need.' }}));
  await page.goto('/?lang=en'); await page.locator('[data-app-page="setup"]').click();
  await expect(page.locator('#computer-label')).toHaveText(model);
  await expect(page.locator('#computer-specs')).toContainText('16 GB');
  await expect(page.locator('#computer-specs')).toContainText('180 GB');
  await expect(page.locator('#computer-os-name')).toHaveText(platform === 'darwin' ? 'macOS':'Windows 11 Pro');
  await expect(page.locator('.sidebar')).not.toContainText(/\bbeta\b/i);
  await expect(page.locator('#panel-plan')).not.toContainText(/\bbeta\b/i);
  await expect(page.locator('#computer-art img')).toHaveAttribute('src', new RegExp(image + '.*\\.webp'));
  await expect.poll(() => page.locator('#computer-art img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  for (const theme of ['dark', 'light']) {
    await page.evaluate(theme => { localStorage.setItem('snapkit-theme', theme); document.documentElement.classList.toggle('light', theme === 'light'); }, theme);
    await page.locator('.computer-card').screenshot({path:`/tmp/snapkit-computer-${image}-${theme}.png`});
  }
});

test('themes created in Appearance follow navigation and stay separate from light and dark mode',async({page})=>{
 await page.emulateMedia({colorScheme:'dark'});
 await page.goto('/?lang=en');await page.locator('#theme-toggle').click();
 await page.getByRole('button',{name:'New theme',exact:false}).click();
 const dialog=page.getByRole('dialog');await dialog.getByLabel('Theme name',{exact:true}).fill('Plum studio');
 await dialog.getByLabel('Background color',{exact:true}).fill('#582c83');await dialog.getByLabel('Accent color',{exact:true}).fill('#d9a7f2');
 await dialog.getByRole('button',{name:'Save and apply',exact:true}).click();
 const id=await page.locator('html').getAttribute('data-personal-theme');
 await page.getByRole('radio',{name:'Light',exact:true}).check();await expect(page.locator('html')).toHaveAttribute('data-personal-theme',id);
 await page.getByRole('radio',{name:'Dark',exact:true}).check();await page.locator('.appearance-card').screenshot({path:'/tmp/snapkit-personal-themes-settings.png'});
 await page.locator('[data-app-page=setup]').click();await expect(page.locator('html')).toHaveAttribute('data-personal-theme',id);
 await page.goto('/?lang=vi&page=kit&tool=focus');await expect(page.getByRole('button',{name:'Plum studio',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.evaluate(async()=>Promise.all(document.getAnimations().map(animation=>animation.finished.catch(()=>{}))));
 await page.screenshot({path:'/tmp/snapkit-personal-theme-app.png',animations:'disabled'});
});
