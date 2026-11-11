'use strict';
const { app, BrowserWindow, Tray, Menu, nativeImage, screen, dialog, ipcMain, shell, utilityProcess, safeStorage, powerMonitor, nativeTheme, Notification, globalShortcut, powerSaveBlocker, clipboard, ClipboardItem, desktopCapturer } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { createSplash } = require('./splash/splash.cjs');
const { DesktopUpdater } = require('./updates/updater.cjs');
const { startUpdateChecks } = require('./updates/schedule.cjs');
const development = !app.isPackaged && process.env.SNAPKIT_DEV === '1';
const port = development ? Number(process.env.SNAPKIT_DEV_PORT || 4311) : process.env.SNAPKIT_SMOKE_TEST === '1' ? Number(process.env.SNAPKIT_SMOKE_PORT || 14328) : 4310;
if (!Number.isInteger(port) || port < 1024 || port > 65535 || (development && port === 4310)) throw new Error('Invalid Dev port');
const origin = `http://127.0.0.1:${port}`;
const repositoryRoot = path.resolve(__dirname, '../../..');
const devRoot = path.resolve(process.env.SNAPKIT_DEV_DATA_ROOT || path.join(repositoryRoot, '.snapkit-dev', process.env.SNAPKIT_DESKTOP_DEMO === '1' ? 'demo' : 'local'));
let stopWatching, updateChecks;
let agent, mainWindow, bootSplash, mini, quitting = false, exiting = false;
app.setName(development ? 'Snapkit Dev' : 'Snapkit');
if (development) app.setPath('userData', path.join(devRoot, 'profile'));
if (process.env.SNAPKIT_SMOKE_TEST === '1') app.setPath('userData', path.join(process.env.SNAPKIT_DATA_ROOT || os.tmpdir(), 'snapkit-smoke-profile'));
const nativeMessages = require('./i18n/messages.cjs');
const updater = new DesktopUpdater({ version: app.getVersion(), platform: process.platform, arch: process.arch, packaged: app.isPackaged, executable: app.getPath('exe'), userData: app.getPath('userData') });
const updateToken = process.argv.find(value => value.startsWith('--snapkit-update-token='))?.split('=')[1];
const languageFile = path.join(app.getPath('userData'), 'language.json');
const appearanceFile = path.join(app.getPath('userData'), 'appearance.json');
try { const saved = JSON.parse(fs.readFileSync(appearanceFile, 'utf8')); if (['system', 'light', 'dark'].includes(saved)) nativeTheme.themeSource = saved; } catch {}
let desktopLanguage;
try { const saved = JSON.parse(fs.readFileSync(languageFile, 'utf8')); if (['en', 'vi'].includes(saved)) desktopLanguage = saved; } catch {}
function nativeT(message) {
  const language = desktopLanguage || (app.isReady() && app.getLocale().toLowerCase().startsWith('vi') ? 'vi' : 'en');
  return language === 'vi' ? nativeMessages[message] || message : message;
}

