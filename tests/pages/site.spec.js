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
  await expect(page.getByRole('heading', { name: /Debug nhiều thiết bị.*Ngay từ editor của bạn/ })).toBeVisible();
  await expect(page.locator('#debug-video')).toBeVisible();
  await page.getByRole('button', { name: 'Kiểm tra công cụ' }).click();
  await expect(page.locator('#app-preview')).toHaveAttribute('src', 'assets/setup-vi.webp?v=20261111-visual');
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
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Debug multiple devices.');
  const downloads = await page.locator('.download-button').evaluateAll(links => links.map(link => link.href));
  await page.getByRole('button', { name: 'Setup & tools', exact: true }).click();
  await chooseLanguage(page, 'vi');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Debug nhiều thiết bị.');
  await expect(page.locator('#app-preview')).toHaveAttribute('src', 'assets/setup-vi.webp?v=20261111-visual');
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
  await expect(page.locator('#features .feature-card')).toHaveCount(6);
  await page.getByRole('tab',{name:'React Native',exact:true}).click();
  await expect(page.locator('#workflow-react-native')).toContainText('Hermes');
  await page.locator('#workflow-react-native summary').click();
  await expect(page.locator('#workflow-react-native')).toContainText('Expo cần prebuild');
  await page.getByRole('tab',{name:'React Native',exact:true}).press('ArrowLeft');
  await expect(page.getByRole('tab',{name:'Flutter',exact:true})).toHaveAttribute('aria-selected','true');
  for(const language of ['vi','en']) {
    await chooseLanguage(page,language);
    for(const key of ['devices','setup','captures','releases']) {
      await page.locator(`[data-preview="${key}"]`).click();
      await expect(page.locator('#app-preview')).toHaveAttribute('src',`assets/${key}${language==='vi'?'-vi':''}.webp?v=20261111-visual`);
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
  await expect(page.locator('#release-version')).toHaveText('v'+version.replace(/-beta\.(\d+)$/, ' ($1)'));
  const links=await page.locator('.download-button').evaluateAll(nodes=>nodes.map(n=>n.href));
  names.forEach((name,index)=>expect(links[index]).toContain(name));
  await chooseLanguage(page,'vi');
  await expect(page.locator('#release-version')).toHaveText('v'+version.replace(/-beta\.(\d+)$/, ' ($1)'));
});

test('an open landing page discovers newly published installers without a reload',async({page})=>{
  await page.route('**/v1/public/content',route=>route.fulfill({json:{landing:{}}}));
  let version='0.2.0-beta.37';
  await page.route('https://api.github.com/repos/bimbimvqt/snapkit/releases?*',route=>route.fulfill({json:[{tag_name:'v'+version,published_at:'2026-11-06T00:00:00Z',assets:['mac-arm64.dmg','mac-x64.dmg','win-x64.exe'].map(suffix=>{const name=`Snapkit-${version}-${suffix}`;return {name,browser_download_url:`https://github.com/bimbimvqt/snapkit/releases/download/v${version}/${name}`};})}]}));
  await page.route('https://api.github.com/repos/bimbimvqt/snapkit/releases/tags/*',route=>route.fulfill({status:404,json:{}}));
  await page.clock.install();
  await page.goto('./?lang=vi');
  await expect(page.locator('#release-version')).toHaveText('v'+version.replace(/-beta\.(\d+)$/, ' ($1)'));
  version='0.2.0-beta.38';
  await page.clock.fastForward(300001);
  await expect(page.locator('#release-version')).toHaveText('v'+version.replace(/-beta\.(\d+)$/, ' ($1)'));
  for(const link of await page.locator('.download-button').all()) await expect(link).toHaveAttribute('href',new RegExp('v0\\.2\\.0-beta\\.38/'));
});

