import {test,expect} from '@playwright/test';
const paused=page=>page.locator('#debug-video').evaluate(video=>video.paused);
test('Debug Sync is default, autoplays only in view, pauses on image tabs and follows locale',async({page})=>{
  await page.setViewportSize({width:1440,height:900});await page.goto('./?lang=vi');
  await expect(page.locator('[data-preview=debug]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#app-preview')).toBeHidden();
  await page.locator('#debug-video').scrollIntoViewIfNeeded();await expect.poll(()=>paused(page)).toBe(false);
  await expect(page.locator('#debug-video')).toHaveAttribute('src','assets/debug-sync/vi.mp4');
  await page.locator('[data-language-select]').click();await page.locator('[data-language=en]').click();
  await expect(page.locator('#debug-video')).toHaveAttribute('src','assets/debug-sync/en.mp4');
  await expect(page.locator('#debug-video')).toHaveAttribute('poster','assets/debug-sync/en.webp');
  await expect(page.locator('#preview-caption')).toContainText('illustration');
  await page.locator('#debug-video').scrollIntoViewIfNeeded();await expect.poll(()=>paused(page)).toBe(false);
  await page.locator('[data-preview=setup]').click();await expect(page.locator('#app-preview')).toBeVisible();await expect.poll(()=>paused(page)).toBe(true);
  await page.locator('[data-preview=debug]').click();await page.locator('#debug-video').scrollIntoViewIfNeeded();await expect.poll(()=>paused(page)).toBe(false);
  await page.locator('#downloads').scrollIntoViewIfNeeded();await expect.poll(()=>paused(page)).toBe(true);
});
for(const mode of ['mobile','reduced motion'])test(`${mode} keeps a poster until play is requested`,async({page})=>{
  await page.setViewportSize({width:mode==='mobile'?390:1440,height:900});
  if(mode==='reduced motion')await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./?lang=en');await page.locator('#debug-video').scrollIntoViewIfNeeded();
  await expect(page.locator('#debug-play')).toBeVisible();expect(await paused(page)).toBe(true);
  await page.locator('#debug-play').click();await expect.poll(()=>paused(page)).toBe(false);
  await expect(page.locator('#debug-play')).toBeHidden();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('video load failure exposes retry while image previews remain usable',async({page})=>{
  await page.route('**/debug-sync/*.mp4',route=>route.abort());await page.goto('./?lang=vi');
  await page.locator('#debug-video').scrollIntoViewIfNeeded();await expect(page.locator('#debug-retry')).toBeVisible();
  await expect(page.locator('#debug-video-status')).toContainText('Chưa tải được video');
  await page.locator('[data-preview=devices]').click();await expect(page.locator('#app-preview')).toBeVisible();
});
test('buffering shows a preview skeleton and clears it after the video is ready',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  let release;const gate=new Promise(resolve=>{release=resolve;});
  await page.route('**/debug-sync/*.mp4',async route=>{await gate;await route.continue();});
  await page.goto('./?lang=vi');await page.locator('#debug-video').scrollIntoViewIfNeeded();
  await page.locator('#debug-play').click();
  await expect(page.locator('#preview-loading')).toBeVisible();
  await expect(page.locator('.app-window')).toHaveAttribute('aria-busy','true');
  await page.locator('.preview-stage').screenshot({path:'/tmp/snapkit-preview-shimmer.png'});
  release();await expect.poll(()=>page.locator('#debug-video').evaluate(video=>video.readyState>=3)).toBe(true);
  await expect(page.locator('#preview-loading')).toBeHidden();
  await page.locator('.preview-stage').screenshot({path:'/tmp/snapkit-debug-sync-live-preview.png'});
});