if (!app.requestSingleInstanceLock()) { app.quit(); } else {
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); } });
  app.whenReady().then(start).catch(error => { bootSplash?.destroy(); dialog.showErrorBox(nativeT("Snapkit could not start"), `${nativeT(error.message)}\n\n${nativeT('Your projects and device data have not been removed. Close any older Snapkit process and try again.')}`); app.quit(); });
}
function allowedExternal(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error(nativeT("Only trusted HTTPS links can be opened."));
  if (!['github.com', 'docs.flutter.dev', 'developer.android.com', 'developer.apple.com', 'appstoreconnect.apple.com', 'code.visualstudio.com', 'cursor.com', 'www.revenuecat.com', 'snapkit.vn', 'snapkit.45.119.214.94.sslip.io', 'bimbimvqt.github.io'].includes(url.hostname)) throw new Error(nativeT("This link is not part of Snapkit setup."));
  return url.href;
}
async function start() {
  await updater.acknowledge(updateToken);
  app.setAppUserModelId('dev.snapkit.desktop');
  bootSplash = await createSplash({ BrowserWindow, language: desktopLanguage || (app.getLocale().toLowerCase().startsWith('vi') ? 'vi' : 'en'), onCancel: () => app.quit() });
  let splashVerified = false;
  if (process.env.SNAPKIT_SMOKE_TEST === '1') {
    splashVerified = bootSplash.window.isVisible() && await bootSplash.window.webContents.executeJavaScript("document.querySelector('.logo').naturalWidth > 0 && document.querySelector('#loading-label').textContent.length > 0");
    if (process.env.SNAPKIT_SPLASH_SCREENSHOT) fs.writeFileSync(process.env.SNAPKIT_SPLASH_SCREENSHOT, (await bootSplash.window.webContents.capturePage()).toPNG());
  }
  const legacy = '/Volumes/SanDiskSSDData/SnapkitData';
  const dataRoot = development ? path.join(devRoot, 'data') : process.env.SNAPKIT_DATA_ROOT || (process.platform === 'darwin' && fs.existsSync(path.join(legacy, 'state/settings.json')) ? legacy : path.join(app.getPath('appData'), process.platform === 'linux' ? 'snapkit' : 'Snapkit'));
  const extras = ['/opt/homebrew/bin', '/usr/local/bin', path.join(os.homedir(), 'flutter/bin'), path.join(os.homedir(), 'development/flutter/bin')];
  const env = { ...process.env, SNAPKIT_DATA_ROOT: dataRoot, SNAPKIT_DESKTOP: '1', PORT: String(port), PATH: [process.env.PATH || '', ...extras].join(path.delimiter) };
  const health = async () => {
    try { const r = await fetch(origin + '/api/health', { signal: AbortSignal.timeout(1000) }); const data = await r.json(); return data.product === 'snapkit' && data.protocol === 1 && data.version === app.getVersion() && data.desktop === true && data.demo === (process.env.SNAPKIT_DESKTOP_DEMO === '1'); } catch { return false; }
  };
  if (development || !await health()) {
    // Never terminate another process just because it is using Snapkit's port.
    const net = require('node:net');
    await new Promise((resolve, reject) => { const probe = net.createServer(); probe.once('error', () => reject(new Error(development ? `Dev port ${port} is in use. Close the other Dev instance or choose SNAPKIT_DEV_PORT.` : nativeT("Port 4310 is in use. Close the older Snapkit agent or the application using this port.")))); probe.listen(port, '127.0.0.1', () => probe.close(resolve)); });
    agent = utilityProcess.fork(path.join(__dirname, '../../agent/src/main.js'), process.env.SNAPKIT_DESKTOP_DEMO === '1' ? ['--demo'] : [], { env, serviceName: 'Snapkit local agent', stdio: 'pipe' });
    agent.on('message', async message => {
      if (message?.type !== 'account-storage' || typeof message.id !== 'string') return;
      const file = path.join(app.getPath('userData'), 'account-session.enc');
      try {
        if (message.action === 'read') {
          const value = safeStorage.isEncryptionAvailable() && fs.existsSync(file) ? JSON.parse(safeStorage.decryptString(fs.readFileSync(file))) : null;
          agent?.postMessage({ type: 'account-storage-result', id: message.id, value });
        } else if (message.action === 'write') {
          if (!message.value) { if (fs.existsSync(file)) fs.unlinkSync(file); }
          else {
            if (!safeStorage.isEncryptionAvailable() || safeStorage.getSelectedStorageBackend?.() === 'basic_text') throw Error('Secure storage unavailable');
            fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, safeStorage.encryptString(JSON.stringify(message.value)), { mode: 0o600 });
          }
          agent?.postMessage({ type: 'account-storage-result', id: message.id, value: true });
        }
      } catch { agent?.postMessage({ type: 'account-storage-result', id: message.id, error: true }); }
    });
    let agentError = '';
    agent.stderr?.on('data', chunk => { agentError = (agentError + chunk.toString()).slice(-4096); });
    agent.once('exit', () => { if (!exiting) { bootSplash?.destroy(); dialog.showErrorBox(nativeT("Snapkit needs to restart"), nativeT("The device connection stopped. Restart Snapkit to reconnect. Your device data is still on this computer.")); app.quit(); } });
    const deadline = Date.now() + 20000;
    while (!await health()) { if (Date.now() > deadline) throw new Error(agentError || nativeT("The device connection did not start in time.")); await new Promise(resolve => setTimeout(resolve, 200)); }
  }
  const fromApp = event => event.sender === mainWindow?.webContents && new URL(event.senderFrame.url).origin === origin;
  const everyday=require('./kit/everyday.cjs').installEveryday({app,ipcMain,dialog,clipboard,desktopCapturer,fromApp,getWindow:()=>mainWindow,language:()=>desktopLanguage});
  const kit=require('./kit/kit.cjs').installKit({app,ipcMain,dialog,shell,globalShortcut,Notification,powerSaveBlocker,fromApp,getWindow:()=>mainWindow,origin,language:()=>desktopLanguage});
  const miniClipboardFixture={enabled:false,items:[],copied:''};
  const miniHistory=process.env.SNAPKIT_SMOKE_TEST==='1'?{state:()=>({...miniClipboardFixture}),copy:async id=>{const item=miniClipboardFixture.items.find(item=>item.id===id);if(!item)throw Error('Invalid clipboard item');miniClipboardFixture.copied=item.text;return true;}}:everyday.history;
  const miniBuildNotifications=[],miniDownloads=[];
  const miniNative=process.env.SNAPKIT_SMOKE_TEST==='1'?{Notification:class {static isSupported(){return true;}constructor(options){this.options=options;}on(){}show(){miniBuildNotifications.push(this.options);}},dialog:{showSaveDialog:async()=>({filePath:path.join(app.getPath('userData'),'mini-artifact.ipa'),canceled:false})},shell:{showItemInFolder:file=>miniDownloads.push(file)}}:{Notification,dialog,shell};
  mini=require('./mini/mini.cjs').installMini({app,BrowserWindow,Tray,Menu,nativeImage,screen,ipcMain,fromApp,getWindow:()=>mainWindow,language:()=>desktopLanguage,setDeadline:kit.setFocusDeadline,nativeTheme,origin,history:miniHistory,kit,...miniNative});
  ipcMain.handle('snapkit:team-notify', (event, data) => {
    if (!fromApp(event) || !data || typeof data.target?.userId !== 'string') throw new Error('Invalid caller');
    if (!Notification.isSupported()) throw new Error('Notifications are unavailable on this device.');
    const target = Object.fromEntries(['userId','workspaceId','projectId','environment','taskId','page'].filter(k => typeof data.target[k] === 'string' && data.target[k].length <= 180).map(k => [k,data.target[k]]));
    const notification = new Notification({title:'Snapkit Teams', body:desktopLanguage==='vi'?'Bạn có cập nhật mới. Mở Snapkit để xem.':'You have a new update. Open Snapkit to view.',silent:!data.test});
    notification.on('click', () => {if(mainWindow&&!mainWindow.isDestroyed()){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.show();mainWindow.focus();mainWindow.webContents.send('snapkit:team-notification',target);}});
    notification.show();return true;
  });
  ipcMain.handle('snapkit:language' , (event, value) => {
    if (!fromApp(event) || !['en', 'vi'].includes(value)) throw new Error('Invalid language');
    desktopLanguage = value;
    mini?.refresh();
    fs.mkdirSync(path.dirname(languageFile), { recursive: true });
    fs.writeFileSync(languageFile, JSON.stringify(value), { mode: 0o600 });
  });
  ipcMain.handle('snapkit:release-file', async (event, kind) => {
    if (!fromApp(event) || !['private-key', 'export-options'].includes(kind)) throw new Error('Invalid caller');
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters: [{ name: kind === 'private-key' ? 'App Store Connect key' : 'Export options', extensions: [kind === 'private-key' ? 'p8' : 'plist'] }] });
    return result.canceled ? '' : result.filePaths[0] || '';
  });
  ipcMain.handle('snapkit:open-xcode', async event => {
    if (!fromApp(event) || process.platform !== 'darwin') throw new Error('Invalid caller');
    await new Promise((resolve, reject) => require('node:child_process').execFile('/usr/bin/open', ['-a', 'Xcode'], { timeout: 15000 }, error => error ? reject(new Error('Could not open Xcode. Install Xcode and open it from Applications.')) : resolve()));
    return { ok: true };
  });
  ipcMain.handle('snapkit:version', event => { if (!fromApp(event)) throw new Error('Invalid caller'); return { version: app.getVersion(), platform: process.platform, arch: process.arch, packaged: app.isPackaged }; });
  ipcMain.handle('snapkit:external', async (event, value) => { if (!fromApp(event)) throw new Error('Invalid caller'); await shell.openExternal(allowedExternal(value)); });
  ipcMain.handle('snapkit:updates', event => { if (!fromApp(event)) throw new Error('Invalid caller'); return updater.check(); });
  ipcMain.handle('snapkit:update-state', event => { if (!fromApp(event)) throw new Error('Invalid caller'); return updater.snapshot(); });
  ipcMain.handle('snapkit:update-download', event => { if (!fromApp(event)) throw new Error('Invalid caller'); return updater.beginDownload(); });
  ipcMain.handle('snapkit:update-cancel', event => { if (!fromApp(event)) throw new Error('Invalid caller'); return updater.cancel(); });
  ipcMain.handle('snapkit:appearance', async (event, value) => {
    if (!fromApp(event) || !['system', 'light', 'dark'].includes(value)) throw new Error('Invalid appearance');
    await fs.promises.writeFile(appearanceFile, JSON.stringify(value));
    nativeTheme.themeSource = value;
    mainWindow?.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#000000' : '#f6f7f8');
  });
  nativeTheme.on('updated', () => mainWindow?.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#000000' : '#f6f7f8'));
  ipcMain.handle('snapkit:clear-cache', async event => { if (!fromApp(event)) throw new Error('Invalid caller'); await mainWindow.webContents.session.clearCache(); return { ok: true }; });
  ipcMain.handle('snapkit:update-install', async event => {
    if (!fromApp(event)) throw new Error('Invalid caller');
    const result = await dialog.showMessageBox(mainWindow, { type: 'question', title: nativeT('Install update'), message: nativeT('Restart Snapkit to install the downloaded update?'), detail: nativeT('Your projects, devices and account will be kept. Finish active tasks before continuing.'), buttons: [nativeT('Not now'), nativeT('Restart and install')], defaultId: 0, cancelId: 0 });
    if (result.response !== 1) return updater.snapshot();
    await updater.apply(async () => {
      const response = await fetch(origin + '/api/state', { signal: AbortSignal.timeout(3000) });
      if (!response.ok) throw Error(nativeT('Could not check active tasks. Try again.'));
      const state = await response.json();
      if (state.activeKitTask || state.activeReleaseTask || state.activeRecordings || state.debugSessions?.length || state.jobs?.some(job => job.status === 'running')) throw Error(nativeT('Finish builds, uploads, recordings and debugging before installing the update.'));
    });
    setImmediate(() => app.quit()); return updater.snapshot();
  });
  ipcMain.handle('snapkit:restart', event => { if (!fromApp(event)) throw new Error('Invalid caller'); app.relaunch(); app.quit(); });
  mainWindow = new BrowserWindow({ width: 1440, height: 980, minWidth: 900, minHeight: 680, show: false, title: development ? 'Snapkit Dev' : 'Snapkit', backgroundColor: nativeTheme.shouldUseDarkColors ? '#000000' : '#f6f7f8', autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webviewTag: false } });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { try { void shell.openExternal(allowedExternal(url)); } catch {} return { action: 'deny' }; });
  mainWindow.webContents.on('will-navigate', (event, url) => { if (new URL(url).origin !== origin) event.preventDefault(); });
  mainWindow.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  if (app.isPackaged) {
    const cacheVersion = path.join(app.getPath('userData'), 'cache-version.json');
    let cachedVersion;
    try { cachedVersion = JSON.parse(fs.readFileSync(cacheVersion, 'utf8')); } catch {}
    if (cachedVersion !== app.getVersion()) {
      await mainWindow.webContents.session.clearCache();
      fs.mkdirSync(path.dirname(cacheVersion), { recursive: true }); fs.writeFileSync(cacheVersion, JSON.stringify(app.getVersion()));
    }
  }
  mainWindow.on('close', event => { if (!exiting) { event.preventDefault(); mainWindow.hide(); } });
  const firstPaint = new Promise(resolve => mainWindow.once('ready-to-show', resolve));
  let resolveReady;
  const rendererReady = new Promise(resolve => { resolveReady = resolve; });
  const readyListener = event => { if (fromApp(event)) resolveReady(true); };
  ipcMain.on('snapkit:ready', readyListener);
  let readyTimeout;
  const readyFallback = new Promise(resolve => { readyTimeout = setTimeout(() => resolve(false), 12000); });
  let readyReported = false;
  try {
    await mainWindow.loadURL(origin); await firstPaint;
    readyReported = await Promise.race([rendererReady, readyFallback]);
  } finally { clearTimeout(readyTimeout); ipcMain.removeListener('snapkit:ready', readyListener); }
  await bootSplash.finish();
  if (exiting || mainWindow.isDestroyed()) return;
  if (development) {
    mainWindow.setTitle('Snapkit Dev');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    stopWatching = require('./development/live-reload.cjs').watchUI(mainWindow, [path.join(repositoryRoot, 'apps/dashboard/build')]);
    console.log(`[Snapkit Dev] Watching apps/dashboard/ + packages/ui/ · ${origin} · data: ${devRoot}`);
  }
  mainWindow.show();
  if (readyReported) { await updater.seedCurrent(); await updater.acknowledge(updateToken, true); }
  if (!updateToken) await updater.cleanup();
  if (app.isPackaged && process.env.SNAPKIT_SMOKE_TEST !== '1') {
    updateChecks = startUpdateChecks(updater);
    mainWindow.on('focus', () => { void updateChecks?.wake(); });
    powerMonitor.on('resume', () => { void updateChecks?.wake(); });
  }
  const splashClosed = bootSplash.window.isDestroyed();
  if (process.env.SNAPKIT_SMOKE_TEST === '1') {
    const {createClipboardHistory}=require('./kit/clipboard.cjs');
    let clipboardItems=[new ClipboardItem({'text/plain':'initial fixture'})];
    const fixtureClipboard={has:async type=>clipboardItems.some(item=>item.types.includes(type)),read:async()=>clipboardItems,readText:async()=>await(await clipboardItems[0].getType('text/plain')).text(),writeText:async text=>{clipboardItems=[new ClipboardItem({'text/plain':text})];}};
    const clipboardHistory=createClipboardHistory(fixtureClipboard);
    await clipboardHistory.setEnabled(true);clipboardItems=[new ClipboardItem({'text/plain':'Snapkit native clipboard fixture'})];await clipboardHistory.collect();
    const clipboardItem=clipboardHistory.state().items[0];
    const clipboardAPI=typeof clipboard.read==='function'&&typeof clipboard.has==='function'&&typeof clipboard.readText==='function'&&typeof clipboard.writeText==='function';
    if(!clipboardAPI||clipboardItem?.text!=='Snapkit native clipboard fixture')throw Error('Electron clipboard contract failed');
    await clipboardHistory.copy(clipboardItem.id);await clipboardHistory.clear();
    if(clipboardHistory.state().items.length)throw Error('Clipboard clear failed');clipboardHistory.dispose();
    const kitFixture=path.join(process.env.SNAPKIT_DATA_ROOT,'kit-smoke.txt');fs.writeFileSync(kitFixture,'smoke fixture');
    const kitSelection=await everyday.files.choose([kitFixture]);const kitRename=await everyday.files.apply(kitSelection.id,{prefix:'renamed-'});
    const result = await mainWindow.webContents.executeJavaScript(`(async () => {
      const [p,h] = await Promise.all([fetch('/api/product').then(r=>r.json()),fetch('/api/health').then(r=>r.json())]);
      const initial = window.SnapkitI18n.language;
      window.SnapkitI18n.setLanguage('vi');
      const vietnamese = document.querySelector('#add-device').textContent.trim() === 'Thêm thiết bị';
      window.SnapkitI18n.setLanguage('en');
      const english = document.querySelector('#add-device').textContent.trim() === 'Add device';
      window.SnapkitI18n.setLanguage(initial);
      const clipboardState=await window.snapkitDesktop.clipboardState();
      await window.snapkitDesktop.fileUndo('${kitRename.undoId}');
      const everyday=!clipboardState.enabled && clipboardState.items.length===0 && typeof window.snapkitDesktop.captureScreens==='function';
      const kitState=await window.snapkitDesktop.kitSettings();
      const awake=await window.snapkitDesktop.kitAwake(true);
      const asleep=await window.snapkitDesktop.kitAwake(false);
      await window.snapkitDesktop.kitFocus(null);
      const kit=typeof kitState.shortcut==='boolean' && !kitState.startupAvailable && awake.awake && !asleep.awake && !!document.querySelector('#kit-root h1');
      return {everyday,kit,desktop:p.desktop,version:h.version,bridge:!!window.snapkitDesktop,ui:!!document.querySelector('#setup-card'),languages:vietnamese && english};
    })()`);
    await mini.show();
    const miniWindow=mini.getWindow();
    const miniResult=await miniWindow.webContents.executeJavaScript(`(async()=>{
      const before=await window.snapkitMini.state();
      await window.snapkitMini.action('focus');
      const running=await window.snapkitMini.state();
      await window.snapkitMini.action('focus');
      const paused=await window.snapkitMini.state();
      await window.snapkitMini.action('compact');
      const compact=(await window.snapkitMini.state()).compact;
      await window.snapkitMini.action('compact');
      await window.snapkitMini.action('pin');
      const unpinned=!(await window.snapkitMini.state()).pinned;
      await window.snapkitMini.action('pin');
      await window.snapkitMini.action('mode:utility');
      const utilities=await window.snapkitMini.state();
      const initialAwake=utilities.utility.awake;
      await window.snapkitMini.action('awake');
      const toggled=(await window.snapkitMini.state()).utility.awake!==initialAwake;
      await window.snapkitMini.action('awake');
      let noCopy=false;try{await window.snapkitMini.action('copy');}catch{noCopy=true;}
      await window.snapkitMini.action('compact');
      const utilityCompact=document.body.classList.contains('compact')&&document.getElementById('mini-title').textContent==='Daily Kit';
      await window.snapkitMini.action('compact');
      await window.snapkitMini.action('mode:debug');
      let debugState;for(let attempt=0;attempt<30;attempt++){debugState=await window.snapkitMini.state();if(debugState.debug)break;await new Promise(resolve=>setTimeout(resolve,100));}
      for(let attempt=0;attempt<40;attempt++){const panel=document.getElementById('debug-panel');if(panel.scrollHeight<=panel.clientHeight+1 && Math.abs(innerHeight-panel.getBoundingClientRect().bottom)<=3)break;await new Promise(resolve=>setTimeout(resolve,50));}
      const debugMode=debugState.mode==='debug' && !debugState.debug?.unavailable && !JSON.stringify(debugState.debug).includes('token') && document.getElementById('debug-panel').scrollHeight<=document.getElementById('debug-panel').clientHeight+1;
      await window.snapkitMini.action('mode:focus');
      let invalid=false;try{await window.snapkitMini.action('invalid');}catch{invalid=true;}
      const modes=utilities.mode==='utility' && !utilities.utility.enabled && utilities.utility.item===null && toggled && noCopy && utilityCompact && debugMode;

      return modes && !!before && running.focus.deadline>Date.now() && paused.focus.deadline===null && compact && unpinned && invalid && !window.snapkitDesktop;
    })()`);
    await miniWindow.webContents.executeJavaScript("window.snapkitMini.action('mode:debug')");
    for(let attempt=0;attempt<40;attempt++){if(await miniWindow.webContents.executeJavaScript("window.snapkitMini.state().then(s=>s.quickBuild.canBuild)"))break;await new Promise(resolve=>setTimeout(resolve,100));}
    const beforeBuild=await fetch(origin+'/api/state').then(r=>r.json());
    const staleBuild=await fetch(origin+'/api/releases/build',{method:'POST',headers:{'Content-Type':'application/json','X-Snapkit-Token':beforeBuild.token},body:JSON.stringify({expectedWorkspace:'stale-workspace',format:'apk'})});
    result.mini=miniResult && staleBuild.status===409;
    await miniWindow.webContents.executeJavaScript("window.snapkitMini.action('build:android').then(()=>window.snapkitMini.action('build:dev'))");
    const starts=await miniWindow.webContents.executeJavaScript("Promise.allSettled([window.snapkitMini.action('build:start'),window.snapkitMini.action('build:start')]).then(results=>results.map(result=>result.status))");
    result.mini=result.mini && starts.filter(status=>status==='fulfilled').length===1 && starts.filter(status=>status==='rejected').length===1;
    const devBuild=await fetch(origin+'/api/releases').then(r=>r.json());
    result.mini=result.mini && devBuild.jobs[0]?.plan.format==='apk' && devBuild.jobs[0]?.plan.flavor==='dev' && devBuild.jobs[0]?.plan.target==='lib/main_dev.dart' && devBuild.jobs[0]?.plan.defineFile==='config/dev.json';
    await miniWindow.webContents.executeJavaScript("window.snapkitMini.action('build:cancel')");
    await miniWindow.webContents.executeJavaScript("window.snapkitMini.action('build:ios').then(()=>window.snapkitMini.action('build:prod')).then(()=>window.snapkitMini.action('build:start'))");
    await new Promise(resolve=>setTimeout(resolve,800));
    const prodBuild=await fetch(origin+'/api/releases').then(r=>r.json());
    result.mini=result.mini && prodBuild.jobs[0]?.plan.format==='ipa' && prodBuild.jobs[0]?.plan.flavor==='prod' && prodBuild.jobs[0]?.plan.target==='lib/main_prod.dart' && prodBuild.jobs[0]?.status==='succeeded' && !prodBuild.jobs[0]?.uploadStatus;
    await miniWindow.webContents.executeJavaScript("window.snapkitMini.action('mode:debug')");
    miniWindow.hide();await mini.checkBuilds();await mini.checkBuilds();
    for(let attempt=0;attempt<40;attempt++){if(await miniWindow.webContents.executeJavaScript("window.snapkitMini.state().then(s=>s.quickBuild.artifacts.length>0)"))break;await new Promise(resolve=>setTimeout(resolve,100));}
    await miniWindow.webContents.executeJavaScript("window.snapkitMini.state().then(s=>window.snapkitMini.action('build:download:'+s.quickBuild.artifacts[0].jobId+':'+s.quickBuild.artifacts[0].id))");
    result.mini=result.mini && miniBuildNotifications.filter(n=>n.title==='Build complete'||n.title==='Build hoàn tất').length===1 && miniBuildNotifications.every(n=>n.silent===false) && miniDownloads.length===1 && fs.readFileSync(miniDownloads[0],'utf8').includes('not installable');
    miniWindow.show();
    mainWindow.close();
    const hidden=!mainWindow.isVisible();
    await miniWindow.webContents.executeJavaScript("window.snapkitMini.action('open')");
    result.mini=result.mini && hidden && mainWindow.isVisible() && miniWindow.isAlwaysOnTop() && mini.hasTray();
    await mainWindow.webContents.executeJavaScript(`window.snapkitDesktop.miniTask({id:'fixture-task',userId:'fixture-user',workspaceId:'fixture-team',projectId:'fixture-project',environment:'development',title:'Hoàn thiện màn thanh toán',project:'Demo Flutter · MOB-42',done:3,total:5})`);
    await new Promise(resolve=>setTimeout(resolve,100));
    result.mini=result.mini && await miniWindow.webContents.executeJavaScript("document.getElementById('title').textContent==='Hoàn thiện màn thanh toán' && !document.getElementById('task').hidden");
    await miniWindow.webContents.executeJavaScript("window.snapkitMini.action('qr')");
    await new Promise(resolve=>setTimeout(resolve,100));
    result.mini=result.mini && await mainWindow.webContents.executeJavaScript("[...document.querySelectorAll('.kit-card h2')].some(node=>node.textContent==='QR Kit'&&node.getBoundingClientRect().height>0)");
    miniClipboardFixture.enabled=true;miniClipboardFixture.items=[{id:'mini-fixture',text:'https://snapkit.vn'}];
    await miniWindow.webContents.executeJavaScript("window.snapkitMini.action('mode:utility').then(()=>window.snapkitMini.action('copy'))");
    result.mini=result.mini && miniClipboardFixture.copied==='https://snapkit.vn';
    await miniWindow.webContents.executeJavaScript("window.snapkitMini.action('mode:focus')");
    for(const language of ['en','vi']){
      await mainWindow.webContents.executeJavaScript(`window.snapkitDesktop.setLanguage('${language}')`);
      for(const mode of ['focus','utility','debug']){
        await miniWindow.webContents.executeJavaScript(`window.snapkitMini.action('mode:${mode}')`);
        await new Promise(resolve=>setTimeout(resolve,150));
        const layout=await miniWindow.webContents.executeJavaScript(`(async()=>{let metrics;for(let attempt=0;attempt<40;attempt++){const panel=document.querySelector('main:not([hidden])');metrics={scroll:panel.scrollHeight,client:panel.clientHeight,bottom:panel.getBoundingClientRect().bottom,height:innerHeight};if(metrics.scroll<=metrics.client+1 && Math.abs(metrics.height-metrics.bottom)<=3)return {ok:true,...metrics};await new Promise(resolve=>setTimeout(resolve,50));}return {ok:false,...metrics};})()`);
        if(mode==='debug')result.mini=result.mini && await miniWindow.webContents.executeJavaScript("document.querySelector('#build-artifacts button').textContent.startsWith("+JSON.stringify(language==='vi'?'Tải ':'Save ')+")");
        if(!layout.ok)console.error('Mini layout failed',language,mode,layout);
        result.mini=result.mini && layout.ok;
      }
    }
    await miniWindow.webContents.executeJavaScript("window.snapkitMini.action('mode:focus')");
    if(process.env.SNAPKIT_MINI_SCREENSHOT){
      for(const language of ['en','vi']){
        await mainWindow.webContents.executeJavaScript(`window.snapkitDesktop.setLanguage('${language}')`);
        await mainWindow.webContents.executeJavaScript(`window.snapkitDesktop.miniFocus({remaining:1458,deadline:null})`);
        await new Promise(resolve=>setTimeout(resolve,120));
        for(const mode of ['focus','utility','debug']){
          await miniWindow.webContents.executeJavaScript(`window.snapkitMini.action('mode:${mode}')`);
          await new Promise(resolve=>setTimeout(resolve,200));
          fs.writeFileSync(process.env.SNAPKIT_MINI_SCREENSHOT.replace('.png','-'+mode+'-'+language+'.png'),(await miniWindow.webContents.capturePage()).toPNG());
        }
        await miniWindow.webContents.executeJavaScript("window.snapkitMini.action('mode:focus')");
      }
    }
    result.clipboard=clipboardAPI;
    result.everyday=result.everyday && fs.readFileSync(kitFixture,'utf8')==='smoke fixture';
    result.splash = splashVerified && splashClosed && readyReported;
    fs.writeFileSync(process.env.SNAPKIT_SMOKE_OUTPUT || path.join(os.tmpdir(), 'snapkit-desktop-smoke.json'), JSON.stringify(result));
    app.quit();
  }
}
app.on('activate',()=>{if(mainWindow&&!mainWindow.isDestroyed()){mainWindow.show();mainWindow.focus();}});
app.on('window-all-closed', () => {if(!mini?.hasTray())app.quit();});
app.on('before-quit', event => {
  if (exiting) return;
  event.preventDefault();
  if(quitting)return;
  quitting=true;
  (async () => {
      try {
        if(process.env.SNAPKIT_SMOKE_TEST==='1'||!mainWindow||mainWindow.isDestroyed())throw Error('Skip quit check');
        const response = await fetch(origin + '/api/state', { signal: AbortSignal.timeout(2000) });
        const state = await response.json();
        if (state.activeKitTask || state.activeReleaseTask || state.activeRecordings || state.debugSessions?.length || state.jobs?.some(job => job.status === 'running')) {
          if(mainWindow.isMinimized())mainWindow.restore();mainWindow.show();mainWindow.focus();
          const choice = await dialog.showMessageBox(mainWindow, { type: 'question', title: nativeT(state.activeReleaseTask ? "A build or upload is still running" : "A device task is still running"), message: nativeT("Keep Snapkit open to finish your device task."), detail: nativeT(state.activeReleaseTask ? "Quitting cancels the local build or upload. If uploading, check App Store Connect before retrying." : "Quitting stops active recordings and may interrupt a download or installation. Your existing devices and project files will be kept."), buttons: [nativeT("Keep Snapkit open"), nativeT("Quit Snapkit")], defaultId: 0, cancelId: 0 });
          if (choice.response !== 1) { quitting=false; return; }
        }
      } catch {}
    exiting = true;
    stopWatching?.(); updateChecks?.stop();
    bootSplash?.destroy();
    await updater.close().catch(() => {});
    if (agent) {
      const child = agent; agent = null;
      await new Promise(resolve => { const timer = setTimeout(() => { child.kill(); resolve(); }, 15000); child.once('exit', () => { clearTimeout(timer); resolve(); }); child.postMessage({ type: 'shutdown' }); });
    }
    app.quit();
  })();
});
