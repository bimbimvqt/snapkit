'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Only enabled by the unpackaged desktop entrypoint. No network reload endpoint.
function watchUI(window, directories) {
  const pending = new Set();
  let timer, closed = false, applying = false;
  const apply = async () => {
    if (closed || applying || window.isDestroyed()) return;
    applying = true;
    const files = [...pending]; pending.clear();
    try {
      if (files.every(file => file.endsWith('.css'))) {
        await window.webContents.executeJavaScript(`Promise.all([...document.querySelectorAll('link[rel="stylesheet"]')].map(link => new Promise(resolve => {
          const next = link.cloneNode(); const url = new URL(link.href); url.searchParams.set('snapkit-dev', Date.now()); next.href = url.href;
          next.onload = () => { link.remove(); resolve(); }; next.onerror = () => { next.remove(); resolve(); }; link.after(next);
        })))`);
        console.log('[Snapkit Dev] Styles updated');
      } else {
        await window.webContents.executeJavaScript(`sessionStorage.setItem('snapkit-dev-view', JSON.stringify({page:typeof activePage === 'string' ? activePage : 'devices', search:document.querySelector('#device-search')?.value || ''}))`);
        window.webContents.reloadIgnoringCache();
        console.log('[Snapkit Dev] UI reloaded');
      }
    } catch (error) { console.error('[Snapkit Dev] Reload failed:', error.message); }
    finally { applying = false; if (pending.size && !closed) timer = setTimeout(apply, 150); }
  };
  const restore = () => {
    window.webContents.executeJavaScript(`(() => {
      const saved = sessionStorage.getItem('snapkit-dev-view'); if (!saved) return;
      sessionStorage.removeItem('snapkit-dev-view');
      const view = JSON.parse(saved); if (typeof showProductPage === 'function') showProductPage(view.page);
      const search = document.querySelector('#device-search'); if (search) { search.value = view.search; search.dispatchEvent(new Event('input', {bubbles:true})); }
    })()`).catch(error => console.error('[Snapkit Dev] Could not restore view:', error.message));
  };
  window.webContents.on('did-finish-load', restore);
  const watchers = directories.map(directory => fs.watch(directory, { recursive: true }, (_event, filename) => {
    if (!filename || /(^|[/\\])\.|~$|\.(swp|tmp)$/.test(filename)) return;
    pending.add(String(filename)); clearTimeout(timer); timer = setTimeout(apply, 150);
  }));
  for (const watcher of watchers) watcher.on('error', error => console.error('[Snapkit Dev] Watch failed:', error.message));
  return () => { closed = true; clearTimeout(timer); watchers.forEach(watcher => watcher.close()); window.webContents.removeListener('did-finish-load', restore); };
}
module.exports = { watchUI };
