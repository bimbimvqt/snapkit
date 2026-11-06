import {test,expect} from './fixtures.js';
const tools={ready:true,platform:'darwin',arch:'arm64',memoryGB:16,checks:[{id:'flutter',title:'Flutter',status:'ready',detail:'Flutter 3.38',help:'https://docs.flutter.dev'}],storage:{root:'/Sample/Snapkit'},advice:'Start only the devices you need.'};

test('setup keeps a complete loading layout, shares pending checks and retains results during refresh',async({page})=>{
  const pending=[];let requests=0;
  await page.route('**/api/diagnostics*',async route=>{requests++;await new Promise(resolve=>pending.push(resolve));await route.fulfill({json:tools});});
  await page.goto('/');
  await page.locator('[data-app-page="setup"]').click();
  await expect(page.locator('#setup-loading')).toBeVisible();
  await expect(page.locator('#setup-content')).toBeHidden();
  await expect(page.locator('#setup-status')).toHaveText('Checking your tools…');
  await expect.poll(()=>requests).toBe(1);
  await page.locator('[data-app-page="devices"]').click();
  await page.locator('[data-app-page="setup"]').click();
  expect(requests).toBe(1);
  await page.locator('[data-language-select]').click();await page.locator('[data-language="vi"]').click();
  await expect(page.locator('#setup-status')).toHaveText('Đang kiểm tra công cụ…');
  for(const width of [375,768,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await page.emulateMedia({reducedMotion:'reduce'});
  expect(await page.locator('#setup-status').evaluate(el=>getComputedStyle(el,'::before').animationName)).toBe('none');
  await page.locator('#theme-toggle').click();
  await page.getByRole('radio', {name:'Sáng', exact:true}).check();
  await page.locator('[data-app-page="setup"]').click();
  await page.screenshot({path:'/tmp/snapkit-setup-loading-light.png'});
  await page.locator('#theme-toggle').click();
  await page.getByRole('radio', {name:'Tối', exact:true}).check();
  await page.locator('[data-app-page="setup"]').click();
  await page.screenshot({path:'/tmp/snapkit-setup-loading.png'});
  pending.shift()();
  await expect(page.locator('#setup-content')).toBeVisible();
  await expect(page.locator('#setup-loading')).toBeHidden();
  await expect(page.locator('[data-editor]')).toHaveCount(3);
  await page.locator('#check-tools').click();
  await expect.poll(()=>requests).toBe(2);
  await expect(page.locator('#setup-content')).toBeVisible();
  await expect(page.locator('#setup-loading')).toBeHidden();
  await expect(page.locator('#setup-status')).toHaveText('Đang kiểm tra lại công cụ…');
  await expect(page.locator('#check-tools')).toBeDisabled();
  pending.shift()();
  await expect(page.locator('#check-tools')).toBeEnabled();
  await page.locator('[data-app-page="devices"]').click();await page.locator('[data-app-page="setup"]').click();
  expect(requests).toBe(2);
});

test('setup waits for editor preferences before showing the completed screen',async({page})=>{
  let allowProduct;
  const productGate=new Promise(resolve=>{allowProduct=resolve;});
  await page.route('**/api/product',async route=>{
    const response=await route.fetch();const data=await response.json();
    data.preferences.editor='cursor';data.preferences.developerProfile={role:'frontend',framework:'flutter'};
    await productGate;await route.fulfill({json:data});
  });
  await page.route('**/api/diagnostics*',route=>route.fulfill({json:tools}));
  await page.goto('/');await page.locator('[data-app-page="setup"]').click();
  await expect(page.locator('#setup-loading')).toBeVisible();
  await expect(page.locator('#setup-content')).toBeHidden();
  await expect.poll(()=>!!allowProduct).toBe(true);allowProduct();

  await expect(page.locator('#setup-content')).toBeVisible();
  await expect(page.locator('#setup-error')).toBeHidden();
  await expect(page.locator('[data-editor="cursor"]')).toHaveAttribute('aria-pressed','true');
});


test('setup offers recovery when diagnostics fail and succeeds on retry',async({page})=>{
  let attempts=0;
  await page.route('**/api/diagnostics*',route=>{attempts++;return attempts===1?route.fulfill({status:503,json:{error:'Tool service unavailable'}}):route.fulfill({json:tools});});
  await page.goto('/');
  await expect(page.locator('[data-editor]')).toHaveCount(3);
  await page.locator('[data-app-page="setup"]').click();
  await expect(page.locator('#setup-error')).toBeVisible();
  await expect(page.locator('#setup-loading')).toBeHidden();
  await expect(page.locator('#setup-content')).toBeHidden();
  await page.locator('#setup-retry').click();
  await expect(page.locator('#setup-content')).toBeVisible();
  await expect(page.locator('#setup-error')).toBeHidden();
  expect(attempts).toBe(2);
});
