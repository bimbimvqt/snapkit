/* The desktop main process owns metadata, downloads and installation. */
(() => {
  const bridge = window.snapkitDesktop;
  let state = { status: bridge ? 'idle' : 'web' }, polling = false, action = false, installing = false, dismissedNotice = '';
  const statuses = {
    idle: 'Check, download and install updates right here.', checking: 'Checking for updates…', latest: 'You’re using the latest version.',
    available: 'Snapkit {0} is ready to download.', downloading: 'Downloading Snapkit {0}…', verifying: 'Verifying and preparing the update…',
    ready: 'Snapkit {0} is ready to install.', installing: 'Restarting to install the update…', error: 'Could not finish the update. Try again.',
    unsupported: 'In-app updates are available in the installed macOS and Windows app.', web: 'Open Snapkit Desktop to update the app.'
  };
  const loading = $('#update-loading');
  loading.addEventListener('cancel', event => event.preventDefault());
  function updateText(id, value) { const node = $('#' + id); if (node.textContent !== value) node.textContent = value; }
  function renderNotice() {
    const available = !!state.version && (['available', 'ready', 'downloading', 'verifying', 'installing', 'checking'].includes(state.status) || state.status === 'error' && state.retry === 'download');
    const badge = $('#update-indicator');
    badge.classList.toggle('hidden', !available);
    updateText('update-indicator', t(state.status === 'ready' ? 'Ready' : state.status === 'downloading' ? '{0}%' : 'New', [state.percent || 0]));
    const noticeKey = state.version + ':' + (state.status === 'ready' ? 'ready' : 'available');
    const show = available && ['available', 'ready', 'checking'].includes(state.status) && activePage !== 'updates' && dismissedNotice !== noticeKey;
    $('#update-banner').classList.toggle('hidden', !show);
    updateText('update-banner-text', available ? t(state.status === 'ready' ? 'Snapkit {0} is ready to install.' : 'Snapkit {0} is available.', [state.version]) : '');
    $('#update-dismiss').dataset.notice = noticeKey;
    const last = Number(state.lastCheckedAt);
    updateText('update-last-checked', last > 0 ? t('Last checked: {0}', [new Date(last).toLocaleString(window.SnapkitI18n.language)]) : t('No completed check yet.'));
    updateText('update-schedule-note', t(bridge && state.status !== 'unsupported' ? 'Checks run in the background while Snapkit is open. Downloads and restarts always need your action.' : 'Automatic checks are available in the installed macOS and Windows app.'));
    if (state.current) updateText('product-version', state.current);
    $('#panel-updates .update-card').dataset.status = state.status;
  }
  function render() {
    renderNotice();
    const busy = installing || state.status === 'installing';
    $('#update-loading-title').textContent = t('Preparing to restart…');
    $('#update-loading-note').textContent = t('Snapkit will close to install the update. Please keep your computer on.');
    loading.querySelector('.update-loading-hint').textContent = t('Your projects, devices and account will be kept.');
    loading.querySelector('[role="progressbar"]').setAttribute('aria-label', t('Installing update'));
    loading.querySelector('[role="status"]').textContent = busy ? t('Preparing to restart…') : '';
    if (busy && !loading.open) { loading.showModal(); loading.focus(); }
    const restoreFocus = !busy && loading.open;
    if (restoreFocus) loading.close();

    $('#update-status').textContent = t(statuses[state.status] || statuses.error, [state.version || '']);
    const transferDetail = state.transfer === 'delta' ? t('Downloading only changed data. Reusing {0} MB from this computer.', [(state.reused / 1024 ** 2).toFixed(1)]) : state.fallback ? t('Using the full package to complete this update.') : '';
    const detail = state.error ? t(state.error) : state.status === 'downloading' && state.transfer === 'planning' ? t('Preparing a smaller update…') : state.status === 'downloading' ? `${state.percent || 0}% · ${(state.received / 1024 ** 2).toFixed(1)} / ${(state.size / 1024 ** 2).toFixed(1)} MB${transferDetail ? ' · ' + transferDetail : ''}` : state.status === 'ready' && state.transfer === 'delta' ? t('Smart update ready. Downloaded {0} MB instead of {1} MB.', [(state.downloadSize / 1024 ** 2).toFixed(1), (state.fullSize / 1024 ** 2).toFixed(1)]) : '';
    updateText('update-detail', detail);
    $('#update-progress').classList.toggle('hidden', !['downloading', 'verifying'].includes(state.status));
    if (state.status === 'verifying' || state.status === 'downloading' && state.transfer === 'planning') $('#update-progress').removeAttribute('value'); else $('#update-progress').value = state.percent || 0;
    $('#check-updates').disabled = action || !bridge || ['unsupported', 'checking', 'downloading', 'verifying', 'ready', 'installing'].includes(state.status);
    $('#update-download').classList.toggle('hidden', !(state.status === 'available' || state.status === 'error' && state.retry === 'download'));
    $('#update-install').classList.toggle('hidden', state.status !== 'ready');
    $('#update-cancel').classList.toggle('hidden', state.status !== 'downloading');
    for (const id of ['update-download', 'update-install', 'update-cancel']) $('#' + id).disabled = action;
    $('#clear-app-cache').disabled = !bridge || action;
    if (restoreFocus) $('#update-install').focus();
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
  $('#update-install').addEventListener('click', async () => {
    if (action || installing || state.status !== 'ready') return;
    installing = true;
    await perform(async () => {
      // Paint the waiting screen before opening the native confirmation or stopping the agent.
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      try { return await bridge.installUpdate(); }
      finally { installing = false; }
    });
  });
  $('#clear-app-cache').addEventListener('click', async event => {
    event.currentTarget.disabled = true;
    try { await bridge.clearCache(); $('#cache-result').textContent = t('Temporary app cache cleared.'); }
    catch { $('#cache-result').textContent = t('Could not clear the cache. Try again.'); }
    finally { event.currentTarget.disabled = false; }
  });
  document.addEventListener('snapkit:language', render);
  $('#update-view').addEventListener('click', () => showProductPage('updates'));
  $('#update-dismiss').addEventListener('click', () => { dismissedNotice = $('#update-dismiss').dataset.notice; renderNotice(); });
  document.addEventListener('snapkit:page', () => { renderNotice(); refresh(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  window.addEventListener('focus', refresh);
  setInterval(() => { if (!document.hidden) refresh(); }, 1000);
  render(); refresh();
})();
