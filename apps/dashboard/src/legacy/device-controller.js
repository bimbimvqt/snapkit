import { agentRequest } from '../shared/api/client.ts';
import { renderDeviceGrid } from '../features/devices/render.tsx';
const t = (...args) => window.SnapkitI18n.t(...args);
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const icon = name => `<i data-lucide="${name}" aria-hidden="true"></i>`;
const icons = () => {
  if (!document.querySelector('i[data-lucide]')) return;
  window.lucide?.createIcons({ attrs: { 'aria-hidden': 'true' } });
  document.querySelectorAll('svg[data-lucide]').forEach(node => node.removeAttribute('data-lucide'));
};
const booting = new Set(), shuttingDown = new Set(), stoppingDebug = new Set();
let compact = localStorage.getItem('snapkit-view') === 'compact';
let state = { devices: [], settings: /** @type {import('../features/workspace/types.ts').WorkspaceSettings} */ ({ targetIds: [] }), warnings: [], jobs: [] };
let filter = 'all', search = '', onlyOnline = false;
let refreshing = false;
/** @type {import('../shared/api/client.ts').AgentConnection | null} */
let connection = null;
let remotePoll = null, remotePolling = false;
let remoteOffline = false;
function agentURL(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error(t("Use a loopback server URL such as http://127.0.0.1:4310"));
  return url.origin;
}
const groupLabel = { ios: 'iOS SIMULATOR', android: 'ANDROID EMULATOR', physical: 'PHYSICAL DEVICE' };
const groupIcon = { ios: 'smartphone', android: 'bot', physical: 'usb' };
const previewReadOnlyMessage = "Preview only. Open the local Dashboard at http://127.0.0.1:4310 to control your devices.";

