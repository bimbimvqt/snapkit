import { test, expect } from './fixtures.js';
const photo = { id:'preview-image',deviceName:'Test phone',kind:'image',status:'ready',createdAt:'2026-11-03T03:00:00Z' };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
async function mockGallery(page,captures,file){
 await page.route('**/api/tools',route=>route.fulfill({json:{sets:[],jobs:[],recordings:[],captures}}));
 await page.route('**/api/tools/captures/*/file',file);
}
test('photos appear automatically and open a large accessible preview with download and close',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await mockGallery(page,[photo],route=>route.fulfill({body:png,contentType:'image/png'}));
 await page.goto('/?lang=vi');await page.locator('[data-app-page="captures"]').click();
 const tile=page.locator('.capture-thumbnail');await expect(tile.locator('img')).toBeVisible();await expect(tile).not.toHaveAttribute('aria-busy');
 await tile.click();await expect(page.locator('#capture-viewer')).toBeVisible();await expect(page.locator('#capture-viewer img')).toBeVisible();
 await expect(page.locator('#capture-viewer-title')).toHaveText('Test phone');
 const download=page.waitForEvent('download');await page.locator('#capture-viewer-download').click();expect((await download).suggestedFilename()).toMatch(/\.png$/);
 await page.keyboard.press('Escape');await expect(page.locator('#capture-viewer')).toBeHidden();await expect(tile).toBeFocused();
 await page.setViewportSize({width:375,height:844});await tile.click();expect(await page.locator('#capture-viewer').evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true);
 await page.screenshot({path:'/tmp/snapkit-image-preview-beta16.png',animations:'disabled'});await page.locator('#capture-viewer .close-dialog').first().click();
 await page.locator('[data-app-page="devices"]').click();await page.locator('[data-app-page="captures"]').click();await expect(tile.locator('img')).toBeVisible();expect(errors).toEqual([]);
});
test('video automatically shows a poster and opens a playable full preview',async({page})=>{
 await page.goto('/?lang=en');
 const bytes=await page.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=240;const ctx=canvas.getContext('2d');ctx.fillStyle='#a7e982';ctx.fillRect(0,0,320,240);
  let frame=0;const painting=setInterval(()=>{ctx.fillStyle=frame++%2?'#a7e982':'#8bc86c';ctx.fillRect(0,0,320,240);},40);
  const stream=canvas.captureStream(10),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'}),chunks=[];
  return new Promise(resolve=>{recorder.ondataavailable=event=>chunks.push(event.data);recorder.onstop=async()=>{clearInterval(painting);stream.getTracks().forEach(track=>track.stop());resolve([...new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer())]);};recorder.start();setTimeout(()=>recorder.stop(),900);});
 });
 await mockGallery(page,[{...photo,id:'preview-video',kind:'video'}],route=>route.fulfill({body:Buffer.from(bytes),contentType:'video/webm'}));
 await page.locator('[data-app-page="captures"]').click();const tile=page.locator('.capture-thumbnail');await expect(tile.locator('img')).toBeVisible();await expect(tile.locator('.capture-play')).toBeVisible();
 await tile.click();const video=page.locator('#capture-viewer video');await expect(video).toBeVisible();await expect(video).toHaveAttribute('controls','');await expect.poll(()=>video.evaluate(node=>node.readyState)).toBeGreaterThanOrEqual(1);
 await video.evaluate(node=>node.play());await expect.poll(()=>video.evaluate(node=>node.paused)).toBe(false);
 await page.screenshot({path:'/tmp/snapkit-video-preview-beta16.png',animations:'disabled'});await page.keyboard.press('Escape');await expect(page.locator('#capture-viewer video')).toHaveCount(0);
});
test('failed thumbnail remains clickable and preview can retry a failed request',async({page})=>{
 let healthy=false;
 await mockGallery(page,[photo],route=>healthy?route.fulfill({body:png,contentType:'image/png'}):route.fulfill({status:503,json:{error:'Unavailable'}}));
 await page.goto('/?lang=en');await page.locator('[data-app-page="captures"]').click();const tile=page.locator('.capture-thumbnail');await expect(tile).toContainText('Preview unavailable');await tile.click();await expect(page.locator('#capture-viewer-retry')).toBeVisible();healthy=true;await page.locator('#capture-viewer-retry').click();await expect(page.locator('#capture-viewer img')).toBeVisible();
});
