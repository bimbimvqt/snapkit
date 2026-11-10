import { test, expect } from '@playwright/test';
const paths=['','en/'];
test('all public search URLs render useful HTML without JavaScript and have reciprocal locale metadata',async({browser,baseURL,request})=>{
 const context=await browser.newContext({javaScriptEnabled:false}); const page=await context.newPage();
 const titles=new Set();
 for(const route of paths){
  const response=await page.goto(new URL(route,baseURL).href); expect(response.status()).toBe(200);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href',`https://snapkit.vn/${route}`);
  await expect(page.locator('html')).toHaveAttribute('lang',route.startsWith('en/')?'en':'vi');
  await expect(page.locator('meta[name=description]')).toHaveAttribute('content',/.{70,}/);
  await expect(page.locator('meta[name=google-site-verification]')).toHaveAttribute('content','h-jvHlvNiofEYSwQKFkzZWamKLfht3U6WtMXhk_v2CA');
  const title=await page.title();expect(titles.has(title)).toBe(false);titles.add(title);
  expect((await page.locator('main').innerText()).length).toBeGreaterThan(450);
  const alternates=await page.locator('link[rel=alternate][hreflang]').evaluateAll(nodes=>nodes.map(n=>({lang:n.hreflang,url:n.href})));
  expect(alternates.map(a=>a.lang)).toEqual(['vi','en','x-default']);
  for(const alt of alternates.filter(a=>a.lang!=='x-default')){
   const local=alt.url.replace('https://snapkit.vn/',baseURL);const html=await (await request.get(local)).text();
   expect(html).toContain(`rel="canonical" href="${alt.url}"`);
  }
  const schemas=await page.locator('script[type="application/ld+json"]').allTextContents();
  for(const schema of schemas) expect(JSON.parse(schema)['@graph'].length).toBeGreaterThan(0);
 }
 const sitemap=await (await request.get('sitemap.xml')).text();expect([...sitemap.matchAll(/<loc>/g)].length).toBe(2);
 for(const route of paths) expect(sitemap).toContain(`<loc>https://snapkit.vn/${route}</loc>`);
 await context.close();
});
test('English landing stays English with JavaScript and its product links, previews and language switching work',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('en/');await expect(page.locator('html')).toHaveAttribute('lang','en');
 await expect(page.locator('.hero-product')).toContainText('desktop app');
 await expect(page.locator('#teams a.button')).toHaveAttribute('href','demo/?product=teams');
 await page.locator('[data-preview=setup]').click();await expect(page.locator('#app-preview')).toHaveAttribute('src','assets/setup.webp?v=20261106-images46');
 await page.locator('[data-language-select]').click();await page.locator('[data-language=vi]').click();
 await expect(page.locator('.hero-product')).toContainText('Ứng dụng desktop');
 expect(errors).toEqual([]);
});
test('retired documentation URLs return 404 and recovery stays on the product site',async({request})=>{
 for(const route of ['huong-dan/','en/guides/','huong-dan/flutter-multi-device-debugging/','en/guides/install-snapkit-macos-windows/']){
  const response=await request.get(route);expect(response.status()).toBe(404);
  expect(await response.text()).not.toMatch(/href="[^"]*(?:guides\/|huong-dan\/|blob\/main|#readme)/);
 }
});
test('static private app surfaces explicitly prevent search indexing',async({request})=>{
 for(const route of ['demo/','control/','preview/','admin/','auth/complete.html']){
  const html=await(await request.get(route)).text();expect(html).toMatch(/name="robots" content="noindex,nofollow"/);
 }
});