async function api(url, data) {
  if (window.SNAPKIT_PREVIEW) {
    if (data !== undefined) throw new Error(previewReadOnlyMessage);
    if (url === '/api/apple/teams') return { teams: [], selections: {} };
    if (url === '/api/apple/detected') return { teams: [] };
    if (url === '/api/releases') return { jobs: [], busy: false, uploadConfigured: false, demo: true };
    if (url === '/api/releases/catalog') return { workspace: state.settings.workspace, platform: 'darwin', android: true, ios: true, flavors: [], profiles: [{ name: 'Workspace settings', flavor: '', target: 'lib/main.dart', defineFile: '' }], version: '1.0.0+1' };
    if (url === '/api/run-profiles') return { profiles: [] };
    if (url === '/api/workspace/doctor') return { ready: true, checkedAt: Date.now(), checks: [{id:'preview', title:'Sample project',status:'ready',detail:'Demo only. Open your project in Snapkit Desktop to check its configuration.'}] };
    if (url === '/api/tools') return { sets: [], captures: [], recordings: [], jobs: [], demo: true };
    if (url === '/api/state') return structuredClone(window.SNAPKIT_PREVIEW.state);
    if (url === '/api/product') return { version: __APP_VERSION__, channel: 'beta', preferences: { onboardingComplete: false, editor: 'vscode' }, billing: { phase: 'free-beta', checkoutEnabled: false } };
    if (url.startsWith('/api/diagnostics')) return { ready: true, platform: 'darwin', arch: 'arm64', memoryGB: 16, computer: { model: 'Mac mini', name: 'Sample Mac', chip: 'Apple M4', osName: 'macOS', osVersion: 'macOS 26', form: 'mini' }, checks: [{ id: 'flutter', title: 'Flutter', status: 'ready', detail: "Sample · Flutter ready", help: 'https://docs.flutter.dev/get-started/install' }, { id: 'android', title: "Android tools", status: 'ready', detail: "Sample · Android tools ready", help: 'https://developer.android.com/studio' }, { id: 'ios', title: "iOS Simulator", status: 'ready', detail: "Sample · iOS ready", help: 'https://developer.apple.com/xcode/' }], storage: { root: "Sample · your computer" }, advice: "Demo only. Your actual setup is checked in Snapkit Desktop." };
    if (url.startsWith('/api/provision/catalog')) return structuredClone(window.SNAPKIT_PREVIEW.catalog);
    if (url === '/api/provision/ios/runtimes') return { runtimes: structuredClone(window.SNAPKIT_PREVIEW.catalog.ios.downloadable) };
    throw new Error("This action requires the local Snapkit server.");
  }
  if (window.SNAPKIT_CONTROLLER && !connection) throw new Error(t("Connect your local Snapkit server first."));
  try { return await agentRequest(url, data, { connection, token: state.token, unauthorized: forgetConnection }); }
  catch (error) { document.dispatchEvent(new Event('snapkit:review-error')); throw error; }
}
function toast(message, error = false) {
  // Sample-device actions remain read-only without reporting an expected limitation as an error.
  if (window.SNAPKIT_PREVIEW && message === previewReadOnlyMessage) return;
  if (error) document.dispatchEvent(new Event('snapkit:review-error'));
  const node = document.createElement('div'); node.className = `toast${error ? ' error' : ''}`;
  node.innerHTML = `${icon(error ? 'circle-alert' : 'circle-check')}<span>${escape(t(message))}</span>`;
  $('#toast-region').append(node); icons(); setTimeout(() => node.remove(), error ? 9000 : 4500);
}
async function busy(button, task) {
  if (button?.disabled) return;
  if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
  try { await task(); } catch (e) { toast(e.message, true); }
  finally { if (button) { button.disabled = false; button.removeAttribute('aria-busy'); } }
}
function render() {
  const devices = state.devices;
  const selected = state.settings.targetIds || [];
  const unavailable = selected.filter(id => !devices.some(d => d.id === id && d.state === 'online' && d.flutterId));
  $('#stat-total').textContent = devices.length; $('#stat-online').textContent = devices.filter(d => d.state === 'online').length;
  $('#stat-selected').textContent = selected.length; $('#nav-device-count').textContent = devices.length;
  $('#all-count').textContent = devices.length;
  const workspace = state.settings.workspace;
  $('#demo-notice').classList.toggle('hidden', !state.demo);
  if (state.demo) $('#mode-badge').innerHTML = `<span class="dot green"></span>${t("DEMO ENVIRONMENT")}`;
  $('#host-label').textContent = t("Connected to {0}", [state.host || 'localhost']);
  const shown = devices.filter(d => (filter === 'all' || d.group === filter) && (!onlyOnline || d.state === 'online') && `${d.name} ${d.os} ${d.id}`.toLowerCase().includes(search.toLowerCase()));
  $('#list-label').innerHTML = `${filter === 'all' ? t("ALL DEVICES") : t(groupLabel[filter] + 'S')} <span class="muted">/ ${shown.length}</span>`;
  $('#devices-grid').classList.toggle('compact', compact);
  $('#view-toggle').setAttribute('aria-pressed', String(compact));
  $('#view-toggle').setAttribute('aria-label', compact ? t("Switch to card view") : t("Switch to compact view"));
  $('#reset-filters').classList.toggle('hidden', !search && !onlyOnline && filter === 'all');
  $('#filter-summary').textContent = t("{0} of {1} devices", [shown.length, devices.length]);
  const views = shown.map(device => ({ device, selected: selected.includes(device.id), starting: booting.has(device.id), shutting: shuttingDown.has(device.id), debugging: (state.debugSessions || []).some(session => session.deviceId === device.id || session.deviceId === device.flutterId), debugStopping: stoppingDebug.has(device.id) || (state.debugSessions || []).some(session => (session.deviceId === device.id || session.deviceId === device.flutterId) && session.stopping), selectionSaving: targetSaving, showRunRelease: state.settings.framework !== 'react-native' && document.body.dataset.framework !== 'react-native' && device.state === 'online' && !!device.flutterId && !connection && !window.SNAPKIT_CONTROLLER, canRunRelease: device.state === 'online' && !!device.flutterId && !connection && !window.SNAPKIT_CONTROLLER && !!state.settings.workspace && !window.SNAPKIT_PREVIEW }));
  renderDeviceGrid(views, { title: refreshing || state.scanning ? t('Discovering your devices…') : devices.length ? t('No matching devices') : t('Your device lab starts here'), detail: refreshing || state.scanning ? t('Checking Flutter, Android emulators, and iOS simulators. The first scan can take a moment.') : devices.length ? t('Clear the filters to see all your devices.') : t('Add a simulator or emulator, or connect a physical device to get started.'), actions: devices.length ? [{ id: 'empty-reset', label: t('Clear filters') }] : !refreshing && !state.scanning ? [{ id: 'empty-add', label: t('Add device') }, { id: 'empty-refresh', label: t('Refresh devices') }] : [] });
  $('#scan-time').textContent = state.scannedAt ? t("Last synced {0} · Device status checked every 2s", [new Date(state.scannedAt).toLocaleTimeString(window.SnapkitI18n.language === 'vi' ? 'vi-VN' : 'en-GB', { hour: '2-digit', minute: '2-digit' })]) : t("Waiting for first scan");
  $('#ide-use-dashboard').checked = state.settings.ideEnabled !== false;
  $('#ide-use-dashboard').disabled = targetSaving;
  $('#ide-summary').textContent = state.settings.ideEnabled === false ? t("Dashboard targets paused · IDE uses your normal debug configuration.") : targetSaving ? t("Saving device selection…") : unavailable.length ? t("{0} selected · {1} unavailable. Uncheck unavailable devices before debugging.", [selected.length, unavailable.length]) : selected.length ? t("{0} device(s) selected · Press F5 in your editor", [selected.length]) : t("Select one or more started devices, then run Debug in your editor.");
  renderWarnings(); renderProvisionJobs(); icons();
  if (window.SNAPKIT_CONTROLLER) renderConnection();
  document.dispatchEvent(new Event('snapkit:state'));
}
function renderWarnings() {
  $('#warnings').classList.toggle('hidden', !state.warnings.length);
  const open = !!$('#warnings details[open]');
  $('#warnings').innerHTML = state.warnings.length ? `<details ${open ? 'open' : ''}><summary>${t('{0} toolchain {1} — view details', [state.warnings.length, state.warnings.length === 1 ? 'notice' : 'notices'])}</summary>${state.warnings.map(w => `<p>${escape(t(w))}</p>`).join('')}</details>` : '';
}
async function refresh(button = $('#refresh-button')) {
  if (refreshing) return;
  refreshing = true; $('#devices-grid').setAttribute('aria-busy', 'true'); $('#refresh-button svg')?.classList.add('spin');
  await busy(button, async () => { const result = await api('/api/scan', {}); state = { ...state, ...result, scanning: false };  });
  refreshing = false; $('#devices-grid').removeAttribute('aria-busy'); $('#refresh-button svg')?.classList.remove('spin'); render();
}
let workspaceProfiles = [];
let detectedFramework = 'flutter';
let workspaceMismatch = false;
let workspaceDetectionTimer;
const frameworkLabel = framework => framework === 'react-native' ? 'React Native' : framework === 'backend' ? 'Backend' : 'Flutter';
function updateWorkspaceMatch() {
  workspaceMismatch = !!state.settings.spaceId && state.settings.framework !== detectedFramework;
  $('#workspace-mismatch').classList.toggle('hidden', !workspaceMismatch);
  $('#workspace-path').setAttribute('aria-invalid', String(workspaceMismatch));
  if(workspaceMismatch) $('#workspace-mismatch-message').textContent = t('This is a {0} project. The current workspace uses {1}. Create a matching workspace to continue.', [frameworkLabel(detectedFramework), frameworkLabel(state.settings.framework)]);
  $('#workspace-form button[type=submit]').disabled = workspaceMismatch;
}
function workspaceFrameworkUI(framework) {
  detectedFramework = framework;
  $('#flutter-project-fields').classList.toggle('hidden', framework === 'react-native');
  $('#react-native-project-help').classList.toggle('hidden', framework !== 'react-native');
}
let workspaceProfileRequest = 0;
let workspaceProfilePath = '';
async function loadWorkspaceProfiles(restoreSaved = true) {
  clearTimeout(workspaceDetectionTimer);
  const request = ++workspaceProfileRequest;
  const path = $('#workspace-path').value.trim();
  workspaceProfilePath = path;
  workspaceProfiles = [];
  workspaceMismatch = false;
  $('#workspace-mismatch').classList.add('hidden');
  $('#workspace-detection').textContent = path ? t('Detecting project framework…') : '';
  $('#workspace-form button[type=submit]').disabled = !!path;
  $('#workspace-profile').innerHTML = `<option value="">${t("Custom configuration")}</option>`;
  $('#workspace-flavors').innerHTML = '';
  if (!path || window.SNAPKIT_PREVIEW) return;
  try {
    const result = await api('/api/workspace/profiles?path=' + encodeURIComponent(path));
    if (request !== workspaceProfileRequest) return;
    $('#workspace-error').textContent = '';
    workspaceFrameworkUI(result.framework || 'flutter');
    $('#workspace-detection').textContent = t('Detected: {0}', [frameworkLabel(detectedFramework)]);
    updateWorkspaceMatch();
    if (restoreSaved && result.savedSetup && path !== state.settings.workspace) {
      $('#workspace-flavor').value = result.savedSetup.flavor || '';
      $('#workspace-target').value = result.savedSetup.target || 'lib/main.dart';
      $('#workspace-defines').value = result.savedSetup.defineFile || '';
    }
    workspaceProfiles = result.profiles;
    $('#workspace-profile').innerHTML += workspaceProfiles.map((p, i) => `<option value="${i}">${escape(p.name)}</option>`).join('');
    $('#workspace-flavors').innerHTML = result.flavors.map(f => `<option value="${escape(f)}"></option>`).join('');
  } catch (error) { if (request === workspaceProfileRequest) {$('#workspace-detection').textContent = ''; $('#workspace-error').textContent = t(error.message);} }
}
function showWorkspace(draft) {
  const restoring = draft && typeof draft.path === 'string';
  $('#workspace-context').textContent = state.settings.spaceId ? t('Workspace: {0} · {1}', [state.settings.spaceName, frameworkLabel(state.settings.framework)]) : '';
  $('#workspace-path').removeAttribute('aria-invalid');
  workspaceFrameworkUI(document.body.dataset.framework || state.settings.framework || 'flutter');
  $('#workspace-path').value = restoring ? draft.path : state.demo ? '' : (state.settings.workspace || '');
  $('#workspace-flavor').value = restoring ? draft.flavor || '' : state.settings.flavor || '';
  $('#workspace-target').value = restoring ? draft.target || 'lib/main.dart' : state.settings.target || 'lib/main.dart';
  $('#workspace-defines').value = restoring ? draft.defineFile || '' : state.settings.defineFile || '';
  $('#workspace-error').textContent = ''; $('#workspace-dialog').showModal(); loadWorkspaceProfiles(!restoring);
}
$('#workspace-path').addEventListener('input', () => {
  ++workspaceProfileRequest; clearTimeout(workspaceDetectionTimer);
  $('#workspace-form button[type=submit]').disabled = true;
  $('#workspace-mismatch').classList.add('hidden'); $('#workspace-error').textContent = '';
  $('#workspace-detection').textContent = t('Detecting project framework…');
  workspaceDetectionTimer = setTimeout(() => loadWorkspaceProfiles(), 250);
});
$('#create-matching-workspace').addEventListener('click', () => {
  if(!workspaceMismatch || $('#workspace-path').value.trim() !== workspaceProfilePath) return;
  const draft = {path: $('#workspace-path').value.trim(), flavor: $('#workspace-flavor').value.trim(), target: $('#workspace-target').value.trim(), defineFile: $('#workspace-defines').value.trim()};
  $('#workspace-dialog').close();
  document.dispatchEvent(new CustomEvent('snapkit:create-workspace', {detail: {type: detectedFramework, draft}}));
});
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
  if(workspaceMismatch) return;
  busy(button, async () => {
    try { const result = await api('/api/workspace', { path: $('#workspace-path').value.trim(), framework: detectedFramework, flavor: $('#workspace-flavor').value.trim(), target: $('#workspace-target').value.trim(), defineFile: $('#workspace-defines').value.trim() }); state.settings = { ...state.settings, ...result.settings }; await loadState(); $('#workspace-dialog').close(); toast(result.message); }
    catch (error) { $('#workspace-error').textContent = t(error.message); }
  });
});
['#settings-button', '#ide-setup'].forEach(id => $(id).addEventListener('click', showWorkspace));
['#help-button'].forEach(id => $(id).addEventListener('click', () => showProductPage('guide')));
$$('.close-dialog').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));


