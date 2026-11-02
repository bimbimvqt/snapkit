'use strict';
const { app, BrowserWindow, dialog, ipcMain, shell, utilityProcess, safeStorage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const https = require('node:https');
const API = 'https://snapkit.45.119.214.94.sslip.io';
const origin = 'http://127.0.0.1:4310';
let agent, mainWindow, exiting = false;
app.setName('Snapkit');
if (process.env.SNAPKIT_SMOKE_TEST === '1') app.setPath('userData', path.join(process.env.SNAPKIT_DATA_ROOT || os.tmpdir(), 'snapkit-smoke-profile'));
const nativeMessages = require('./locales.cjs');
const languageFile = path.join(app.getPath('userData'), 'language.json');
let desktopLanguage;
try { const saved = JSON.parse(fs.readFileSync(languageFile, 'utf8')); if (['en', 'vi'].includes(saved)) desktopLanguage = saved; } catch {}
function nativeT(message) {
  const language = desktopLanguage || (app.isReady() && app.getLocale().toLowerCase().startsWith('vi') ? 'vi' : 'en');
  return language === 'vi' ? nativeMessages[message] || message : message;
}

if (!app.requestSingleInstanceLock()) { app.quit(); } else {
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); } });
  app.whenReady().then(start).catch(error => { dialog.showErrorBox(nativeT("Snapkit could not start"), `${nativeT(error.message)}\n\n${nativeT('Your projects and device data have not been removed. Close any older Snapkit process and try again.')}`); app.quit(); });
}
function jsonRequest(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { 'User-Agent': `Snapkit/${app.getVersion()}` }, timeout: 10000 }, response => {
      if (response.statusCode !== 200) { response.resume(); reject(new Error(nativeT("The update service is temporarily unavailable. Try again later."))); return; }
      let body = ''; response.on('data', chunk => { body += chunk; if (body.length > 131072) request.destroy(new Error(nativeT("Invalid update response"))); });
      response.on('end', () => { try { resolve(JSON.parse(body)); } catch { reject(new Error(nativeT("Invalid update response"))); } });
    });
    request.on('timeout', () => request.destroy(new Error(nativeT("Could not check for updates. You can keep using Snapkit offline."))));
    request.on('error', reject);
  });
}
function allowedExternal(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error(nativeT("Only trusted HTTPS links can be opened."));
  if (!['github.com', 'docs.flutter.dev', 'developer.android.com', 'developer.apple.com', 'code.visualstudio.com', 'cursor.com', 'www.revenuecat.com', 'snapkit.45.119.214.94.sslip.io', 'bimbimvqt.github.io'].includes(url.hostname)) throw new Error(nativeT("This link is not part of Snapkit setup."));
  return url.href;
}
async function start() {
  app.setAppUserModelId('dev.snapkit.desktop');
  const legacy = '/Volumes/SanDiskSSDData/SnapkitData';
  const dataRoot = process.env.SNAPKIT_DATA_ROOT || (process.platform === 'darwin' && fs.existsSync(path.join(legacy, 'state/settings.json')) ? legacy : path.join(app.getPath('appData'), process.platform === 'linux' ? 'snapkit' : 'Snapkit'));
  const extras = ['/opt/homebrew/bin', '/usr/local/bin', path.join(os.homedir(), 'flutter/bin'), path.join(os.homedir(), 'development/flutter/bin')];
  const env = { ...process.env, SNAPKIT_DATA_ROOT: dataRoot, SNAPKIT_DESKTOP: '1', PORT: '4310', PATH: [process.env.PATH || '', ...extras].join(path.delimiter) };
  const health = async () => {
    try { const r = await fetch(origin + '/api/health', { signal: AbortSignal.timeout(1000) }); const data = await r.json(); return data.product === 'snapkit' && data.protocol === 1 && data.version === app.getVersion() && data.desktop === true && data.demo === (process.env.SNAPKIT_DESKTOP_DEMO === '1'); } catch { return false; }
  };
  if (!await health()) {
    // Never terminate another process just because it is using Snapkit's port.
    const net = require('node:net');
    await new Promise((resolve, reject) => { const probe = net.createServer(); probe.once('error', () => reject(new Error(nativeT("Port 4310 is in use. Close the older Snapkit agent or the application using this port.")))); probe.listen(4310, '127.0.0.1', () => probe.close(resolve)); });
    agent = utilityProcess.fork(path.join(__dirname, '../server/index.js'), process.env.SNAPKIT_DESKTOP_DEMO === '1' ? ['--demo'] : [], { env, serviceName: 'Snapkit local agent', stdio: 'pipe' });
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
    agent.once('exit', () => { if (!exiting) { dialog.showErrorBox(nativeT("Snapkit needs to restart"), nativeT("The device connection stopped. Restart Snapkit to reconnect. Your device data is still on this computer.")); app.quit(); } });
    const deadline = Date.now() + 20000;
    while (!await health()) { if (Date.now() > deadline) throw new Error(agentError || nativeT("The device connection did not start in time.")); await new Promise(resolve => setTimeout(resolve, 200)); }
  }
  const fromApp = event => event.sender === mainWindow?.webContents && new URL(event.senderFrame.url).origin === origin;
  ipcMain.handle('snapkit:language', (event, value) => {
    if (!fromApp(event) || !['en', 'vi'].includes(value)) throw new Error('Invalid language');
    desktopLanguage = value;
    fs.mkdirSync(path.dirname(languageFile), { recursive: true });
    fs.writeFileSync(languageFile, JSON.stringify(value), { mode: 0o600 });
  });
  ipcMain.handle('snapkit:version', event => { if (!fromApp(event)) throw new Error('Invalid caller'); return { version: app.getVersion(), platform: process.platform, arch: process.arch, packaged: app.isPackaged }; });
  ipcMain.handle('snapkit:external', async (event, value) => { if (!fromApp(event)) throw new Error('Invalid caller'); await shell.openExternal(allowedExternal(value)); });
  ipcMain.handle('snapkit:updates', event => { if (!fromApp(event)) throw new Error('Invalid caller'); return jsonRequest(`${API}/v1/releases/latest?platform=${process.platform}&arch=${process.arch}`); });
  ipcMain.handle('snapkit:restart', event => { if (!fromApp(event)) throw new Error('Invalid caller'); app.relaunch(); app.quit(); });
  mainWindow = new BrowserWindow({ width: 1440, height: 980, minWidth: 900, minHeight: 680, show: false, title: 'Snapkit', backgroundColor: '#101214', autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webviewTag: false } });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { try { void shell.openExternal(allowedExternal(url)); } catch {} return { action: 'deny' }; });
  mainWindow.webContents.on('will-navigate', (event, url) => { if (new URL(url).origin !== origin) event.preventDefault(); });
  mainWindow.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  mainWindow.on('close', event => {
    if (exiting) return;
    event.preventDefault();
    (async () => {
      try {
        const response = await fetch(origin + '/api/state', { signal: AbortSignal.timeout(2000) });
        const state = await response.json();
        if (state.jobs?.some(job => job.status === 'running')) {
          const choice = await dialog.showMessageBox(mainWindow, { type: 'question', title: nativeT("Device setup is still running"), message: nativeT("Keep Snapkit open to finish setting up your device."), detail: nativeT("Quitting may interrupt a download or installation. Your existing devices and project files will be kept."), buttons: [nativeT("Keep Snapkit open"), nativeT("Quit Snapkit")], defaultId: 0, cancelId: 0 });
          if (choice.response !== 1) return;
        }
      } catch {}
      app.quit();
    })();
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  await mainWindow.loadURL(origin);
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
    fs.writeFileSync(process.env.SNAPKIT_SMOKE_OUTPUT || path.join(os.tmpdir(), 'snapkit-desktop-smoke.json'), JSON.stringify(result));
    app.quit();
  }
}
app.on('window-all-closed', () => app.quit());
app.on('before-quit', event => {
  if (exiting) return;
  exiting = true;
  if (agent) {
    event.preventDefault();
    const child = agent; agent = null;
    const timer = setTimeout(() => { child.kill(); app.quit(); }, 5000);
    child.once('exit', () => { clearTimeout(timer); app.quit(); });
    child.postMessage({ type: 'shutdown' });
  }
});
