import { test, expect } from '@playwright/test';
const slugs=['flutter-multi-device-debugging','react-native-multi-device-debugging','android-emulator-ios-simulator','install-snapkit-macos-windows','snapkit-teams-workflow','snapkit-everyday-kit'];
const paths=['','en/','huong-dan/','en/guides/',...slugs.flatMap(slug=>[`huong-dan/${slug}/`,`en/guides/${slug}/`])];
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
 const sitemap=await (await request.get('sitemap.xml')).text();expect([...sitemap.matchAll(/<loc>/g)].length).toBe(paths.length);
 for(const route of paths) expect(sitemap).toContain(`<loc>https://snapkit.vn/${route}</loc>`);
 await context.close();
});
test('English landing stays English with JavaScript and its guide links, previews and language switching work',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('en/');await expect(page.locator('html')).toHaveAttribute('lang','en');
 await expect(page.locator('.hero-product')).toContainText('desktop app');
 await expect(page.locator('#teams a.button').first()).toHaveAttribute('href','demo/?product=teams');
 await page.locator('[data-preview=setup]').click();await expect(page.locator('#app-preview')).toHaveAttribute('src','assets/setup.webp?v=20261113-cleanup83');
 await page.locator('[data-language-select]').click();await page.locator('[data-language=vi]').click();
 await expect(page.locator('.hero-product')).toContainText('Ứng dụng desktop');
 expect(errors).toEqual([]);
});
test('guides are usable on small screens, provide related links and keyboard navigation',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const lang of ['vi','en']){
  await page.goto(`${lang==='vi'?'huong-dan':'en/guides'}/${slugs[0]}/`);
  for(const width of [375,768,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await page.locator('.guide-toc a').first().click();await expect(page.locator('#step-1')).toBeInViewport();
  await expect(page.locator('.guide-related .guide-card')).toHaveCount(slugs.length-1);
  await page.screenshot({path:`/tmp/snapkit-seo-guide-${lang}.png`,fullPage:true});
 }
});
test('static private app surfaces explicitly prevent search indexing',async({request})=>{
 for(const route of ['demo/','control/','preview/','admin/','auth/complete.html']){
  const html=await(await request.get(route)).text();expect(html).toMatch(/name="robots" content="noindex,nofollow"/);
 }
});

test('guide library and articles keep readable navigation and real app images in both languages',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 for(const lang of ['vi','en']){
  const root=lang==='vi'?'huong-dan/':'en/guides/';
  await page.goto(root);
  await expect(page.locator('.guide-start a')).toHaveCount(3);
  await expect(page.locator('.guide-library .guide-card')).toHaveCount(slugs.length);
  for(const width of [375,768,1440]){
   await page.setViewportSize({width,height:1000});
   await page.locator('.guide-card').last().scrollIntoViewIfNeeded();
   await expect.poll(()=>page.locator('.guide-card-image img').evaluateAll(nodes=>nodes.every(img=>img.complete&&img.naturalWidth>0))).toBe(true);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.screenshot({path:`/tmp/snapkit-guide-library-${lang}.png`,fullPage:true});
  await page.goto(root+'snapkit-teams-workflow/');
  await expect(page.locator('.guide-step-number')).toHaveCount(6);
  await page.locator('.guide-heading .button').click();await expect(page.locator('#step-1')).toBeInViewport();
  await page.locator('.guide-toc nav a').last().click();await expect(page.locator('#step-6')).toBeInViewport();
  await page.screenshot({path:`/tmp/snapkit-guide-teams-${lang}.png`,fullPage:true});
 }
 expect(errors).toEqual([]);
});
test('retired developer lab is absent from landing, guides and sitemap',async({page,request})=>{
 await page.goto('./?lang=en');await expect(page.locator('#dev-lab')).toHaveCount(0);await expect(page.getByRole('link',{name:'Dev Lab guide',exact:true})).toHaveCount(0);
 const sitemap=await request.get('sitemap.xml');expect(await sitemap.text()).not.toContain('dev-lab-mcp-performance');
 for(const path of ['huong-dan/dev-lab-mcp-performance/','en/guides/dev-lab-mcp-performance/'])expect((await request.get(path)).status()).toBe(404);
});