let targetSaving = false;
async function loadState() {
  const previous = JSON.stringify(state);
  const result = await api('/api/state');
  // A slow state response must not overwrite a newer IDE event. Agent restart
  // changes the local token, so its revision sequence can safely start over.
  if (!window.SNAPKIT_CONTROLLER && result.token === state.token && (result.debugRevision ?? 0) < (state.debugRevision ?? 0)) {
    result.debugSessions = state.debugSessions; result.debugRevision = state.debugRevision;
  }
  state = { ...state, ...result };
  if (!window.SNAPKIT_CONTROLLER || previous !== JSON.stringify(state)) render();
}
function setFilter(value) {
  filter = value;
  $$('[data-filter]').forEach(tab => {
    const active = tab.dataset.filter === value;
    tab.classList.toggle('active', active); tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  render();
}
function resetFilters() {
  search = ''; onlyOnline = false; $('#device-search').value = ''; $('#online-only').checked = false; setFilter('all');
}
$$('[data-filter]').forEach(b => b.addEventListener('click', () => setFilter(b.dataset.filter)));
$('.tabs').addEventListener('keydown', event => {
  const tabs = $$('[data-filter]'); const current = tabs.indexOf(event.target);
  if (current < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  setFilter(tabs[index].dataset.filter); tabs[index].focus();
});
$('#reset-filters').addEventListener('click', resetFilters);
$('#view-toggle').addEventListener('click', () => { compact = !compact; localStorage.setItem('snapkit-view', compact ? 'compact' : 'cards'); render(); });
$('#device-search').addEventListener('input', e => { search = e.target.value; render(); });
$('#online-only').addEventListener('change', e => { onlyOnline = e.target.checked; render(); });
$('#refresh-button').addEventListener('click', () => refresh());
$('#devices-grid').addEventListener('click', e => {
  if (e.target.closest('#empty-reset')) { resetFilters(); $('#device-search').focus(); return; }
  if (e.target.closest('#empty-add')) return $('#add-device').click();
  if (e.target.closest('#empty-refresh')) return refresh();
  if (e.target.closest('#empty-help')) return showProductPage('guide');
  const remove = e.target.closest('button[data-action="delete"]');
  if (remove && !remove.disabled) {
    const id = remove.closest('[data-device]').dataset.device;
    const d = state.devices.find(item => item.id === id);
    if (!d) return;
    $('#delete-device-form').dataset.device = id;
    $('#delete-device-name').textContent = d.name;
    $('#delete-device-note').textContent = t("{0}All installed apps, settings, snapshots and local device data will be permanently removed. This cannot be undone. Shared OS runtimes and your project files will be kept.{1}", [d.state === 'online' ? t("This device will be stopped. Any running app/debug session on it will disconnect. ") : '', state.settings.targetIds.includes(id) ? t(" It will also be removed from the IDE selection.") : '']);
    $('#delete-device-error').textContent = '';
    $('#delete-device-dialog').showModal();
    return;
  }
  const b = e.target.closest('button[data-action]'); if (!b || b.disabled || !['boot', 'shutdown', 'stop-debug'].includes(b.dataset.action)) return;
  const id = b.closest('[data-device]').dataset.device, action = b.dataset.action;
  if (booting.has(id) || shuttingDown.has(id) || stoppingDebug.has(id)) return;
  const pending = action === 'boot' ? booting : action === 'shutdown' ? shuttingDown : stoppingDebug;
  pending.add(id); render();
  busy(null, async () => {
    try { const result = await api(`/api/devices/${encodeURIComponent(id)}/${action}`, {}); toast(result.message); await loadState(); }
    finally { pending.delete(id); render(); }
  });
});
let deletingDevice = false;
$('#delete-device-dialog').addEventListener('cancel', event => { if (deletingDevice) event.preventDefault(); });
$('#delete-device-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (deletingDevice) return;
  deletingDevice = true;
  const id = event.currentTarget.dataset.device;
  const dialog = $('#delete-device-dialog');
  dialog.querySelectorAll('button').forEach(button => { button.disabled = true; });
  $('#delete-device-submit').setAttribute('aria-busy', 'true');
  $('#delete-device-error').textContent = '';
  try {
    const result = await api(`/api/devices/${encodeURIComponent(id)}/delete`, { confirm: id });
    dialog.close(); toast(result.message);
    if (result.warning) toast(result.warning, true);
    await loadState();
  } catch (error) { $('#delete-device-error').textContent = t(error.message); }
  finally {
    deletingDevice = false;
    dialog.querySelectorAll('button').forEach(button => { button.disabled = false; });
    $('#delete-device-submit').removeAttribute('aria-busy');
  }
});
$('#ide-use-dashboard').addEventListener('change', async event => {
  const enabled = event.target.checked;
  const previous = state.settings.ideEnabled;
  state.settings = { ...state.settings, ideEnabled: enabled };
  targetSaving = true; render();
  try { const result = await api('/api/ide/mode', { enabled }); state.settings = result.settings; toast(result.message); }
  catch (error) { state.settings = { ...state.settings, ideEnabled: previous }; toast(error.message, true); }
  finally { targetSaving = false; render(); }
});
$('#devices-grid').addEventListener('change', async e => {
  const box = e.target.closest('[data-action="select"]'); if (!box || targetSaving) return;
  if (!state.settings.workspace) { box.checked = false; showWorkspace(); return; }
  const id = box.closest('[data-device]').dataset.device;
  const previousIds = [...(state.settings.targetIds || [])];
  const ids = new Set(previousIds);
  box.checked ? ids.add(id) : ids.delete(id);
  state.settings = { ...state.settings, targetIds: [...ids] };
  targetSaving = true; render();
  try { const result = await api('/api/targets', { ids: [...ids] }); state.settings = result.settings; toast(result.message); }
  catch (error) { state.settings = { ...state.settings, targetIds: previousIds }; toast(error.message, true); }
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
    if (state.authRequired) return;
    if (window.SNAPKIT_PREVIEW) {
      $('#server-status').textContent = t("Static preview · sample data");
      $('#mode-badge').textContent = t("READ-ONLY PREVIEW");
      $('#demo-notice span').textContent = t("Read-only preview · Sample devices. Start Snapkit locally to create and start real devices.");
      return;
    }
    $('#connection-button').classList.toggle('hidden', !!window.snapkitDesktop);
    const events = new EventSource('/api/events');
    events.addEventListener('devices', e => { state = { ...state, ...JSON.parse(e.data), scanning: false }; render(); });
    events.addEventListener('jobs', e => {
      const jobs = JSON.parse(e.data);
      const changed = jobs.filter(job => state.jobs?.some(old => old.id === job.id && old.status === 'running') && job.status !== 'running');
      state.jobs = jobs; renderProvisionJobs();
      for (const job of changed) toast(job.status === 'error' ? `${job.title}: ${job.error}` : t("{0} completed", [job.title]), job.status === 'error');
      if (changed.some(job => job.status === 'completed')) document.dispatchEvent(new Event('snapkit:review-success'));
      if (changed.length) { creationCatalogs.clear(); if ($('#create-dialog').open) loadCreationCatalog(); }
    });
    events.addEventListener('debug', e => { const update = JSON.parse(e.data); if ((update.debugRevision ?? 0) < (state.debugRevision ?? 0)) return; state.debugSessions = update.debugSessions; state.debugRevision = update.debugRevision; render(); });
    events.addEventListener('settings', e => { state.settings = { ...state.settings, ...JSON.parse(e.data) }; render(); });
    events.onopen = () => { setConnectionStatus('online'); $('#server-status').textContent = t("Local server connected"); loadState().catch(() => {}); };
    events.onerror = () => { setConnectionStatus('offline'); $('#host-label').textContent = t("Reconnecting · showing last sync"); $('#server-status').textContent = t("Reconnecting to server…"); };
    if (state.scanning) setTimeout(() => loadState().catch(() => {}), 5000);
  } catch (error) { setConnectionStatus('offline'); $('#host-label').textContent = t("Local agent unavailable"); renderDeviceGrid([], { title: t('Local server unavailable'), detail: t('Start Snapkit with npm start, then refresh this page.'), icon: 'wifi-off' }); icons(); toast(t("Cannot connect to local server: {0}", [error.message]), true); $('#server-status').textContent = t("Local server unavailable"); }
}
const showProductPage = page => document.dispatchEvent(new CustomEvent('snapkit:navigate', { detail: page }));
function setConnectionStatus(status) {
  document.body.dataset.connection = status;
}
function renderConnection() {
  $('#connection-button').classList.remove('hidden');
  $('#connection-button').textContent = connection ? t("Connection settings") : t("Connect local server");
  $('#demo-notice').classList.remove('hidden');
  $('#demo-notice span').textContent = !connection ? t("Connect Snapkit running on this computer to control real devices. No sample devices are loaded.") : remoteOffline ? t("Cannot reach the local server. Keep npm start running and check browser local network permission.") : state.demo ? t("Connected to a local DEMO backend. Actions are simulated.") : t("Connected to your local Snapkit server. Device commands run on this computer.");
  $('#mode-badge').textContent = connection ? remoteOffline ? t("AGENT OFFLINE") : state.demo ? t("LOCAL DEMO BACKEND") : t("CONNECTED TO LOCAL AGENT") : t("NOT CONNECTED");
  $('#server-status').textContent = connection ? remoteOffline ? t("Local server unavailable") : t("Connected · {0}", [connection.base]) : t("Local server not connected");
  setConnectionStatus(!connection || remoteOffline ? 'offline' : 'online');
  $('#host-label').textContent = !connection ? t("No local agent connected") : remoteOffline ? t("Local agent unavailable · showing last sync") : t("Connected to {0}", [state.host || t("local agent")]);
  if (!connection) { renderDeviceGrid([], { title: t('Connect your local device lab'), detail: t('Start Snapkit with npm start, then click Connect local server and enter a code from your local Dashboard.'), icon: 'link' }); }
}
function forgetConnection() {
  clearInterval(remotePoll); remotePoll = null; connection = null; remoteOffline = false;
  sessionStorage.removeItem('snapkit-connection');
  state = { devices: [], settings: { targetIds: [] }, warnings: [], jobs: [] };
  render();
}
function startRemotePolling() {
  clearInterval(remotePoll);
  remotePoll = setInterval(pollRemoteState, 2000);
}
async function pollRemoteState() {
  if (remotePolling || !connection || document.hidden) return;
  remotePolling = true;
  const previousJobs = state.jobs || [];
  try {
    await loadState(); remoteOffline = false; renderConnection();
    const finished = (state.jobs || []).filter(j => j.status !== 'running' && previousJobs.some(old => old.id === j.id && old.status === 'running'));
    if (finished.length) { creationCatalogs.clear(); if ($('#create-dialog').open) await loadCreationCatalog(); }
  } catch { remoteOffline = true; renderConnection(); }
  finally { remotePolling = false; }
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && window.SNAPKIT_CONTROLLER && connection) pollRemoteState();
});
async function connectController(base, code) {
  base = agentURL(base);
  let response;
  try { response = await fetch(base + '/api/pairing/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', body: JSON.stringify({ code: code.trim() }) }); }
  catch { throw new Error(t("Cannot reach Snapkit. Run npm start, open the local Dashboard, and allow local network access for this website when your browser asks.")); }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || t("Pairing failed"));
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
    catch (error) { showPairing(); $('#pairing-error').textContent = t(error.message); }
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
  if (window.SNAPKIT_PREVIEW) return;
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
  } catch (error) { $('#pairing-error').textContent = t(error.message); }
}
$('#connection-button').addEventListener('click', () => {
  showPairing();
});
$('#pairing-form').addEventListener('submit', e => {
  e.preventDefault(); $('#pairing-error').textContent = '';
  busy($('#pairing-submit'), async () => {
    try { await connectController($('#agent-url').value, $('#agent-code').value); }
    catch (error) { $('#pairing-error').textContent = t(error.message); }
  });
});
$('#disconnect-agent').addEventListener('click', async () => {
  try { if (connection) await api('/api/pairing/revoke', {}); }
  catch { /* The local browser disconnects even if the agent is offline. */ }
  finally { forgetConnection(); $('#agent-code').value = ''; $('#pairing-dialog').close(); }
});
$('#revoke-connections').addEventListener('click', e => busy(e.currentTarget, async () => {
  const result = await api('/api/pairing/revoke', {});
  $('#pairing-code').textContent = t("Connections revoked"); $('#pairing-link').removeAttribute('href'); toast(result.message);
}));

