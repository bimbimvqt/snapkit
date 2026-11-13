import {test,expect} from './fixtures.js';import jsQR from 'jsqr';
const open=async(page,tool)=>{await page.goto('/?page=kit');await page.getByRole('button',{name:'Everyday tools',exact:true}).click();await page.getByRole('button',{name:tool,exact:true}).click();};
test('file renaming previews real names and conflicts without modifying browser files',async({page})=>{await open(page,'File Kit');await page.getByRole('button',{name:'Try sample',exact:true}).click();await expect(page.locator('.kit-rename-table')).toContainText('Trip-001-Holiday photo.jpg');await expect(page.getByRole('button',{name:'Apply filename changes'})).toBeDisabled();await page.getByLabel('Prefix',{exact:true}).fill('CON:');await expect(page.locator('.kit-rename-table')).toContainText('Use a valid filename');await page.getByLabel('Prefix',{exact:true}).fill('');await page.getByLabel('Files to rename',{exact:true}).setInputFiles([{name:'alpha.txt',mimeType:'text/plain',buffer:Buffer.from('A')},{name:'beta.txt',mimeType:'text/plain',buffer:Buffer.from('B')}]);await page.getByLabel('Add sequence numbers').uncheck();await page.getByLabel('Find in name',{exact:true}).fill('beta');await page.getByLabel('Replace with',{exact:true}).fill('alpha');await expect(page.locator('.kit-rename-table')).toContainText('Two files would have the same name');});
test('QR image decodes to the original Unicode text and stale outputs clear on edit',async({page})=>{await open(page,'QR Kit');const text='Snapkit · Xin chào Việt Nam';await page.getByLabel('Link or text',{exact:true}).fill(text);await page.getByRole('button',{name:'Generate QR code',exact:true}).click();const qr=page.getByAltText('Generated QR code');await expect(qr).toBeVisible();const raw=await qr.evaluate(async img=>{await img.decode();const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return {width:c.width,height:c.height,data:Array.from(ctx.getImageData(0,0,c.width,c.height).data)};});expect(jsQR(Uint8ClampedArray.from(raw.data),raw.width,raw.height)?.data).toBe(text);const download=page.waitForEvent('download');await page.getByRole('button',{name:'Save QR image',exact:true}).click();expect((await download).suggestedFilename()).toBe('snapkit-qr.png');await page.getByLabel('Link or text',{exact:true}).fill('Changed');await expect(qr).toHaveCount(0);});
test('capture redaction writes opaque pixels to the exported PNG and undo restores the image',async({page})=>{await open(page,'Snap Capture');await page.getByRole('button',{name:'Try sample',exact:true}).click();const canvas=page.getByLabel('Annotation canvas',{exact:true});await expect(canvas).toBeVisible();await page.getByRole('button',{name:'Cover private text',exact:true}).click();const box=await canvas.boundingBox();await page.mouse.move(box.x+box.width*.1,box.y+box.height*.1);await page.mouse.down();await page.mouse.move(box.x+box.width*.4,box.y+box.height*.4);await page.mouse.up();expect(await canvas.evaluate(c=>Array.from(c.getContext('2d').getImageData(c.width*.2,c.height*.2,1,1).data))).toEqual([0,0,0,255]);const d=page.waitForEvent('download');await page.getByRole('button',{name:'Save annotated image',exact:true}).click();const download=await d;const stream=await download.createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);const b64=Buffer.concat(chunks).toString('base64');const pixel=await page.evaluate(async data=>{const image=await createImageBitmap(new Blob([Uint8Array.from(atob(data),c=>c.charCodeAt(0))],{type:'image/png'}));const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return Array.from(ctx.getImageData(c.width*.2,c.height*.2,1,1).data);},b64);expect(pixel).toEqual([0,0,0,255]);await page.getByRole('button',{name:'Undo annotation',exact:true}).click();expect(await canvas.evaluate(c=>Array.from(c.getContext('2d').getImageData(c.width*.2,c.height*.2,1,1).data))).not.toEqual([0,0,0,255]);await page.getByRole('button',{name:'Discard image',exact:true}).click();await expect(canvas).toHaveCount(0);});
test('clipboard sample clears and the new tools fit mobile in both languages',async({page})=>{await open(page,'Clipboard Kit');await page.getByRole('button',{name:'Try sample',exact:true}).click();await expect(page.locator('.kit-clipboard-list')).toContainText('sample text');await page.getByRole('button',{name:'Clear history',exact:true}).click();await expect(page.locator('.kit-clipboard-list article')).toHaveCount(0);for(const tool of ['File Kit','QR Kit','Snap Capture','Clipboard Kit']){await page.getByRole('button',{name:tool,exact:true}).click();await page.setViewportSize({width:375,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}await page.locator('[data-language-select]').click();await page.locator('[data-language=vi]').click();await expect(page.locator('#kit-root')).toContainText('Lịch sử ở trong bộ nhớ');});
test('native clipboard failure pauses the toggle and shows an inline localized error',async({page})=>{await page.addInitScript(()=>{let state={enabled:false,items:[]};window.snapkitDesktop={clipboardState:async()=>state,clipboardEnabled:async()=>{state={enabled:false,items:[],error:'Clipboard capture paused. Turn it on to try again.'};return state;}};});await open(page,'Clipboard Kit');await page.getByLabel('Capture new copied text for this session',{exact:true}).click();await expect(page.getByLabel('Capture new copied text for this session',{exact:true})).not.toBeChecked();await expect(page.locator('.kit-card [role=alert]')).toHaveText('Clipboard capture paused. Turn it on to try again.');await page.evaluate(()=>window.SnapkitI18n.setLanguage('vi'));await expect(page.locator('.kit-card [role=alert]')).toHaveText('Đã tạm dừng lưu clipboard. Bật lại để thử lần nữa.');});
test('screen capture requires explicit retry and never captures on window focus',async({page})=>{
 await page.addInitScript(()=>{window.captureCalls=0;window.settingsCalls=0;window.snapkitDesktop={captureScreens:async()=>{window.captureCalls++;return window.captureCalls<3?{error:window.captureCalls===1?'screen-permission':'mac-capture-failed'}:[{id:'screen:1',name:'Display 1',image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='}];},captureSettings:async()=>{window.settingsCalls++;return true;}};});
 await open(page,'Snap Capture');await page.getByRole('button',{name:'Choose screen',exact:true}).click();await expect(page.getByRole('alert')).toContainText('If it is already enabled');
 await page.getByRole('button',{name:'Open Screen Recording settings',exact:true}).click();expect(await page.evaluate(()=>window.settingsCalls)).toBe(1);
 await page.evaluate(()=>{for(let i=0;i<5;i++)window.dispatchEvent(new Event('focus'));});
 expect(await page.evaluate(()=>window.captureCalls)).toBe(1);await expect(page.getByRole('alert')).toContainText('If it is already enabled');
 await page.getByRole('button',{name:'Try again',exact:true}).click();await expect(page.getByRole('alert')).toContainText('macOS reports that Screen Recording is allowed');
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));expect(await page.evaluate(()=>window.captureCalls)).toBe(2);
 await page.getByRole('button',{name:'Try again',exact:true}).click();await expect(page.locator('.kit-screen-picker')).toContainText('Display 1');await expect(page.getByRole('alert')).toHaveCount(0);
});
test('annotation history supports undo, redo, keyboard shortcuts and clears the redo branch on a new mark',async({page})=>{
 await open(page,'Snap Capture');await page.getByRole('button',{name:'Try sample',exact:true}).click();const canvas=page.getByLabel('Annotation canvas',{exact:true});await expect(canvas).toBeVisible();
 const undo=page.getByRole('button',{name:'Undo annotation',exact:true}),redo=page.getByRole('button',{name:'Redo annotation',exact:true});await expect(undo).toBeDisabled();await expect(redo).toBeDisabled();
 const pixel=()=>canvas.evaluate(c=>Array.from(c.getContext('2d').getImageData(c.width*.2,c.height*.2,1,1).data));const original=await pixel();
 async function redact(){await page.getByRole('button',{name:'Cover private text',exact:true}).click();const box=await canvas.boundingBox();await page.mouse.move(box.x+box.width*.1,box.y+box.height*.1);await page.mouse.down();await page.mouse.move(box.x+box.width*.4,box.y+box.height*.4);await page.mouse.up();}
 await redact();expect(await pixel()).toEqual([0,0,0,255]);await page.keyboard.press('Control+z');expect(await pixel()).toEqual(original);await expect(undo).toBeDisabled();await expect(redo).toBeEnabled();
 await page.keyboard.press('Control+Shift+z');expect(await pixel()).toEqual([0,0,0,255]);await undo.click();await redo.click();expect(await pixel()).toEqual([0,0,0,255]);await page.keyboard.press('Meta+z');expect(await pixel()).toEqual(original);await page.keyboard.press('Meta+Shift+z');expect(await pixel()).toEqual([0,0,0,255]);
 await undo.click();await redact();await expect(redo).toBeDisabled();await page.getByRole('button',{name:'Discard image',exact:true}).click();await page.getByRole('button',{name:'Try sample',exact:true}).click();await expect(undo).toBeDisabled();await expect(redo).toBeDisabled();
});
test('system screen picker imports one frame and stops sharing immediately',async({page})=>{
 await page.addInitScript(()=>{
  window.pickerCalls=0;window.snapkitDesktop={captureScreens:async()=>({picker:'system'})};
  Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{value:async options=>{
   window.pickerCalls++;window.pickerOptions=options;const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;const ctx=canvas.getContext('2d');ctx.fillStyle='#ff0000';ctx.fillRect(0,0,160,90);const stream=canvas.captureStream(10);window.pickerTracks=stream.getTracks();return stream;
  }});
 });
 await open(page,'Snap Capture');expect(await page.evaluate(()=>window.pickerCalls)).toBe(0);
 await page.getByRole('button',{name:'Choose screen',exact:true}).click();const canvas=page.getByLabel('Annotation canvas',{exact:true});await expect(canvas).toBeVisible();expect(await canvas.evaluate(node=>Array.from(node.getContext('2d').getImageData(10,10,1,1).data))).toEqual([255,0,0,255]);
 expect(await canvas.evaluate(node=>Math.abs(node.getBoundingClientRect().width-node.parentElement.clientWidth)<2)).toBe(true);expect(await page.evaluate(()=>window.pickerTracks.every(track=>track.readyState==='ended'))).toBe(true);expect(await page.evaluate(()=>window.pickerOptions.audio)).toBe(false);
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));expect(await page.evaluate(()=>window.pickerCalls)).toBe(1);
});
test('dismissing the system picker never reports a missing global permission or retries automatically',async({page})=>{
 await page.addInitScript(()=>{window.pickerCalls=0;window.snapkitDesktop={captureScreens:async()=>({picker:'system'}),captureSettings:async()=>true};Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{value:async()=>{window.pickerCalls++;throw new DOMException('User cancelled','NotAllowedError');}});});
 await open(page,'Snap Capture');await page.getByRole('button',{name:'Choose screen',exact:true}).click();await expect(page.getByRole('alert')).toContainText('No screen was shared');await expect(page.getByRole('button',{name:'Open Screen Recording settings',exact:true})).toHaveCount(0);
 await page.evaluate(()=>{for(let i=0;i<5;i++)window.dispatchEvent(new Event('focus'));});expect(await page.evaluate(()=>window.pickerCalls)).toBe(1);
});
for(const surface of ['window','browser','monitor'])test(`system picker accepts the selected screen when Electron reports ${surface}`,async({page})=>{
 await page.addInitScript(surface=>{
  window.captureStops=0;window.snapkitDesktop={captureScreens:async()=>({picker:'system'})};
  Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{value:async options=>{
   window.captureOptions=options;const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;const ctx=canvas.getContext('2d');ctx.fillStyle='#00ff00';ctx.fillRect(0,0,160,90);const stream=canvas.captureStream(5),track=stream.getVideoTracks()[0];Object.defineProperty(track,'getSettings',{value:()=>({displaySurface:surface})});const stop=track.stop.bind(track);track.stop=()=>{window.captureStops++;stop();};return stream;
  }});
 },surface);
 await open(page,'Snap Capture');await page.getByRole('button',{name:'Choose screen',exact:true}).click();const canvas=page.getByLabel('Annotation canvas',{exact:true});await expect(canvas).toBeVisible();await expect(page.getByRole('alert')).toHaveCount(0);expect(await canvas.evaluate(node=>Array.from(node.getContext('2d').getImageData(10,10,1,1).data))).toEqual([0,255,0,255]);expect(await page.evaluate(()=>window.captureStops)).toBe(1);expect(await page.evaluate(()=>window.captureOptions.video.width.ideal)).toBe(7680);expect(await page.evaluate(()=>window.captureOptions.video.displaySurface)).toBe('monitor');
});
test('capture opens at editor width and supports zoomed drawing, scrolling and original-size export',async({page})=>{
 await open(page,'Snap Capture');await page.getByRole('button',{name:'Try sample',exact:true}).click();
 const canvas=page.getByLabel('Annotation canvas',{exact:true}),viewport=page.getByRole('region',{name:'Image editing area',exact:true});await expect(canvas).toBeVisible();
 const fit=()=>canvas.evaluate(node=>({width:node.getBoundingClientRect().width,viewport:node.parentElement.clientWidth,pixels:[node.width,node.height]}));const initial=await fit();expect(Math.abs(initial.width-initial.viewport)).toBeLessThan(2);expect(initial.pixels[0]).toBeCloseTo(initial.width,0);expect(initial.pixels[1]/initial.pixels[0]).toBeCloseTo(.6,2);
 await page.screenshot({path:'/tmp/snapkit-capture-fit79.png'});
 await page.getByRole('button',{name:'100%',exact:true}).click();await page.getByRole('button',{name:'Zoom in',exact:true}).click();await page.getByRole('button',{name:'Zoom in',exact:true}).click();await page.getByRole('button',{name:'Zoom in',exact:true}).click();
 expect((await fit()).width).toBeCloseTo(1950,0);expect(await viewport.evaluate(node=>node.scrollWidth>node.clientWidth)).toBe(true);
 await page.getByRole('button',{name:'Cover private text',exact:true}).click();await viewport.scrollIntoViewIfNeeded();await viewport.evaluate(node=>{node.scrollLeft=200;node.scrollTop=100;});
 const bounds=await viewport.boundingBox();const start={x:bounds.x+70,y:bounds.y+70},end={x:bounds.x+150,y:bounds.y+150};
 const pixel=await canvas.evaluate((node,point)=>{const rect=node.getBoundingClientRect();return {x:(point.x-rect.left)/rect.width,y:(point.y-rect.top)/rect.height};},{x:(start.x+end.x)/2,y:(start.y+end.y)/2});
 await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y);await page.mouse.up();
 expect(await canvas.evaluate((node,pixel)=>Array.from(node.getContext('2d').getImageData(Math.floor(pixel.x*node.width),Math.floor(pixel.y*node.height),1,1).data),pixel)).toEqual([0,0,0,255]);
 await page.getByRole('button',{name:'Fit to width',exact:true}).click();expect(Math.abs((await fit()).width-(await fit()).viewport)).toBeLessThan(2);expect((await fit()).pixels[0]).toBeCloseTo((await fit()).width,0);
 await page.getByRole('button',{name:'Undo annotation',exact:true}).click();expect(await canvas.evaluate((node,pixel)=>Array.from(node.getContext('2d').getImageData(Math.floor(pixel.x*node.width),Math.floor(pixel.y*node.height),1,1).data),pixel)).not.toEqual([0,0,0,255]);
 const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Save annotated image',exact:true}).click();const download=await downloaded;const chunks=[];for await(const chunk of await download.createReadStream())chunks.push(chunk);const png=Buffer.concat(chunks);expect([png.readUInt32BE(16),png.readUInt32BE(20)]).toEqual([1000,600]);
 await page.setViewportSize({width:390,height:900});await page.getByRole('button',{name:'100%',exact:true}).click();await page.getByRole('button',{name:'Zoom in',exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(await viewport.evaluate(node=>node.scrollWidth>node.clientWidth)).toBe(true);
 await page.screenshot({path:'/tmp/snapkit-capture-zoom-mobile79.png'});
});

test('screen capture negotiates native pixels before importing the selected video frame',async({page})=>{
 await page.addInitScript(()=>{
  window.snapkitDesktop={captureScreens:async()=>({picker:'system'})};
  Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{value:async()=>{
   const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;
   const ctx=canvas.getContext('2d');ctx.fillStyle='#ff0000';ctx.fillRect(0,0,160,90);
   const stream=canvas.captureStream(5),track=stream.getVideoTracks()[0];let native=false;
   const settings=track.getSettings.bind(track),caps=track.getCapabilities.bind(track);
   track.getCapabilities=()=>({...caps(),width:{min:1,max:640},height:{min:1,max:360},resizeMode:['none','crop-and-scale']});
   track.getSettings=()=>({...settings(),width:native?640:160,height:native?360:90,resizeMode:native?'none':'crop-and-scale'});
   track.applyConstraints=async constraints=>{window.nativeConstraints=constraints;native=true;canvas.width=640;canvas.height=360;ctx.fillStyle='#00ff00';ctx.fillRect(0,0,640,360);};
   window.nativeTrack=track;return stream;
  }});
 });
 await open(page,'Snap Capture');await page.getByRole('button',{name:'Choose screen',exact:true}).click();
 const canvas=page.getByLabel('Annotation canvas',{exact:true});await expect(canvas).toBeVisible();
 await expect(page.getByText('640 × 360 px',{exact:false})).toBeVisible();
 expect(await page.evaluate(()=>window.nativeConstraints)).toEqual({resizeMode:'none',width:{ideal:640},height:{ideal:360}});
 expect(await canvas.evaluate(c=>Array.from(c.getContext('2d').getImageData(10,10,1,1).data))).toEqual([0,255,0,255]);
 expect(await page.evaluate(()=>window.nativeTrack.readyState)).toBe('ended');
 const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Save annotated image',exact:true}).click();const chunks=[];for await(const chunk of await (await downloaded).createReadStream())chunks.push(chunk);const png=Buffer.concat(chunks);expect([png.readUInt32BE(16),png.readUInt32BE(20)]).toEqual([640,360]);
});
test('Retina preview redraws at physical pixel density and preserves sharp source pixels when enlarged',async({browser})=>{
 const context=await browser.newContext({deviceScaleFactor:2,viewport:{width:1440,height:1100}}),page=await context.newPage();
 try{
  await page.route('**/api/product',async route=>{const r=await route.fetch(),data=await r.json();data.preferences.developerProfile={role:'frontend',framework:'flutter'};await route.fulfill({json:data});});
  await open(page,'Snap Capture');
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1000;c.height=600;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1000,600);ctx.fillStyle='#000';for(let x=0;x<1000;x+=2)ctx.fillRect(x,0,1,600);return c.toDataURL().split(',')[1];});
  await page.getByLabel('Image to annotate',{exact:true}).setInputFiles({name:'stripes.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  const canvas=page.getByLabel('Annotation canvas',{exact:true});await expect(canvas).toBeVisible();
  const backing=()=>canvas.evaluate(c=>({width:c.width,cssWidth:c.getBoundingClientRect().width}));
  expect((await backing()).width).toBeCloseTo((await backing()).cssWidth*2,0);
  await page.getByRole('button',{name:'100%',exact:true}).click();await expect(page.getByLabel('Zoom level',{exact:true})).toHaveText('100%');expect(await backing()).toEqual({width:1000,cssWidth:500});
  await page.getByRole('button',{name:'Zoom in',exact:true}).click();await page.getByRole('button',{name:'Zoom in',exact:true}).click();
  // Nearest-neighbour enlargement retains the original black/white edges;
  // interpolated gray pixels would reveal a blurred preview.
  expect(await canvas.evaluate(c=>{const row=c.getContext('2d').getImageData(0,10,c.width,1).data;return [...row].every((v,i)=>i%4===3?v===255:v===0||v===255);})).toBe(true);
  await page.getByRole('button',{name:'Mark rectangle',exact:true}).click();const bounds=await canvas.boundingBox();await page.mouse.move(bounds.x+30,bounds.y+30);await page.mouse.down();await page.mouse.move(bounds.x+170,bounds.y+100);await page.mouse.up();
  await page.screenshot({path:'/tmp/snapkit-retina79.png'});
  const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Save annotated image',exact:true}).click();const chunks=[];for await(const chunk of await (await downloaded).createReadStream())chunks.push(chunk);const bytes=Buffer.concat(chunks);expect([bytes.readUInt32BE(16),bytes.readUInt32BE(20)]).toEqual([1000,600]);
 }finally{await context.close();}
});
