import { test, expect } from '@playwright/test';
async function chooseLanguage(page, language) {
  await page.locator('[data-language-select]').click();
  await page.locator(`[data-language="${language}"]`).click();
}
test('Pages works under a project prefix and preview never calls local APIs', async ({ page }) => {
  const errors = [], apiRequests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (r.url().includes('/api/')) apiRequests.push(r.url()); });
  await page.goto('./?lang=vi');
  await expect(page.getByRole('heading', { name: 'Mọi thiết bị. Một nơi điều khiển.' })).toBeVisible();
  await expect(page.locator('#debug-video')).toBeVisible();
  await page.getByRole('button', { name: 'Kiểm tra công cụ' }).click();
  await expect(page.locator('#app-preview')).toHaveAttribute('src', 'assets/setup-vi.webp?v=20261106-seo');
  await expect(page.getByRole('contentinfo')).toContainText('Tải ứng dụng');
  await page.goto('demo/?lang=en');
  await expect(page.locator('#server-status')).toHaveText('Static preview · sample data');
  await expect(page.locator('#connection-button')).not.toBeVisible();
  await expect(page.locator('.topbar .avatar')).toHaveCount(0);
  await chooseLanguage(page, 'vi');
  await expect(page.getByRole('button', {name:'Quản lý thiết bị thật', exact:true})).toHaveCount(0);
  await expect(page.locator('#connection-button')).not.toBeVisible();
  await chooseLanguage(page, 'en');
  await page.locator('.topbar').screenshot({path:'/tmp/snapkit-beta43-preview-topbar.png',animations:'disabled'});
  await expect(page.locator('.device-card')).toHaveCount(6);
  await page.locator('[data-device="demo-ios-3"] [data-action="boot"]').click();
  await expect(page.locator('[data-device="demo-ios-3"] [data-action="boot"]')).toBeEnabled();
  await expect(page.locator('.toast')).toHaveCount(0);
  await chooseLanguage(page, 'vi');
  await page.locator('[data-device="demo-ios-3"] [data-action="boot"]').click();
  await expect(page.locator('[data-device="demo-ios-3"] [data-action="boot"]')).toBeEnabled();
  await expect(page.locator('.toast')).toHaveCount(0);
  await chooseLanguage(page, 'en');
  await page.getByRole('button', { name: 'Add device', exact: true }).click();
  await expect(page.locator('#create-model')).toContainText('iPhone 5');
  await expect(page.locator('#create-storage-label')).toHaveText('iOS DATA ON INTERNAL DISK');
  expect(errors).toEqual([]); expect(apiRequests).toEqual([]);
});
test('landing and preview fit a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const url of ['./', 'demo/', 'preview/']) {
    await page.goto(url);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
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
  const onboarding = page.locator('#developer-onboarding');
  await expect(onboarding).toBeVisible();
  await onboarding.getByRole('button', { name: 'Flutter Dart' }).click();
  await onboarding.getByRole('button', { name: 'Open my workspace' }).click();
  await expect(onboarding).not.toBeVisible();
  const target = page.getByRole('checkbox', { name: 'Select iPhone 16 Pro for IDE debug', exact: true });
  await target.check(); await expect(page.locator('#stat-selected')).toHaveText('1');
  await page.getByRole('checkbox', { name: 'Select Pixel 9 Pro for IDE debug', exact: true }).check();
  await expect(page.locator('#stat-selected')).toHaveText('2');
  await expect(page.locator('#console-output, #devtools-page')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.device-card')).toHaveCount(6);
  // A hidden hosted dashboard must stop its 2-second polling loop.
  await page.clock.install();
  let backgroundReads = 0;
  page.on('request', request => { if (request.url() === base + '/api/state') backgroundReads++; });
  await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, value: true }));
  await page.clock.fastForward(6000);
  expect(backgroundReads).toBe(0);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => backgroundReads).toBeGreaterThan(0);
  await page.clock.resume();
  await localPost('/api/pairing/revoke');
  await expect(page.locator('.device-card')).toHaveCount(0, { timeout: 10000 });
  await expect(page.locator('#server-status')).toHaveText('Local server not connected');
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#connection-button').click();
  expect(await page.locator('#pairing-dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});

test('landing switches EN/VN, keeps preview and links, and remembers the language in the app preview', async ({ page }) => {
  // Release discovery runs independently of locale; hold its result stable for this test.
  await page.route('https://api.github.com/repos/bimbimvqt/snapkit/releases?*', route => route.fulfill({ json: [] }));
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('./?lang=en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Every device.');
  const downloads = await page.locator('.download-button').evaluateAll(links => links.map(link => link.href));
  await page.getByRole('button', { name: 'Setup & tools', exact: true }).click();
  await chooseLanguage(page, 'vi');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Mọi thiết bị.');
  await expect(page.locator('#app-preview')).toHaveAttribute('src', 'assets/setup-vi.webp?v=20261106-seo');
  expect(await page.locator('.download-button').evaluateAll(links => links.map(link => link.href))).toEqual(downloads);
  await page.goto('./');
  await expect(page.locator('[data-language-select]')).toHaveAttribute('data-language-current', 'vi');
  await page.goto('demo/');
  await expect(page.locator('#add-device')).toHaveText('Thêm thiết bị');
  for (const width of [375, 812, 1440]) {
    await page.setViewportSize({ width, height: 812 });
    for (const language of ['vi', 'en']) {
      await chooseLanguage(page, language);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});

test('current workflows and app gallery work in both languages with keyboard navigation', async ({page}) => {
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/v1/public/content',route=>route.fulfill({json:{landing:{}}}));
  await page.goto('./?lang=vi');
  await expect(page.locator('.feature-card')).toHaveCount(6);
  await page.getByRole('tab',{name:'React Native',exact:true}).click();
  await expect(page.locator('#workflow-react-native')).toContainText('Hermes');
  await expect(page.locator('#workflow-react-native')).toContainText('Expo cần prebuild');
  await page.getByRole('tab',{name:'React Native',exact:true}).press('ArrowLeft');
  await expect(page.getByRole('tab',{name:'Flutter',exact:true})).toHaveAttribute('aria-selected','true');
  for(const language of ['vi','en']) {
    await chooseLanguage(page,language);
    for(const key of ['devices','setup','captures','releases']) {
      await page.locator(`[data-preview="${key}"]`).click();
      await expect(page.locator('#app-preview')).toHaveAttribute('src',`assets/${key}${language==='vi'?'-vi':''}.webp?v=20261106-seo`);
      await expect.poll(()=>page.locator('#app-preview').evaluate(image=>image.complete&&image.naturalWidth>0)).toBe(true);
    }
    for(const width of [375,768,1024,1440]) {
      await page.setViewportSize({width,height:900});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    }
  }
  expect(errors).toEqual([]);
  await page.goto('./?lang=vi');
  await page.setViewportSize({width:1440,height:1050});
  await page.screenshot({path:'/tmp/snapkit-website-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'/tmp/snapkit-website-mobile.png',fullPage:true});
});

test('downloads show the discovered release and keep installers matched to each platform',async({page})=>{
  await page.route('**/v1/public/content',route=>route.fulfill({json:{landing:{}}}));
  const version='0.2.0-beta.99';
  const names=['mac-arm64.dmg','mac-x64.dmg','win-x64.exe'].map(suffix=>`Snapkit-${version}-${suffix}`);
  await page.route('https://api.github.com/repos/bimbimvqt/snapkit/releases?*',route=>route.fulfill({json:[{tag_name:'v'+version,published_at:'2026-11-05T00:00:00Z',assets:names.map(name=>({name,browser_download_url:`https://github.com/bimbimvqt/snapkit/releases/download/v${version}/${name}`}))}]}));
  await page.route('https://api.github.com/repos/bimbimvqt/snapkit/releases/tags/*',route=>route.fulfill({status:404,json:{}}));
  await page.goto('./?lang=en');
  await expect(page.locator('#release-version')).toHaveText('v'+version);
  const links=await page.locator('.download-button').evaluateAll(nodes=>nodes.map(n=>n.href));
  names.forEach((name,index)=>expect(links[index]).toContain(name));
  await chooseLanguage(page,'vi');
  await expect(page.locator('#release-version')).toHaveText('v'+version);
});

test('an open landing page discovers newly published installers without a reload',async({page})=>{
  await page.route('**/v1/public/content',route=>route.fulfill({json:{landing:{}}}));
  let version='0.2.0-beta.37';
  await page.route('https://api.github.com/repos/bimbimvqt/snapkit/releases?*',route=>route.fulfill({json:[{tag_name:'v'+version,published_at:'2026-11-06T00:00:00Z',assets:['mac-arm64.dmg','mac-x64.dmg','win-x64.exe'].map(suffix=>{const name=`Snapkit-${version}-${suffix}`;return {name,browser_download_url:`https://github.com/bimbimvqt/snapkit/releases/download/v${version}/${name}`};})}]}));
  await page.route('https://api.github.com/repos/bimbimvqt/snapkit/releases/tags/*',route=>route.fulfill({status:404,json:{}}));
  await page.clock.install();
  await page.goto('./?lang=vi');
  await expect(page.locator('#release-version')).toHaveText('v'+version);
  version='0.2.0-beta.38';
  await page.clock.fastForward(300001);
  await expect(page.locator('#release-version')).toHaveText('v'+version);
  for(const link of await page.locator('.download-button').all()) await expect(link).toHaveAttribute('href',new RegExp('v0\\.2\\.0-beta\\.38/'));
});
