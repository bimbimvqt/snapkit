'use strict';
const { app, BrowserWindow, dialog, ipcMain, shell, utilityProcess, safeStorage, powerMonitor, nativeTheme, Notification } = require('electron');
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
let agent, mainWindow, bootSplash, exiting = false;
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
      if (state.activeReleaseTask || state.activeRecordings || state.debugSessions?.length || state.jobs?.some(job => job.status === 'running')) throw Error(nativeT('Finish builds, uploads, recordings and debugging before installing the update.'));
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
  mainWindow.on('close', event => {
    if (exiting) return;
    event.preventDefault();
    (async () => {
      try {
        const response = await fetch(origin + '/api/state', { signal: AbortSignal.timeout(2000) });
        const state = await response.json();
        if (state.activeReleaseTask || state.activeRecordings || state.jobs?.some(job => job.status === 'running')) {
          const choice = await dialog.showMessageBox(mainWindow, { type: 'question', title: nativeT(state.activeReleaseTask ? "A build or upload is still running" : "A device task is still running"), message: nativeT("Keep Snapkit open to finish your device task."), detail: nativeT(state.activeReleaseTask ? "Quitting cancels the local build or upload. If uploading, check App Store Connect before retrying." : "Quitting stops active recordings and may interrupt a download or installation. Your existing devices and project files will be kept."), buttons: [nativeT("Keep Snapkit open"), nativeT("Quit Snapkit")], defaultId: 0, cancelId: 0 });
          if (choice.response !== 1) return;
        }
      } catch {}
      app.quit();
    })();
  });
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
    const result = await mainWindow.webContents.executeJavaScript(`(async () => {
      const [p,h] = await Promise.all([fetch('/api/product').then(r=>r.json()),fetch('/api/health').then(r=>r.json())]);
      const initial = window.SnapkitI18n.language;
      window.SnapkitI18n.setLanguage('vi');
      const vietnamese = document.querySelector('#add-device').textContent.trim() === 'Thêm thiết bị';
      window.SnapkitI18n.setLanguage('en');
      const english = document.querySelector('#add-device').textContent.trim() === 'Add device';
      window.SnapkitI18n.setLanguage(initial);
      return {desktop:p.desktop,version:h.version,bridge:!!window.snapkitDesktop,ui:!!document.querySelector('#setup-card'),languages:vietnamese && english};
    })()`);
    result.splash = splashVerified && splashClosed && readyReported;
    fs.writeFileSync(process.env.SNAPKIT_SMOKE_OUTPUT || path.join(os.tmpdir(), 'snapkit-desktop-smoke.json'), JSON.stringify(result));
    app.quit();
  }
}
app.on('window-all-closed', () => app.quit());
app.on('before-quit', event => {
  if (exiting) return;
  exiting = true;
  stopWatching?.(); updateChecks?.stop();
  bootSplash?.destroy();
  event.preventDefault();
  (async () => {
    await updater.close().catch(() => {});
    if (agent) {
    const child = agent; agent = null;
    await new Promise(resolve => { const timer = setTimeout(() => { child.kill(); resolve(); }, 15000); child.once('exit', () => { clearTimeout(timer); resolve(); }); child.postMessage({ type: 'shutdown' }); });
    }
    app.quit();
  })();
});