$('#browse-workspace').addEventListener('click', e => busy(e.currentTarget, async () => {
  $('#workspace-error').textContent = '';
  try {
    const result = await api('/api/folders/pick', {});
    if (result.path) { $('#workspace-path').value = result.path; $('#workspace-path').focus(); $('#workspace-path').dispatchEvent(new Event('change')); }
  } catch (error) { $('#workspace-error').textContent = t(error.message); }
}));

let creationCatalog = null, creationPlatform = 'ios', creationNameEdited = false, catalogLoading = false;
const creationCatalogs = new Map(), catalogRequests = new Map();
let catalogView = 0;
let iosDownloadCatalog = null, iosDownloadModelId = null;
const iosVersionCode = value => /^\d{1,2}\.\d{1,2}(\.\d{1,2})?$/.test(value || '') ? value.split('.').reduce((n, part, i) => n + Number(part) * [65536, 256, 1][i], 0) : null;
function iosDownloadError() {
  const model = selectedCreationModel(), code = iosVersionCode($('#ios-download-version').value.trim());
  if (!model || model.unsupported) return t("This model cannot be enabled by downloading an iOS runtime in this Xcode.");
  if (code === null) return t("Choose an Apple-listed version, or enter an iOS version manually.");
  if (code < (model.minRuntimeVersion ?? 0) || code > (model.maxRuntimeVersion ?? 4294967295)) return t("This iOS version is outside the model’s supported range.");
  return '';
}
function renderIOSDownloads() {
  if (creationPlatform !== 'ios') return;
  const model = selectedCreationModel();
  const changed = iosDownloadModelId !== model?.id; iosDownloadModelId = model?.id;
  const blocked = !model || model.unsupported;
  $('#ios-model-help').textContent = blocked ? (model?.reason || t("Choose a device model first.")) :
    `${model.name}${model.minVersion ? t(" needs iOS {0}{1}", [model.minVersion, model.maxVersion ? `–${model.maxVersion}` : t(" or later")]) : t(" uses runtimes supported by Xcode")}. ${model.runtimeIds.length ? t("Install another version below if needed.") : t("No compatible runtime is installed. Load Apple versions below or open Xcode → Settings → Components.")}`;
  $('#load-ios-versions').disabled = blocked;
  $('#use-supported-ios').classList.toggle('hidden', !blocked);
  const choices = (iosDownloadCatalog || []).filter(r => !blocked && iosVersionCode(r.version) >= (model.minRuntimeVersion ?? 0) && iosVersionCode(r.version) <= (model.maxRuntimeVersion ?? 4294967295));
  const previous = $('#ios-download-choice').value;
  $('#ios-download-choice').innerHTML = choices.length ? choices.map(r => `<option value="${escape(r.version)}">${escape(r.name)}${r.bytes ? ` · ${(r.bytes / 1073741824).toFixed(1)} GB` : ''}${r.authentication ? t(" · Apple account may be required") : ''}</option>`).join('') : `<option value="">${blocked ? t("Unsupported model in this Xcode") : iosDownloadCatalog ? t("No Apple-listed version matches this model and host") : t("Load Apple iOS versions first")}</option>`;
  $('#ios-download-choice').disabled = !choices.length;
  if (!changed && choices.some(r => r.version === previous)) $('#ios-download-choice').value = previous;
  if (changed || !$('#ios-download-version').value) $('#ios-download-version').value = choices[0]?.version || '';
  $('#ios-download-version').disabled = blocked;
  $('#ios-download-path').textContent = state.storage?.downloads || t("configured SSD downloads directory");
  if (model && !model.runtimeIds.length) $('#runtime-downloads').open = true;
  $('#ios-download-validation').textContent = iosDownloadError();
}
function renderProvisionJobs() {
  const openJobs = new Set($$('#provision-jobs details[open]').map(d => d.closest('[data-job]').dataset.job));
  const jobs = (state.jobs || []).slice(-3).reverse();
  if (jobs.some(j => j.status === 'running')) $('.setup-history').open = true;
  $('#provision-jobs').classList.toggle('hidden', !jobs.length);
  $('#provision-jobs').innerHTML = jobs.map(job => `<article class="provision-job" data-job="${escape(job.id)}"><div class="job-heading">${icon(job.status === 'running' ? 'loader-circle' : job.status === 'error' ? 'circle-alert' : 'circle-check')}<strong>${escape(job.title)}</strong><span class="status-badge ${job.status === 'completed' ? 'online' : ''}">${escape(t(job.status))}</span></div>${job.error ? `<p class="job-error">${escape(job.error)}</p>` : ''}${job.result?.path ? `<p class="job-path">${escape(job.result.path)}</p>` : ''}${job.result?.message ? `<p class="job-path">${escape(t(job.result.message))}</p>` : ''}${job.logs?.length ? `<details ${openJobs.has(job.id) ? 'open' : ''}><summary>${t("Setup output")}</summary><pre>${escape(job.logs.join('\n'))}</pre></details>` : ''}</article>`).join('');
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
  toast(job.status === 'completed' ? job.title : t("{0} started. Progress appears below the device list.", [job.title]));
}
function selectedCreationModel() { return creationCatalog?.[creationPlatform]?.models.find(m => m.id === $('#create-model').value); }
function selectedCreationRuntime() {
  const options = creationPlatform === 'ios' ? creationCatalog?.ios.runtimes : creationCatalog?.android.images;
  return options?.find(r => r.id === $('#create-runtime').value);
}
function updateCreateAvailability() {
  for (const id of ['create-model', 'create-runtime', 'load-android-versions']) $('#' + id).disabled = !creationCatalog || catalogLoading;
  if (!creationCatalog) {
    for (const id of ['create-device-submit', 'install-android-image', 'download-ios-runtime', 'import-ios-runtime', 'load-ios-versions']) $('#' + id).disabled = true;
    return;
  }
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
  $('#create-runtime').innerHTML = versions.length ? versions.map(r => `<option value="${escape(r.id)}">${escape(r.name)}${creationPlatform === 'android' ? r.installed ? t(" — Installed") : t(" — Download required") : t(" — Installed")}</option>`).join('') : `<option value="">${t("No compatible installed runtime")}</option>`;
  if (versions.some(r => r.id === keep)) $('#create-runtime').value = keep;
  else if (creationPlatform === 'android' && versions.some(r => r.installed)) $('#create-runtime').value = versions.find(r => r.installed).id;
  renderCompatibility(); updateCreationName();
}
function renderCompatibility() {
  const model = selectedCreationModel(), runtime = selectedCreationRuntime();
  const note = $('#compatibility-note'); let unavailable = !runtime;
  if (!model) note.textContent = t("No model matches your search. Try a different name.");
  else if (!runtime) note.textContent = model.reason || t("No compatible version is available. Load downloadable Android versions or install a supported iOS runtime.");
  else if (creationPlatform === 'android' && !runtime.installed) { note.textContent = t("Download this system image first. Once installed, you can create the device."); unavailable = true; }
  else note.textContent = creationPlatform === 'ios' ? t("Compatible model + runtime provided by your Xcode installation.") : t("System image matches this hardware profile and your computer’s CPU architecture.");
  if (creationPlatform === 'ios' && !state.demo && !state.storage?.iosReady) { note.textContent += t(" iOS device storage is unavailable. Check the configured CoreSimulator directory."); unavailable = true; }
  if (creationPlatform === 'ios' && !state.demo && state.iosAccess?.blocked) { note.textContent = t(state.iosAccess.reason); unavailable = true; }
  note.classList.toggle('unavailable', unavailable);
  $('#install-android-image').classList.toggle('hidden', creationPlatform !== 'android' || !runtime || runtime.installed);
  renderIOSDownloads();
  updateCreateAvailability();
}
function renderCreationModels(keepModel = '', keepRuntime = '') {
  if (!creationCatalog) return;
  const query = $('#model-search').value.toLowerCase().replace(/\s/g, '');
  const models = creationCatalog[creationPlatform].models.filter(m => m.name.toLowerCase().replace(/\s/g, '').includes(query));
  $('#create-model').innerHTML = models.length ? models.map(m => `<option value="${escape(m.id)}">${escape(m.name)}${m.unsupported ? t(" — Not supported by this toolchain") : ''}</option>`).join('') : `<option value="">${t("No matching models")}</option>`;
  if (models.some(m => m.id === keepModel)) $('#create-model').value = keepModel;
  renderCreationRuntimes(keepRuntime);
}
function setCreationPlatform(platform) {
  creationPlatform = platform; creationNameEdited = false; $('#model-search').value = ''; $('#create-error').textContent = '';
  $$('[data-create-platform]').forEach(b => { b.classList.toggle('active', b.dataset.createPlatform === platform); b.setAttribute('aria-pressed', String(b.dataset.createPlatform === platform)); });
  $('#ios-download-tools').classList.toggle('hidden', platform !== 'ios'); $('#android-download-tools').classList.toggle('hidden', platform !== 'android');
  $('#create-storage-path').textContent = (platform === 'ios' ? state.storage?.iosDevices : state.storage?.avd) || t("SSD device storage");
  $('#create-storage-label').textContent = platform === 'ios' && state.storage?.iosOnSSD === false ? t("iOS DATA ON INTERNAL DISK") : t("DEVICE DATA LOCATION");
  creationCatalog = creationCatalogs.get(platform)?.value || null;
  renderCreationModels(); icons();
  loadCreationCatalog(false, true);
}
async function loadCreationCatalog(remote = false, reuse = false) {
  const platform = creationPlatform, view = ++catalogView;
  const cached = creationCatalogs.get(platform);
  creationCatalog = cached?.value || null;
  catalogLoading = !(reuse && cached && Date.now() - cached.time < 60000);
  $('#create-form').classList.remove('hidden');
  $('#create-loading').classList.toggle('hidden', !catalogLoading);
  $('#create-loading').textContent = remote ? t("Loading downloadable Android versions from the SDK repository…") : t("Reading your installed models and OS versions…");
  $('#create-error').textContent = '';
  if (!creationCatalog) {
    for (const id of ['create-model', 'create-runtime']) $('#' + id).innerHTML = `<option value="">${t("Reading your installed models and OS versions…")}</option>`;
    $('#compatibility-note').textContent = '';
    if (!creationNameEdited) $('#create-name').value = '';
    if (platform === 'ios') renderIOSDownloads();
    $('#catalog-warnings').textContent = '';
    $('#install-android-image').classList.add('hidden');
  }
  updateCreateAvailability();
  try {
    if (catalogLoading) {
      const key = `${platform}:${remote}`;
      if (!catalogRequests.has(key)) {
        const request = api(`/api/provision/catalog?platform=${platform}${remote ? '&remote=1' : ''}`)
          .then(value => { creationCatalogs.set(platform, { value, time: Date.now() }); return value; })
          .finally(() => catalogRequests.delete(key));
        catalogRequests.set(key, request);
      }
      const value = await catalogRequests.get(key);
      if (view !== catalogView) return;
      creationCatalog = value;
    }
    $('#catalog-warnings').textContent = creationCatalog.warnings.join('\n');
    const previousFile = $('#ios-runtime-file').value;
    $('#ios-runtime-file').innerHTML = creationCatalog.downloads.length ? creationCatalog.downloads.map(f => `<option value="${escape(f)}">${escape(f)}</option>`).join('') : `<option value="">${t("No downloaded runtime DMGs")}</option>`;
    if (creationCatalog.downloads.includes(previousFile)) $('#ios-runtime-file').value = previousFile;
    renderCreationModels($('#create-model').value, $('#create-runtime').value);
  } catch (e) {
    if (view === catalogView) { $('#create-error').textContent = t(e.message); $('#runtime-downloads').open = true; }
  }
  finally {
    if (view === catalogView) { catalogLoading = false; $('#create-loading').classList.add('hidden'); updateCreateAvailability(); }
  }
}
$('#add-device').addEventListener('click', () => {
  creationNameEdited = false;
  $('#create-form').classList.remove('hidden'); $('#create-dialog').showModal();
  $$('[data-create-platform]').forEach(b => b.disabled = b.dataset.createPlatform === 'ios' && state.platform !== 'darwin');
  setCreationPlatform(state.platform === 'darwin' ? 'ios' : 'android');
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
    } catch (error) { $('#create-error').textContent = t(error.message); }
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
  } catch (error) { $('#ios-model-help').textContent = t("{0}. You can open Xcode Components or enter a version manually.", [error.message]); throw error; }
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

document.addEventListener('snapkit:language', () => {
  render();
  if (creationCatalog) {
    const model = $('#create-model').value, runtime = $('#create-runtime').value;
    renderCreationModels(model, runtime);
    $('#create-storage-label').textContent = t(creationPlatform === 'ios' && state.storage?.iosOnSSD === false ? 'iOS DATA ON INTERNAL DISK' : 'DEVICE DATA LOCATION');
  }
});

export { t, $, $$, escape, icon, icons, busy, api, toast, state, connection, render, showWorkspace, loadState, init };

document.addEventListener('snapkit:profile', () => render());
