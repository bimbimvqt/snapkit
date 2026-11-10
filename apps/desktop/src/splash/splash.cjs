'use strict';
const path = require('node:path');
exports.createSplash = async ({ BrowserWindow, language, onCancel }) => {
  const window = new BrowserWindow({ width: 420, height: 340, frame: false, resizable: false, maximizable: false, minimizable: false, fullscreenable: false, show: false, center: true, title: 'Snapkit', backgroundColor: '#000000', autoHideMenuBar: true, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, webviewTag: false } });
  let finishing = false;
  const painted = new Promise(resolve => window.once('ready-to-show', resolve));
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('before-input-event', (_event, input) => { if (input.key === 'Escape' && input.type === 'keyDown') onCancel(); });
  window.on('closed', () => { if (!finishing) onCancel(); });
  try { await window.loadFile(path.join(__dirname, 'splash.html'), { query: { lang: language } }); await painted; }
  catch (error) { finishing = true; if (!window.isDestroyed()) window.destroy(); throw error; }
  if (window.isDestroyed()) throw Error('Splash closed');
  window.show(); const shownAt = Date.now();
  return {
    window,
    async finish() {
      if (window.isDestroyed()) return;
      const reducedMotion = await window.webContents.executeJavaScript("matchMedia('(prefers-reduced-motion: reduce)').matches").catch(() => true);
      // Keep a fast startup recognizable without delaying slower startups.
      await new Promise(resolve => setTimeout(resolve, Math.max(0, (reducedMotion ? 0 : 700) - (Date.now() - shownAt))));
      if (window.isDestroyed()) return;
      if (!reducedMotion) { await window.webContents.executeJavaScript("document.body.classList.add('leaving')").catch(() => {}); await new Promise(resolve => setTimeout(resolve, 180)); }
      this.destroy();
    },
    destroy() { finishing = true; if (!window.isDestroyed()) window.destroy(); }
  };
};
