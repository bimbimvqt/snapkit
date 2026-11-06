import { test, expect } from '@playwright/test';
test('feedback preserves failed drafts, submits reviews and works in both languages on mobile', async ({page}) => {
  await page.route('**/v1/public/content',route=>route.fulfill({json:{landing:{}}}));
  let fail = true, sent;
  await page.route('**/v1/feedback',async route=>{
    sent = route.request().postDataJSON();
    if(fail) await route.fulfill({status:503,json:{error:'Unavailable'}});
    else await route.fulfill({status:201,json:{received:true,id:'test-id'}});
  });
  await page.goto('./?lang=vi#feedback');
  await page.locator('#feedback-type').selectOption('review');
  await expect(page.locator('#feedback-rating')).toBeVisible();
  await page.locator('#feedback-rating').selectOption('4');
  await page.locator('#feedback-message').fill('Thiết bị chạy tốt, mong có thêm nhóm thiết bị.');
  await page.locator('#feedback-email').fill('developer@example.com');
  await page.locator('#feedback-form button[type=submit]').click();
  await expect(page.locator('#feedback-status')).toHaveAttribute('data-state','error');
  await expect(page.locator('#feedback-message')).toHaveValue('Thiết bị chạy tốt, mong có thêm nhóm thiết bị.');
  fail = false;
  await page.locator('#feedback-form button[type=submit]').click();
  await expect(page.locator('#feedback-status')).toHaveAttribute('data-state','success');
  expect(sent.rating).toBe(4); expect(sent.type).toBe('review');
  await expect(page.locator('#feedback-message')).toHaveValue('');
  await page.locator('[data-language-select]').click(); await page.locator('[data-language=en]').click();
  await expect(page.locator('#feedback-status')).toContainText('Feedback received');
  await expect(page.locator('#feedback-form')).toContainText('Your feedback');
  for(const width of [375,768,1440]) {
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('[data-language-select]').click(); await page.locator('[data-language=vi]').click();
  await page.locator('#feedback').scrollIntoViewIfNeeded();
  await page.screenshot({path:'/tmp/snapkit-feedback-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  await page.locator('#feedback-form').scrollIntoViewIfNeeded();
  await page.screenshot({path:'/tmp/snapkit-feedback-mobile.png'});
});
test('gallery keeps selected tab and displayed image together while the next image is loading',async({page})=>{
  await page.goto('./?lang=vi');
  await expect(page.locator('#app-preview')).toHaveAttribute('src',/devices-vi/);
  let release;
  const gate = new Promise(resolve=>{release=resolve;});
  await page.route('**/assets/releases-vi.png?*',async route=>{await gate; await route.continue();});
  await page.locator('[data-preview=releases]').click();
  await expect(page.locator('.app-window')).toHaveAttribute('aria-busy','true');
  await expect(page.locator('[data-preview=devices]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#app-preview')).toHaveAttribute('src',/devices-vi/);
  release();
  await expect(page.locator('[data-preview=releases]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#app-preview')).toHaveAttribute('src',/releases-vi/);
  await expect(page.locator('#preview-caption')).toContainText('Build & phát hành');
});
test('SEO includes canonical, social cards, valid software schema, robots and sitemap',async({page,request})=>{
  await page.goto('./?lang=vi');
  await expect(page).toHaveTitle(/Snapkit.*Flutter, React Native/);
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href','https://snapkit.vn/');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content',/^https:\/\/snapkit.vn\//);
  const schema = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
  expect(schema['@graph'].some(entry=>entry['@type']==='SoftwareApplication')).toBe(true);
  expect(JSON.stringify(schema)).not.toContain('aggregateRating');
  expect(await (await request.get('robots.txt')).text()).toContain('Sitemap: https://snapkit.vn/sitemap.xml');
  expect(await (await request.get('sitemap.xml')).text()).toContain('<loc>https://snapkit.vn/</loc>');
});
