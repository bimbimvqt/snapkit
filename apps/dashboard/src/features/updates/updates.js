/* The desktop main process owns metadata, downloads and installation. */
(() => {
  const bridge = window.snapkitDesktop;
  let state = { status: bridge ? 'idle' : 'web' }, polling = false, action = false;
  const statuses = {
    idle: 'Check, download and install updates right here.', checking: 'Checking for updates…', latest: 'You’re using the latest version.',
    available: 'Snapkit {0} is ready to download.', downloading: 'Downloading Snapkit {0}…', verifying: 'Verifying and preparing the update…',
    ready: 'Snapkit {0} is ready to install.', installing: 'Restarting to install the update…', error: 'Could not finish the update. Try again.',
    unsupported: 'In-app updates are available in the installed macOS and Windows app.', web: 'Open Snapkit Desktop to update the app.'
  };
  function render() {
    $('#update-status').textContent = t(statuses[state.status] || statuses.error, [state.version || '']);
    $('#update-detail').textContent = state.error ? t(state.error) : state.status === 'downloading' ? `${state.percent || 0}% · ${(state.received / 1024 ** 2).toFixed(1)} / ${(state.size / 1024 ** 2).toFixed(1)} MB` : '';
    $('#update-progress').classList.toggle('hidden', !['downloading', 'verifying'].includes(state.status));
    if (state.status === 'verifying') $('#update-progress').removeAttribute('value'); else $('#update-progress').value = state.percent || 0;
    $('#check-updates').disabled = action || !bridge || ['unsupported', 'checking', 'downloading', 'verifying', 'ready', 'installing'].includes(state.status);
    $('#update-download').classList.toggle('hidden', !(state.status === 'available' || state.status === 'error' && state.retry === 'download'));
    $('#update-install').classList.toggle('hidden', state.status !== 'ready');
    $('#update-cancel').classList.toggle('hidden', state.status !== 'downloading');
    for (const id of ['update-download', 'update-install', 'update-cancel']) $('#' + id).disabled = action;
    $('#update-indicator')?.classList.toggle('hidden', !['available', 'ready'].includes(state.status));
    $('#clear-app-cache').disabled = !bridge || action;
  }
  async function refresh() {
    if (!bridge?.updateState || polling || action) return;
    polling = true;
    try { state = await bridge.updateState(); render(); } catch {} finally { polling = false; }
  }
  async function perform(fn) {
    if (action) return; action = true; render();
    try { state = await fn(); } catch (error) { state = { ...state, error: error.message }; }
    finally { action = false; render(); }
  }
  $('#check-updates').addEventListener('click', () => perform(() => bridge.checkUpdates()));
  $('#update-download').addEventListener('click', () => perform(() => bridge.downloadUpdate()));
  $('#update-cancel').addEventListener('click', () => perform(() => bridge.cancelUpdate()));
  $('#update-install').addEventListener('click', () => perform(() => bridge.installUpdate()));
  $('#clear-app-cache').addEventListener('click', async event => {
    event.currentTarget.disabled = true;
    try { await bridge.clearCache(); $('#cache-result').textContent = t('Temporary app cache cleared.'); }
    catch { $('#cache-result').textContent = t('Could not clear the cache. Try again.'); }
    finally { event.currentTarget.disabled = false; }
  });
  document.addEventListener('snapkit:language', render);
  document.addEventListener('snapkit:page', refresh);
  setInterval(() => { if (!document.hidden) refresh(); }, 1000);
  render(); refresh();
})();