test('Personal and Teams explain separate data and desktop availability in both languages', async ({page}) => {
  for (const [url,title,note] of [['./?lang=vi','Một ứng dụng. Hai không gian.','Cá nhân lưu trên máy. Teams chia sẻ theo quyền truy cập.'],['en/?lang=en','One app. Two spaces.','Personal stays on your computer. Teams shares by access level.']]) {
    await page.goto(url);
    await expect(page.locator('#products-title')).toHaveText(title);
    await expect(page.locator('#products')).toContainText(note);
    await expect(page.locator('#teams .feature-card')).toHaveCount(3);
    await page.locator('#products').screenshot({path:url.startsWith('en')?'/tmp/snapkit-products-en.png':'/tmp/snapkit-products-vi.png'});
    await page.setViewportSize({width:390,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.locator('#products').screenshot({path:'/tmp/snapkit-products-mobile.png'});
    await page.setViewportSize({width:1440,height:1000});
  }
});

test('Teams gallery opens a read-only showcase without account data or network API calls',async({page})=>{
 const calls=[],errors=[];
 page.on('request',request=>{if(/\/(?:api|v1)\//.test(new URL(request.url()).pathname))calls.push(request.url());});
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('./?lang=en');
 await page.locator('[data-preview=teams]').click();
 await expect(page.locator('#app-preview')).toHaveAttribute('src','assets/teams.webp?v=20261111-visual');
 await expect(page.locator('#preview-caption')).toContainText('fictional sample data');
 await expect(page.locator('#preview-demo-link')).toHaveAttribute('href','demo/?product=teams');
 const links=await page.locator('a[href]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')));
 expect(links.some(link=>/blob\/|#readme|huong-dan\/|en\/guides\//.test(link))).toBe(false);
 calls.length=0;
 await page.locator('#preview-demo-link').click();
 await expect(page.locator('.teams-topbar')).toContainText('Flutter Delivery Team');
 await expect(page.locator('.teams-main')).toContainText('fictional teammates');
 await expect(page.getByRole('button',{name:'Create team workspace',exact:true})).toHaveCount(0);
 for(const name of ['Tasks','Team Debug Sync','Projects & services','Device Lab','Handoffs & approvals','Members & access','Activity log']){
  await page.getByRole('button',{name,exact:true}).click();
  await expect(page.locator('.teams-main h1')).toHaveText(name);
  const text=await page.locator('.teams-application').innerText();
  expect(text).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}|\/Users\/|\/Volumes\/|github\.com|[a-f0-9]{40,}/i);
 }
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Personal',exact:true}).click();
 await expect(page.locator('#devices-grid')).toBeVisible();
 expect(calls).toEqual([]);expect(errors).toEqual([]);
});

test('Teams preview notification bell stays local and fits Vietnamese mobile',async({page},testInfo)=>{
 const requests=[],errors=[];page.on('request',r=>{if(r.url().includes('/api/'))requests.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:375,height:812});await page.goto('demo/?product=teams&lang=vi');
 const bell=page.locator('.notification-trigger:visible'),panel=page.locator('.notification-panel');
 await bell.click();await expect(panel).toBeVisible();await expect(panel).toContainText('Cấu hình dự án đã cập nhật');
 await panel.getByRole('button',{name:'Đọc tất cả',exact:true}).click();await expect(bell.locator('.notification-count')).toHaveCount(0);
 await panel.getByRole('button',{name:'Chưa đọc',exact:true}).click();await expect(panel).toContainText('Bạn đã đọc hết thông báo.');
 await page.screenshot({path:testInfo.outputPath('notifications-vi-mobile.png'),animations:'disabled'});
 await panel.getByRole('button',{name:'Tất cả',exact:true}).click();
 await page.evaluate(()=>{localStorage.setItem('snapkit-theme','dark');window.dispatchEvent(new StorageEvent('storage',{key:'snapkit-theme',newValue:'dark'}));});
 await expect.poll(()=>panel.evaluate(el=>{const color=getComputedStyle(el).color;return getComputedStyle(el.querySelector('strong')).color===color&&getComputedStyle(el.querySelector('button[aria-pressed=false]')).color===color;})).toBe(true);
 await page.screenshot({path:testInfo.outputPath('notifications-vi-mobile-dark.png'),animations:'disabled'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(requests).toEqual([]);expect(errors).toEqual([]);
});

test('Flutter workspace sample explains all 11 teammates, project layers and the missing QA step',async({page},testInfo)=>{
 const calls=[],errors=[];page.on('request',r=>{if(/\/(api|v1)\//.test(new URL(r.url()).pathname))calls.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:1100});await page.goto('demo/?product=teams&lang=vi');
 await expect(page.locator('.teams-workspace-summary')).toContainText('Flutter Commerce');await expect(page.locator('.teams-team-groups')).toContainText('Mobile 03');await expect(page.locator('.teams-team-groups')).toContainText('Backend 06');await expect(page.locator('.teams-next-action')).toContainText('Cần thêm người kiểm thử QA');await expect(page.locator('.teams-setup')).toHaveCount(0);
 await page.screenshot({path:testInfo.outputPath('flutter-overview-desktop.png'),animations:'disabled'});
 await page.evaluate(()=>{localStorage.setItem('snapkit-theme','dark');window.dispatchEvent(new StorageEvent('storage',{key:'snapkit-theme',newValue:'dark'}));});
 await expect.poll(()=>page.locator('.teams-module').first().evaluate(el=>getComputedStyle(el).color===getComputedStyle(document.body).color)).toBe(true);
 await page.screenshot({path:testInfo.outputPath('flutter-overview-desktop-dark.png'),animations:'disabled'});
 await page.getByRole('button',{name:'Thành viên & quyền',exact:true}).click();await expect(page.locator('.teams-table tbody tr').first()).toBeVisible();await expect(page.locator('.teams-table').first().locator('tbody tr')).toHaveCount(11);await expect(page.locator('.teams-permissions')).not.toHaveAttribute('open');
 await page.getByRole('button',{name:'Dự án & dịch vụ',exact:true}).click();await expect(page.locator('.teams-service')).toHaveCount(7);await expect(page.locator('.teams-service-list')).toContainText('Flutter');await expect(page.locator('.teams-project .project-icon')).toBeVisible();
 await page.setViewportSize({width:375,height:812});await page.getByRole('button',{name:'Tổng quan',exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath('flutter-overview-mobile.png'),animations:'disabled'});
 expect(calls).toEqual([]);expect(errors).toEqual([]);
});

 test('visual landing uses real localized captures and respects reduced motion', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const [url,suffix] of [['./?lang=vi','-vi'],['en/?lang=en','']]) {
    await page.goto(url);
    const images=page.locator('[data-visual-image]');
    expect(await images.count()).toBeGreaterThan(10);
    for(const image of await images.all()) {
      await image.scrollIntoViewIfNeeded();
      await expect(image).toHaveAttribute('src',new RegExp(`${suffix}\\.webp$`));
      await expect.poll(()=>image.evaluate(el=>el.complete&&el.naturalWidth>0)).toBe(true);
    }
    expect(await page.locator('.hero-screen').evaluate(el=>getComputedStyle(el).transform)).toBe('none');
    await page.setViewportSize({width:390,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await chooseLanguage(page,'vi');
  await expect(page.locator('.hero-screen img')).toHaveAttribute('src','assets/visual/devices-vi.webp');
});

test('task filters never leave an unrelated detail beside an empty board',async({page})=>{
 await page.goto('demo/?product=teams&lang=en');
 await page.getByRole('button',{name:'Tasks',exact:true}).click();
 const cards=page.locator('.teams-task-card'),detail=page.getByRole('region',{name:'Task details'});
 await expect(cards.first()).toBeVisible();
 await cards.last().click();
 const firstTitle=await cards.first().locator('strong').innerText();
 await page.getByRole('textbox',{name:'Search tasks',exact:true}).fill(firstTitle);
 await expect(detail.locator('h2')).toHaveText(firstTitle);
 await page.getByRole('textbox',{name:'Search tasks',exact:true}).fill('no-such-task-unique-123');
 await expect(page.getByRole('heading',{name:'No tasks in this view',exact:true})).toBeVisible();
 await expect(detail).toHaveCount(0);
 await expect(page.locator('.teams-task-layout')).toHaveCount(0);
 await page.getByRole('button',{name:'Clear filters',exact:true}).click();
 await expect(cards.first()).toBeVisible();await expect(detail).toBeVisible();
 await page.getByRole('button',{name:'My work',exact:true}).click();
 if(await cards.count()===0)await expect(detail).toHaveCount(0);
 else await expect(page.locator('.teams-task-card[aria-pressed=true]')).toHaveCount(1);
});

test('everyday kit landing links open usable local tools in the static demo',async({page})=>{
 const calls=[];page.on('request',r=>{if(/\/(api|v1)\//.test(new URL(r.url()).pathname))calls.push(r.url());});
 await page.goto('en/');const section=page.locator('#everyday-kit');await expect(section).toContainText('Everyday tools for everyone');await expect(section.locator('[data-visual-image]')).toHaveCount(4);await section.getByRole('link',{name:'Try the everyday kit',exact:true}).click();calls.length=0;
 await expect(page.getByRole('heading',{name:'File Kit',exact:true})).toBeVisible();await page.getByRole('button',{name:'Try sample',exact:true}).click();await expect(page.locator('.kit-rename-table')).toContainText('Trip-001-');await expect(page.getByRole('button',{name:'Apply filename changes',exact:true})).toBeDisabled();await page.getByRole('button',{name:'QR Kit',exact:true}).click();await page.getByRole('button',{name:'Generate QR code',exact:true}).click();await expect(page.getByAltText('Generated QR code')).toBeVisible();expect(calls).toEqual([]);
});

 test('public Teams previews preserve saved product choice and utility deep links always open Personal',async({page})=>{
 await page.goto('./');await page.evaluate(()=>localStorage.setItem('snapkit-product-mode','personal'));await page.goto('demo/?product=teams&lang=en');await expect(page.locator('body')).toHaveAttribute('data-product-mode','teams');expect(await page.evaluate(()=>localStorage.getItem('snapkit-product-mode'))).toBe('personal');await page.evaluate(()=>localStorage.setItem('snapkit-product-mode','teams'));await page.goto('demo/?page=kit&tool=rename&lang=en');await expect(page.getByRole('heading',{name:'File Kit',exact:true})).toBeVisible();await expect(page.locator('body')).toHaveAttribute('data-product-mode','personal');expect(await page.evaluate(()=>localStorage.getItem('snapkit-product-mode'))).toBe('teams');
});
