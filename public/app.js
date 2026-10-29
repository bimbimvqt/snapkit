const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const icon = name => `<i data-lucide="${name}" aria-hidden="true"></i>`;
const icons = () => window.lucide?.createIcons();
let state = { devices: [], settings: { targetIds: [] }, warnings: [], jobs: [] };
let filter = 'all', search = '', onlyOnline = false;
let refreshing = false;
let connection = null, remotePoll = null, remotePolling = false;
let remoteOffline = false;
function agentURL(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Use a loopback server URL such as http://127.0.0.1:4310');
  return url.origin;
}
const groupLabel = { ios: 'iOS SIMULATOR', android: 'ANDROID EMULATOR', physical: 'PHYSICAL DEVICE' };
const groupIcon = { ios: 'smartphone', android: 'bot', physical: 'usb' };

async function api(url, data) {
  if (window.SNAPKIT_PREVIEW) {
    if (data !== undefined) throw new Error('Preview only. Open the local Dashboard at http://127.0.0.1:4310 to control your devices.');
    if (url === '/api/state') return structuredClone(window.SNAPKIT_PREVIEW.state);
    if (url.startsWith('/api/provision/catalog')) return structuredClone(window.SNAPKIT_PREVIEW.catalog);
    if (url === '/api/provision/ios/runtimes') return { runtimes: structuredClone(window.SNAPKIT_PREVIEW.catalog.ios.downloadable) };
    throw new Error('This action requires the local Snapkit server.');
  }
  if (window.SNAPKIT_CONTROLLER && !connection) throw new Error('Connect your local Snapkit server first.');
  const headers = connection ? { Authorization: `Bearer ${connection.token}` } : {};
  if (data !== undefined) { headers['Content-Type'] = 'application/json'; if (!connection) headers['X-Snapkit-Token'] = state.token; }
  const response = await fetch(connection ? connection.base + url : url, { method: data === undefined ? 'GET' : 'POST', headers, credentials: 'omit', ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
  const payload = await response.json();
  if (connection && response.status === 401) forgetConnection();
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}
function toast(message, error = false) {
  const node = document.createElement('div'); node.className = `toast${error ? ' error' : ''}`;
  node.innerHTML = `${icon(error ? 'circle-alert' : 'circle-check')}<span>${escape(message)}</span>`;
  $('#toast-region').append(node); icons(); setTimeout(() => node.remove(), error ? 9000 : 4500);
}
async function busy(button, task) {
  if (button?.disabled) return;
  if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
  try { await task(); } catch (e) { toast(e.message, true); }
  finally { if (button) { button.disabled = false; button.removeAttribute('aria-busy'); } }
}
function deviceCard(d) {
  const online = d.state === 'online', active = (state.settings.targetIds || []).includes(d.id);
  const tablet = /ipad|tablet/i.test(d.name);
  const spec = (i, value, label) => `<span class="spec" title="${escape(label)}">${icon(i)}${escape(value || '—')}</span>`;
  return `<article class="device-card ${d.group} ${online ? 'online' : 'offline'} ${active ? 'target' : ''} ${tablet ? 'tablet' : ''}" data-device="${escape(d.id)}">
    <div class="card-top"><span class="platform-label">${icon(groupIcon[d.group])}${groupLabel[d.group]}</span><div class="card-badges">${active ? `<span class="target-badge">${icon('crosshair')}IDE</span>` : ''}<span class="status-badge ${online ? 'online' : ''}"><span class="dot ${online ? 'green' : ''}"></span>${online ? 'Online' : 'Offline'}</span></div></div>
    <div class="device-stage" aria-hidden="true"><div class="stage-grid"></div><div class="device-model"><div class="phone-screen">${online ? `<div class="wallpaper"></div><span class="screen-clock">9:41</span><span class="screen-date">Thursday, October 29</span><span class="screen-label">READY FOR IDE</span>` : `<span class="offline-symbol">${icon('power')}</span>`}</div></div></div>
    <div class="card-info"><h3 class="card-name">${escape(d.name)}${d.group === 'physical' ? icon('cable') : ''}</h3><p class="device-os">${escape(d.os)}</p><div class="device-specs">${spec('memory-stick', d.ram, 'Device RAM; — means unavailable')}${spec('cpu', d.cpu, 'Logical CPU cores; — means unavailable')}${spec('scan', d.resolution?.replaceAll(' ', ''), 'Display resolution; — means unavailable')}</div></div>
    <div class="card-actions"><button class="button" data-action="boot" ${online || d.group === 'physical' ? 'disabled' : ''}>${icon(online ? 'circle-check' : 'power')}${online ? 'Device started' : d.group === 'physical' ? 'Turn on manually' : 'Start device'}</button><label class="target-action ${active ? 'selected' : ''}"><input type="checkbox" data-action="select" aria-label="Select ${escape(d.name)} for IDE debug" ${active ? 'checked' : ''} ${targetSaving || (!active && (!online || !d.flutterId)) ? 'disabled' : ''}>${active ? 'Selected for IDE' : 'Select for IDE'}</label></div>
  </article>`;
}
function empty(title, text, i = 'monitor-smartphone', action = '') {
  return `<div class="empty-state">${icon(i)}<h3>${escape(title)}</h3><p>${escape(text)}</p>${action}</div>`;
}
function render() {
  const devices = state.devices;
  const selected = state.settings.targetIds || [];
  const unavailable = selected.filter(id => !devices.some(d => d.id === id && d.state === 'online' && d.flutterId));
  $('#stat-total').textContent = devices.length; $('#stat-online').textContent = devices.filter(d => d.state === 'online').length;
  $('#stat-selected').textContent = selected.length; $('#nav-device-count').textContent = devices.length;
  $('#all-count').textContent = devices.length;
  const workspace = state.settings.workspace;
  $('#workspace-name').textContent = workspace ? workspace.split(/[\\/]/).filter(Boolean).at(-1) : 'Select workspace';
  $('#workspace-switch').title = workspace || 'Choose a Flutter workspace';
  $('#demo-notice').classList.toggle('hidden', !state.demo);
  if (state.demo) $('#mode-badge').innerHTML = '<span class="dot green"></span>DEMO ENVIRONMENT';
  $('#host-label').textContent = `Connected to ${state.host || 'localhost'}`;
  const shown = devices.filter(d => (filter === 'all' || d.group === filter) && (!onlyOnline || d.state === 'online') && `${d.name} ${d.os} ${d.id}`.toLowerCase().includes(search.toLowerCase()));
  $('#list-label').innerHTML = `${filter === 'all' ? 'ALL DEVICES' : groupLabel[filter] + 'S'} <span class="muted">/ ${shown.length}</span>`;
  $('#devices-grid').innerHTML = shown.length ? shown.map(deviceCard).join('') : empty(refreshing || state.scanning ? 'Discovering your devices…' : devices.length ? 'No matching devices' : 'Your device lab starts here', refreshing || state.scanning ? 'Checking Flutter, Android emulators, and iOS simulators. The first scan can take a moment.' : devices.length ? 'Try a different search or turn off the online filter.' : 'Connect a device, create an Android AVD, or install an iOS Simulator in Xcode. Then refresh to bring it into your workspace.', 'monitor-smartphone', !devices.length && !refreshing && !state.scanning ? '<button class="button" id="empty-refresh">Refresh devices</button><button class="button" id="empty-help">Setup guide</button>' : '');
  $('#scan-time').textContent = state.scannedAt ? `Last synced ${new Date(state.scannedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · Auto-refresh every 30s` : 'Waiting for first scan';
  $('#ide-summary').textContent = targetSaving ? 'Saving device selection…' : unavailable.length ? `${selected.length} selected · ${unavailable.length} unavailable. Uncheck unavailable devices before debugging.` : selected.length ? `${selected.length} device(s) selected · Antigravity → Run and Debug → Snapkit: Selected Devices → F5` : 'Select one or more started devices, then run Debug in Antigravity.';
  renderWarnings(); renderProvisionJobs(); icons();
  if (window.SNAPKIT_CONTROLLER) renderConnection();
}
function renderWarnings() {
  $('#warnings').classList.toggle('hidden', !state.warnings.length);
  $('#warnings').innerHTML = state.warnings.length ? `<details><summary>${state.warnings.length} toolchain ${state.warnings.length === 1 ? 'notice' : 'notices'} — view details</summary>${state.warnings.map(w => `<p>${escape(w)}</p>`).join('')}</details>` : '';
}
async function refresh(button = $('#refresh-button')) {
  if (refreshing) return;
  refreshing = true; $('#refresh-button svg')?.classList.add('spin');
  await busy(button, async () => { const result = await api('/api/scan', {}); state = { ...state, ...result, scanning: false };  });
  refreshing = false; $('#refresh-button svg')?.classList.remove('spin'); render();
}
let workspaceProfiles = [];
let workspaceProfileRequest = 0;
let workspaceProfilePath = '';
async function loadWorkspaceProfiles() {
  const request = ++workspaceProfileRequest;
  const path = $('#workspace-path').value.trim();
  workspaceProfilePath = path;
  workspaceProfiles = [];
  $('#workspace-profile').innerHTML = '<option value="">Custom configuration</option>';
  $('#workspace-flavors').innerHTML = '';
  if (!path || window.SNAPKIT_PREVIEW) return;
  try {
    const result = await api('/api/workspace/profiles?path=' + encodeURIComponent(path));
    if (request !== workspaceProfileRequest) return;
    workspaceProfiles = result.profiles;
    $('#workspace-profile').innerHTML += workspaceProfiles.map((p, i) => `<option value="${i}">${escape(p.name)}</option>`).join('');
    $('#workspace-flavors').innerHTML = result.flavors.map(f => `<option value="${escape(f)}"></option>`).join('');
  } catch (error) { if (request === workspaceProfileRequest) $('#workspace-error').textContent = error.message; }
}
function showWorkspace() {
  $('#workspace-path').value = state.demo ? '' : (state.settings.workspace || '');
  $('#workspace-flavor').value = state.settings.flavor || '';
  $('#workspace-target').value = state.settings.target || 'lib/main.dart';
  $('#workspace-defines').value = state.settings.defineFile || '';
  $('#workspace-error').textContent = ''; $('#workspace-dialog').showModal(); loadWorkspaceProfiles();
}
$('#workspace-path').addEventListener('change', () => {
  if ($('#workspace-path').value.trim() === workspaceProfilePath) return;
  $('#workspace-error').textContent = '';
  $('#workspace-flavor').value = ''; $('#workspace-target').value = 'lib/main.dart'; $('#workspace-defines').value = '';
  loadWorkspaceProfiles();
});
$('#workspace-profile').addEventListener('change', e => {
  const profile = workspaceProfiles[e.target.value];
  if (!profile) return;
  $('#workspace-flavor').value = profile.flavor; $('#workspace-target').value = profile.target; $('#workspace-defines').value = profile.defineFile;
});
$('#workspace-form').addEventListener('submit', e => {
  e.preventDefault(); const button = e.submitter;
  busy(button, async () => {
    try { const result = await api('/api/workspace', { path: $('#workspace-path').value.trim(), flavor: $('#workspace-flavor').value.trim(), target: $('#workspace-target').value.trim(), defineFile: $('#workspace-defines').value.trim() }); state.settings = { ...state.settings, ...result.settings }; await loadState(); $('#workspace-dialog').close(); toast(result.message); }
    catch (error) { $('#workspace-error').textContent = error.message; }
  });
});
['#workspace-switch', '#settings-button', '#ide-setup'].forEach(id => $(id).addEventListener('click', showWorkspace));
['#guide-button', '#help-button'].forEach(id => $(id).addEventListener('click', () => $('#guide-dialog').showModal()));
$$('.close-dialog').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
$('#theme-toggle').addEventListener('click', () => { document.documentElement.classList.toggle('light'); localStorage.setItem('snapkit-theme', document.documentElement.classList.contains('light') ? 'light' : 'dark'); });
if (localStorage.getItem('snapkit-theme') === 'light') document.documentElement.classList.add('light');

let targetSaving = false;
async function loadState() {
  const previous = JSON.stringify(state);
  const result = await api('/api/state');
  state = { ...state, ...result };
  if (!window.SNAPKIT_CONTROLLER || previous !== JSON.stringify(state)) render();
}
$$('[data-filter]').forEach(b => b.addEventListener('click', () => { filter = b.dataset.filter; $$('[data-filter]').forEach(t => { t.classList.toggle('active', t === b); t.setAttribute('aria-selected', t === b ? 'true' : 'false'); }); render(); }));
$('#device-search').addEventListener('input', e => { search = e.target.value; render(); });
$('#online-only').addEventListener('change', e => { onlyOnline = e.target.checked; render(); });
$('#refresh-button').addEventListener('click', () => refresh());
$('#devices-grid').addEventListener('click', e => {
  if (e.target.closest('#empty-refresh')) return refresh();
  if (e.target.closest('#empty-help')) return $('#guide-dialog').showModal();
  const b = e.target.closest('button[data-action="boot"]'); if (!b || b.disabled) return;
  const id = b.closest('[data-device]').dataset.device;
  busy(b, async () => { const result = await api(`/api/devices/${encodeURIComponent(id)}/boot`, {}); toast(result.message); await loadState(); });
});
$('#devices-grid').addEventListener('change', async e => {
  const box = e.target.closest('[data-action="select"]'); if (!box || targetSaving) return;
  if (!state.settings.workspace) { box.checked = false; showWorkspace(); return; }
  const id = box.closest('[data-device]').dataset.device;
  const ids = new Set(state.settings.targetIds || []);
  box.checked ? ids.add(id) : ids.delete(id);
  targetSaving = true; render();
  try { const result = await api('/api/targets', { ids: [...ids] }); state.settings = result.settings; toast(result.message); }
  catch (error) { toast(error.message, true); }
  finally { targetSaving = false; render(); }
});
document.addEventListener('keydown', e => {
  if ($$('dialog[open]').length || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === '/') { e.preventDefault(); $('#device-search').focus(); }
});
async function init() {
  icons();
  if (window.SNAPKIT_CONTROLLER) { await initController(); return; }
  try {
    await loadState();
    if (window.SNAPKIT_PREVIEW) {
      $('#connection-button').textContent = 'Manage real devices';
      $('#server-status').textContent = 'Static preview · sample data';
      $('#mode-badge').textContent = 'READ-ONLY PREVIEW';
      $('#demo-notice span').textContent = 'Read-only preview · Sample devices. Start Snapkit locally to create and start real devices.';
      return;
    }
    const events = new EventSource('/api/events');
    events.addEventListener('devices', e => { state = { ...state, ...JSON.parse(e.data), scanning: false }; render(); });
    events.addEventListener('jobs', e => {
      const jobs = JSON.parse(e.data);
      const changed = jobs.filter(job => state.jobs?.some(old => old.id === job.id && old.status === 'running') && job.status !== 'running');
      state.jobs = jobs; renderProvisionJobs();
      for (const job of changed) toast(job.status === 'error' ? `${job.title}: ${job.error}` : `${job.title} completed`, job.status === 'error');
      if (changed.length && $('#create-dialog').open) loadCreationCatalog();
    });
    events.addEventListener('settings', e => { state.settings = { ...state.settings, ...JSON.parse(e.data) }; render(); });
    events.onopen = () => { $('#server-status').textContent = 'Local server connected'; loadState().catch(() => {}); };
    events.onerror = () => { $('#server-status').textContent = 'Reconnecting to server…'; };
    if (state.scanning) setTimeout(() => loadState().catch(() => {}), 5000);
  } catch (error) { toast(`Cannot connect to local server: ${error.message}`, true); $('#server-status').textContent = 'Local server unavailable'; }
}
queueMicrotask(init);
function renderConnection() {
  $('#connection-button').textContent = connection ? 'Connection settings' : 'Connect local server';
  $('#demo-notice').classList.remove('hidden');
  $('#demo-notice span').textContent = !connection ? 'Connect Snapkit running on this computer to control real devices. No sample devices are loaded.' : remoteOffline ? 'Cannot reach the local server. Keep npm start running and check browser local network permission.' : state.demo ? 'Connected to a local DEMO backend. Actions are simulated.' : 'Connected to your local Snapkit server. Device commands run on this computer.';
  $('#mode-badge').textContent = connection ? remoteOffline ? 'AGENT OFFLINE' : state.demo ? 'LOCAL DEMO BACKEND' : 'CONNECTED TO LOCAL AGENT' : 'NOT CONNECTED';
  $('#server-status').textContent = connection ? remoteOffline ? 'Local server unavailable' : `Connected · ${connection.base}` : 'Local server not connected';
  if (!connection) $('#devices-grid').innerHTML = empty('Connect your local device lab', 'Start Snapkit with npm start, then click Connect local server and enter a code from your local Dashboard.', 'link');
}
function forgetConnection() {
  clearInterval(remotePoll); remotePoll = null; connection = null; remoteOffline = false;
  sessionStorage.removeItem('snapkit-connection');
  state = { devices: [], settings: { targetIds: [] }, warnings: [], jobs: [] };
  render();
}
function startRemotePolling() {
  clearInterval(remotePoll);
  remotePoll = setInterval(async () => {
    if (remotePolling || !connection) return;
    remotePolling = true;
    const previousJobs = state.jobs || [];
    try {
      await loadState(); remoteOffline = false; renderConnection();
      const finished = (state.jobs || []).filter(j => j.status !== 'running' && previousJobs.some(old => old.id === j.id && old.status === 'running'));
      if (finished.length && $('#create-dialog').open) await loadCreationCatalog();
    } catch { remoteOffline = true; renderConnection(); }
    finally { remotePolling = false; }
  }, 2000);
}
async function connectController(base, code) {
  base = agentURL(base);
  let response;
  try { response = await fetch(base + '/api/pairing/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', body: JSON.stringify({ code: code.trim() }) }); }
  catch { throw new Error('Cannot reach Snapkit. Run npm start, open the local Dashboard, and allow local network access for this website when your browser asks.'); }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Pairing failed');
  connection = { base, token: result.token, expiresAt: result.expiresAt }; remoteOffline = false;
  sessionStorage.setItem('snapkit-connection', JSON.stringify(connection));
  await loadState(); startRemotePolling(); renderConnection();
  if ($('#pairing-dialog').open) $('#pairing-dialog').close();
}
async function initController() {
  render();
  const fragment = new URLSearchParams(location.hash.slice(1));
  if (fragment.has('pair')) {
    history.replaceState(null, '', location.pathname + location.search);
    $('#agent-url').value = fragment.get('agent') || 'http://127.0.0.1:4310'; $('#agent-code').value = fragment.get('pair');
    try { await connectController($('#agent-url').value, $('#agent-code').value); }
    catch (error) { showPairing(); $('#pairing-error').textContent = error.message; }
    return;
  }
  try {
    const saved = JSON.parse(sessionStorage.getItem('snapkit-connection'));
    if (saved && saved.expiresAt > Date.now() && typeof saved.token === 'string') {
      connection = { ...saved, base: agentURL(saved.base) };
      await loadState(); startRemotePolling(); renderConnection();
    }
  } catch { forgetConnection(); }
  if (!connection) await showPairing();
}
async function showPairing() {
  $('#pairing-error').textContent = '';
  $('#local-pairing').classList.toggle('hidden', !!window.SNAPKIT_CONTROLLER);
  $('#pairing-form').classList.toggle('hidden', !window.SNAPKIT_CONTROLLER);
  if (!$('#pairing-dialog').open) $('#pairing-dialog').showModal();
  if (window.SNAPKIT_CONTROLLER) { if (connection) $('#agent-url').value = connection.base; return; }
  try {
    if (!state.token) await loadState();
    const result = await api('/api/pairing/code', {});
    $('#pairing-code').textContent = result.code;
    $('#pairing-link').href = result.webUrl + '#pair=' + encodeURIComponent(result.code) + '&agent=' + encodeURIComponent(location.origin);
  } catch (error) { $('#pairing-error').textContent = error.message; }
}
$('#connection-button').addEventListener('click', () => {
  if (window.SNAPKIT_PREVIEW) { location.href = '../control/'; return; }
  showPairing();
});
$('#pairing-form').addEventListener('submit', e => {
  e.preventDefault(); $('#pairing-error').textContent = '';
  busy($('#pairing-submit'), async () => {
    try { await connectController($('#agent-url').value, $('#agent-code').value); }
    catch (error) { $('#pairing-error').textContent = error.message; }
  });
});
$('#disconnect-agent').addEventListener('click', async () => {
  try { if (connection) await api('/api/pairing/revoke', {}); }
  catch { /* The local browser disconnects even if the agent is offline. */ }
  finally { forgetConnection(); $('#agent-code').value = ''; $('#pairing-dialog').close(); }
});
$('#revoke-connections').addEventListener('click', e => busy(e.currentTarget, async () => {
  const result = await api('/api/pairing/revoke', {});
  $('#pairing-code').textContent = 'Connections revoked'; $('#pairing-link').removeAttribute('href'); toast(result.message);
}));

$('#browse-workspace').addEventListener('click', e => busy(e.currentTarget, async () => {
  $('#workspace-error').textContent = '';
  try {
    const result = await api('/api/folders/pick', {});
    if (result.path) { $('#workspace-path').value = result.path; $('#workspace-path').focus(); $('#workspace-path').dispatchEvent(new Event('change')); }
  } catch (error) { $('#workspace-error').textContent = error.message; }
}));

let creationCatalog = null, creationPlatform = 'ios', creationNameEdited = false, catalogLoading = false;
let iosDownloadCatalog = null, iosDownloadModelId = null;
const iosVersionCode = value => /^\d{1,2}\.\d{1,2}(\.\d{1,2})?$/.test(value || '') ? value.split('.').reduce((n, part, i) => n + Number(part) * [65536, 256, 1][i], 0) : null;
function iosDownloadError() {
  const model = selectedCreationModel(), code = iosVersionCode($('#ios-download-version').value.trim());
  if (!model || model.unsupported) return 'This model cannot be enabled by downloading an iOS runtime in this Xcode.';
  if (code === null) return 'Choose an Apple-listed version, or enter an iOS version manually.';
  if (code < (model.minRuntimeVersion ?? 0) || code > (model.maxRuntimeVersion ?? 4294967295)) return 'This iOS version is outside the model’s supported range.';
  return '';
}
function renderIOSDownloads() {
  if (creationPlatform !== 'ios') return;
  const model = selectedCreationModel();
  const changed = iosDownloadModelId !== model?.id; iosDownloadModelId = model?.id;
  const blocked = !model || model.unsupported;
  $('#ios-model-help').textContent = blocked ? (model?.reason || 'Choose a device model first.') :
    `${model.name}${model.minVersion ? ` needs iOS ${model.minVersion}${model.maxVersion ? `–${model.maxVersion}` : ' or later'}` : ' uses runtimes supported by Xcode'}. ${model.runtimeIds.length ? 'Install another version below if needed.' : 'No compatible runtime is installed. Load Apple versions below or open Xcode → Settings → Components.'}`;
  $('#load-ios-versions').disabled = blocked;
  $('#use-supported-ios').classList.toggle('hidden', !blocked);
  const choices = (iosDownloadCatalog || []).filter(r => !blocked && iosVersionCode(r.version) >= (model.minRuntimeVersion ?? 0) && iosVersionCode(r.version) <= (model.maxRuntimeVersion ?? 4294967295));
  const previous = $('#ios-download-choice').value;
  $('#ios-download-choice').innerHTML = choices.length ? choices.map(r => `<option value="${escape(r.version)}">${escape(r.name)}${r.bytes ? ` · ${(r.bytes / 1073741824).toFixed(1)} GB` : ''}${r.authentication ? ' · Apple account may be required' : ''}</option>`).join('') : `<option value="">${blocked ? 'Unsupported model in this Xcode' : iosDownloadCatalog ? 'No Apple-listed version matches this model and host' : 'Load Apple iOS versions first'}</option>`;
  $('#ios-download-choice').disabled = !choices.length;
  if (!changed && choices.some(r => r.version === previous)) $('#ios-download-choice').value = previous;
  if (changed || !$('#ios-download-version').value) $('#ios-download-version').value = choices[0]?.version || '';
  $('#ios-download-version').disabled = blocked;
  $('#ios-download-path').textContent = state.storage?.downloads || 'configured SSD downloads directory';
  if (model && !model.runtimeIds.length) $('#runtime-downloads').open = true;
  $('#ios-download-validation').textContent = iosDownloadError();
}
function renderProvisionJobs() {
  const openJobs = new Set($$('#provision-jobs details[open]').map(d => d.closest('[data-job]').dataset.job));
  const jobs = (state.jobs || []).slice(-3).reverse();
  if (jobs.some(j => j.status === 'running')) $('.setup-history').open = true;
  $('#provision-jobs').classList.toggle('hidden', !jobs.length);
  $('#provision-jobs').innerHTML = jobs.map(job => `<article class="provision-job" data-job="${escape(job.id)}"><div class="job-heading">${icon(job.status === 'running' ? 'loader-circle' : job.status === 'error' ? 'circle-alert' : 'circle-check')}<strong>${escape(job.title)}</strong><span class="status-badge ${job.status === 'completed' ? 'online' : ''}">${escape(job.status)}</span></div>${job.error ? `<p class="job-error">${escape(job.error)}</p>` : ''}${job.result?.path ? `<p class="job-path">${escape(job.result.path)}</p>` : ''}${job.result?.message ? `<p class="job-path">${escape(job.result.message)}</p>` : ''}${job.logs?.length ? `<details ${openJobs.has(job.id) ? 'open' : ''}><summary>Setup output</summary><pre>${escape(job.logs.join('\n'))}</pre></details>` : ''}</article>`).join('');
  icons(); updateCreateAvailability();
}
function trackProvisionJob(job) {
  $('.setup-history').open = true;
  state.jobs ||= [];
  const index = state.jobs.findIndex(j => j.id === job.id);
  if (index >= 0) {
    if (state.jobs[index].status === 'running' || job.status !== 'running') state.jobs[index] = job;
  } else state.jobs.push(job);
  renderProvisionJobs();
  toast(job.status === 'completed' ? job.title : `${job.title} started. Progress appears below the device list.`);
}
function selectedCreationModel() { return creationCatalog?.[creationPlatform]?.models.find(m => m.id === $('#create-model').value); }
function selectedCreationRuntime() {
  const options = creationPlatform === 'ios' ? creationCatalog?.ios.runtimes : creationCatalog?.android.images;
  return options?.find(r => r.id === $('#create-runtime').value);
}
function updateCreateAvailability() {
  if (!creationCatalog) { $('#create-device-submit').disabled = true; return; }
  const model = selectedCreationModel(), runtime = selectedCreationRuntime();
  const jobRunning = (state.jobs || []).some(j => j.status === 'running');
  const supported = !!model && !!runtime && (creationPlatform === 'ios' ? model.runtimeIds.includes(runtime.id) && runtime.available : model.imageIds.includes(runtime.id) && runtime.installed);
  $('#create-device-submit').disabled = !supported || jobRunning || catalogLoading || (creationPlatform === 'ios' && !state.demo && (!state.storage?.iosReady || state.iosAccess?.blocked));
  $('#install-android-image').disabled = !runtime || runtime.installed || jobRunning;
  $('#download-ios-runtime').disabled = jobRunning || (creationPlatform === 'ios' && !!iosDownloadError());
  $('#import-ios-runtime').disabled = jobRunning || !$('#ios-runtime-file').value;
}
function updateCreationName() {
  if (creationNameEdited) return;
  const model = selectedCreationModel(), runtime = selectedCreationRuntime();
  $('#create-name').value = model ? `${model.name} - ${runtime?.name?.split(' · ')[0] || 'Test'}`.replace(/[^a-zA-Z0-9 ._()-]/g, '').slice(0, 64) : '';
}
function renderCreationRuntimes(keep = '') {
  const model = selectedCreationModel();
  const all = creationPlatform === 'ios' ? creationCatalog.ios.runtimes : creationCatalog.android.images;
  const ids = model?.runtimeIds || model?.imageIds || [];
  const versions = all.filter(r => ids.includes(r.id));
  $('#create-runtime').innerHTML = versions.length ? versions.map(r => `<option value="${escape(r.id)}">${escape(r.name)}${creationPlatform === 'android' ? r.installed ? ' — Installed' : ' — Download required' : ' — Installed'}</option>`).join('') : '<option value="">No compatible installed runtime</option>';
  if (versions.some(r => r.id === keep)) $('#create-runtime').value = keep;
  else if (creationPlatform === 'android' && versions.some(r => r.installed)) $('#create-runtime').value = versions.find(r => r.installed).id;
  renderCompatibility(); updateCreationName();
}
function renderCompatibility() {
  const model = selectedCreationModel(), runtime = selectedCreationRuntime();
  const note = $('#compatibility-note'); let unavailable = !runtime;
  if (!model) note.textContent = 'No model matches your search. Try a different name.';
  else if (!runtime) note.textContent = model.reason || 'No compatible version is available. Load downloadable Android versions or install a supported iOS runtime.';
  else if (creationPlatform === 'android' && !runtime.installed) { note.textContent = 'Download this system image first. Once installed, you can create the device.'; unavailable = true; }
  else note.textContent = creationPlatform === 'ios' ? 'Compatible model + runtime provided by your Xcode installation.' : 'System image matches this hardware profile and your computer’s CPU architecture.';
  if (creationPlatform === 'ios' && !state.demo && !state.storage?.iosReady) { note.textContent += ' iOS device storage is unavailable. Check the configured CoreSimulator directory.'; unavailable = true; }
  if (creationPlatform === 'ios' && !state.demo && state.iosAccess?.blocked) { note.textContent = state.iosAccess.reason; unavailable = true; }
  note.classList.toggle('unavailable', unavailable);
  $('#install-android-image').classList.toggle('hidden', creationPlatform !== 'android' || !runtime || runtime.installed);
  renderIOSDownloads();
  updateCreateAvailability();
}
function renderCreationModels(keepModel = '', keepRuntime = '') {
  if (!creationCatalog) return;
  const query = $('#model-search').value.toLowerCase().replace(/\s/g, '');
  const models = creationCatalog[creationPlatform].models.filter(m => m.name.toLowerCase().replace(/\s/g, '').includes(query));
  $('#create-model').innerHTML = models.length ? models.map(m => `<option value="${escape(m.id)}">${escape(m.name)}${m.unsupported ? ' — Not supported by this toolchain' : ''}</option>`).join('') : '<option value="">No matching models</option>';
  if (models.some(m => m.id === keepModel)) $('#create-model').value = keepModel;
  renderCreationRuntimes(keepRuntime);
}
function setCreationPlatform(platform) {
  creationPlatform = platform; creationNameEdited = false; $('#model-search').value = ''; $('#create-error').textContent = '';
  $$('[data-create-platform]').forEach(b => { b.classList.toggle('active', b.dataset.createPlatform === platform); b.setAttribute('aria-pressed', String(b.dataset.createPlatform === platform)); });
  $('#ios-download-tools').classList.toggle('hidden', platform !== 'ios'); $('#android-download-tools').classList.toggle('hidden', platform !== 'android');
  $('#create-storage-path').textContent = (platform === 'ios' ? state.storage?.iosDevices : state.storage?.avd) || 'SSD device storage';
  $('#create-storage-label').textContent = platform === 'ios' && state.storage?.iosOnSSD === false ? 'iOS DATA ON INTERNAL DISK' : 'DEVICE DATA ON SSD';
  renderCreationModels(); icons();
}
async function loadCreationCatalog(remote = false) {
  if (catalogLoading) return;
  catalogLoading = true; const previousModel = $('#create-model').value, previousRuntime = $('#create-runtime').value;
  $('#create-loading').classList.remove('hidden'); $('#create-loading').textContent = remote ? 'Loading downloadable Android versions from the SDK repository…' : 'Reading your installed models and OS versions…';
  $('#create-error').textContent = ''; updateCreateAvailability();
  try {
    creationCatalog = await api(`/api/provision/catalog${remote ? '?remote=1' : ''}`);
    $('#create-form').classList.remove('hidden');
    $('#catalog-warnings').textContent = creationCatalog.warnings.join('\n');
    $('#ios-runtime-file').innerHTML = creationCatalog.downloads.length ? creationCatalog.downloads.map(f => `<option value="${escape(f)}">${escape(f)}</option>`).join('') : '<option value="">No downloaded runtime DMGs</option>';
    renderCreationModels(previousModel, previousRuntime);
  } catch (e) { $('#create-error').textContent = e.message; $('#create-form').classList.remove('hidden'); }
  finally { catalogLoading = false; $('#create-loading').classList.add('hidden'); updateCreateAvailability(); }
}
$('#add-device').addEventListener('click', async () => {
  creationCatalog = null; creationNameEdited = false;
  $('#create-form').classList.add('hidden'); $('#create-dialog').showModal();
  creationPlatform = state.platform === 'darwin' ? 'ios' : 'android';
  $$('[data-create-platform]').forEach(b => b.disabled = b.dataset.createPlatform === 'ios' && state.platform !== 'darwin');
  await loadCreationCatalog(); setCreationPlatform(creationPlatform);
});
$$('[data-create-platform]').forEach(b => b.addEventListener('click', () => setCreationPlatform(b.dataset.createPlatform)));
$('#model-search').addEventListener('input', () => renderCreationModels());
$('#create-model').addEventListener('change', () => { creationNameEdited = false; renderCreationRuntimes(); });
$('#create-runtime').addEventListener('change', () => { renderCompatibility(); updateCreationName(); });
$('#create-name').addEventListener('input', () => { creationNameEdited = true; });
$('#create-form').addEventListener('submit', async e => {
  e.preventDefault();
  await busy(e.submitter, async () => {
    try {
      const result = await api('/api/provision/create', { platform: creationPlatform, model: $('#create-model').value, runtime: $('#create-runtime').value, name: $('#create-name').value.trim() });
      trackProvisionJob(result.job); $('#create-dialog').close();
      if (result.demo) await loadState();
    } catch (error) { $('#create-error').textContent = error.message; }
  });
  updateCreateAvailability();
});
$('#load-android-versions').addEventListener('click', e => busy(e.currentTarget, () => loadCreationCatalog(true)));
$('#refresh-catalog').addEventListener('click', e => busy(e.currentTarget, () => loadCreationCatalog()));
$('#install-android-image').addEventListener('click', async e => {
  await busy(e.currentTarget, async () => {
    const result = await api('/api/provision/android/install', { image: $('#create-runtime').value }); trackProvisionJob(result.job);
    if (result.job.status === 'completed') await loadCreationCatalog();
  }); updateCreateAvailability();
});
$('#download-ios-runtime').addEventListener('click', async e => {
  await busy(e.currentTarget, async () => {
    const error = iosDownloadError(); if (error) throw new Error(error);
    const result = await api('/api/provision/ios/download', { version: $('#ios-download-version').value.trim(), model: $('#create-model').value }); trackProvisionJob(result.job);
    if (result.job.status === 'completed') await loadCreationCatalog();
  });
  updateCreateAvailability();
});
$('#load-ios-versions').addEventListener('click', e => busy(e.currentTarget, async () => {
  try {
    const result = await api('/api/provision/ios/runtimes'); iosDownloadCatalog = result.runtimes;
    renderIOSDownloads(); updateCreateAvailability();
  } catch (error) { $('#ios-model-help').textContent = `${error.message}. You can open Xcode Components or enter a version manually.`; throw error; }
}));
$('#ios-download-choice').addEventListener('change', () => {
  $('#ios-download-version').value = $('#ios-download-choice').value;
  $('#ios-download-validation').textContent = iosDownloadError(); updateCreateAvailability();
});
$('#ios-download-version').addEventListener('input', () => { $('#ios-download-validation').textContent = iosDownloadError(); updateCreateAvailability(); });
$('#open-xcode').addEventListener('click', e => busy(e.currentTarget, async () => { const result = await api('/api/provision/ios/xcode', {}); toast(result.message); }));
$('#use-supported-ios').addEventListener('click', () => {
  const model = creationCatalog.ios.models.find(m => !m.unsupported && m.runtimeIds.length);
  if (model) { $('#create-model').value = model.id; renderCreationRuntimes(); }
});
$('#import-ios-runtime').addEventListener('click', async e => {
  await busy(e.currentTarget, async () => { const result = await api('/api/provision/ios/import', { file: $('#ios-runtime-file').value }); trackProvisionJob(result.job); });
  updateCreateAvailability();
});
