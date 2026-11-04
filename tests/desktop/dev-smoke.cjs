const { _electron } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
(async () => {
  const root = path.resolve(__dirname, '../..'), data = await fs.mkdtemp(path.join(os.tmpdir(), 'snapkit-dev-verify-'));
  const css = path.join(root, `apps/dashboard/build/dev-verify-${process.pid}.css`), js = path.join(root, `apps/dashboard/build/dev-verify-${process.pid}.js`);
  let app;
  try {
    app = await _electron.launch({ args: [root], env: { ...process.env, SNAPKIT_DEV: '1', SNAPKIT_DEV_PORT: '14326', SNAPKIT_DEV_DATA_ROOT: data, SNAPKIT_DESKTOP_DEMO: '1' } });
    let page;
    for (let i=0;i<100;i++) { page=app.windows().find(p=>p.url().startsWith('http://127.0.0.1:14326')); if(page)break; await new Promise(r=>setTimeout(r,200)); }
    if(!page)throw Error('Dev window did not open');
    await page.waitForSelector('#devices-grid [data-device]');
    for (let i=0;i<100;i++) { if(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().some(w=>w.getTitle()==='Snapkit Dev' && w.isVisible() && w.webContents.isDevToolsOpened())))break; await new Promise(r=>setTimeout(r,100)); }
    await page.locator('[data-app-page="sets"]').click();
    await page.evaluate(() => { window.devSentinel = true; });
    await fs.writeFile(css, ':root{--dev-verify:1}');
    await page.evaluate(href => { const l=document.createElement('link');l.rel='stylesheet';l.href=href;document.head.append(l); }, '/' + path.basename(css));
    await page.waitForFunction(()=>getComputedStyle(document.documentElement).getPropertyValue('--dev-verify').trim()==='1');
    await fs.writeFile(css, ':root{--dev-verify:2}');
    await page.waitForFunction(()=>getComputedStyle(document.documentElement).getPropertyValue('--dev-verify').trim()==='2');
    if(!await page.evaluate(()=>window.devSentinel))throw Error('CSS reloaded the entire view');
    const navigation=page.waitForEvent('load');await fs.writeFile(js, '// trigger JS reload\n');await navigation;
    await page.waitForFunction(()=>!document.querySelector('#panel-sets').classList.contains('hidden'));
    if(await page.evaluate(()=>window.devSentinel))throw Error('JS did not reload');
    const profile=await app.evaluate(({app})=>app.getPath('userData'));
    if(!profile.startsWith(data))throw Error('Dev data not isolated');
    const devTools=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().some(w=>w.webContents.isDevToolsOpened()));
    if(!devTools)throw Error('DevTools not open');
    await page.locator('[data-app-page="releases"]').click();
    await page.waitForSelector('#panel-releases:not(.hidden)');
    await page.waitForFunction(()=>!document.querySelector('#release-profile').disabled);
    if(!await page.evaluate(()=>typeof window.snapkitDesktop.chooseReleaseFile==='function'))throw Error('Release file picker bridge missing');
    const catalog=await page.evaluate(async()=>{const response=await fetch('/api/releases/catalog');if(!response.ok)throw Error('Release catalog unavailable');return response.json();});
    if(!catalog.profiles?.length)throw Error('Release profiles missing');
    await page.screenshot({path:'/tmp/snapkit-dev-window.png'});
    console.log('PASS: CSS live update without reload, JS reload, active tab restored, separate profile/port, DevTools, release screen/catalog and native picker bridge.');
  } finally { await app?.close();await fs.rm(css,{force:true});await fs.rm(js,{force:true});await fs.rm(data,{recursive:true,force:true}); }
})().catch(e=>{console.error(e);process.exitCode=1});
