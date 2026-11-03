/* Project tools use the authenticated local agent, including paired website sessions. */
let deviceToolsState = { sets: [], jobs: [], captures: [], recordings: [] }, toolsLoading = false;
let editingSetId = '';
let logLines = [], logCursor = 0, logDeviceId = '', logClearedAt = 0, logPolling = false;
const mediaURLs = new Map();
const toolText = value => escape(t(value));
function supportedDevices() { return state.devices.filter(d => d.state === 'online' && (d.platform === 'android' || (d.group === 'ios' && (state.platform === 'darwin' || state.demo || window.SNAPKIT_PREVIEW)))); }
function renderToolDevices() {
  const fingerprint = JSON.stringify([state.devices.map(d => [d.id, d.name, d.state]), state.settings.workspace, window.SnapkitI18n.language]); if (renderToolDevices.last === fingerprint) return; renderToolDevices.last = fingerprint;
  if (renderToolDevices.workspace !== state.settings.workspace) { editingSetId = ''; $('#set-name').value = ''; renderToolDevices.workspace = state.settings.workspace; }
  const devices = supportedDevices();
  for (const select of $$('.tool-device-picker')) {
    const chosen = select.value;
    select.innerHTML = devices.length ? devices.map(d => `<option value="${escape(d.id)}">${escape(d.name)}</option>`).join('') : `<option value="">${toolText('No supported device online')}</option>`;
    if (devices.some(d => d.id === chosen)) select.value = chosen;
  }
  $$('.tool-project').forEach(node => { node.textContent = state.settings.workspace || t('Choose a project to save device sets and captures.'); });
  const picked = new Set($$('#set-devices input:checked').map(x => x.value));
  $('#set-devices').innerHTML = `<legend>${toolText('Devices in this set')}</legend>` + (state.devices.length ? state.devices.map(d => `<label><input type="checkbox" value="${escape(d.id)}" ${picked.has(d.id) ? 'checked' : ''}>${escape(d.name)} <small>· ${toolText(d.state === 'online' ? 'Online' : 'Offline')}</small></label>`).join('') : `<p>${toolText('Add or connect a device first.')}</p>`);
}
function renderSets() {
  $('#set-list').innerHTML = deviceToolsState.sets.length ? deviceToolsState.sets.map(set => `<article class="tool-card"><h2>${escape(set.name)}</h2><p>${set.deviceIds.map(id => escape(state.devices.find(d => d.id === id)?.name || t('Missing device'))).join(' · ')}</p><div class="tool-buttons"><button class="button primary" data-set-start="${set.id}">${icon('play')}${toolText('Start set')}</button><button class="button" data-set-select="${set.id}">${toolText('Select ready devices for IDE')}</button><button class="button" data-set-edit="${set.id}">${toolText('Edit set')}</button><button class="button" data-set-delete="${set.id}">${toolText('Delete set')}</button></div></article>`).join('') : `<div class="tool-empty">${toolText('No device sets yet. Save the devices you use together for this project.')}</div>`;
  const statuses = { waiting: 'Waiting', starting: 'Starting…', ready: 'Ready', missing: 'Missing device', connect: 'Connect phone first', busy: 'Device is busy', timeout: 'Still starting — refresh Devices', failed: 'Failed' };
  $('#set-jobs').innerHTML = deviceToolsState.jobs.slice(-5).reverse().map(job => `<article class="tool-card"><h2>${escape(job.name)} · ${toolText(job.status === 'running' ? 'Starting…' : 'Finished')}</h2>${job.devices.map(d => `<div class="tool-job-row"><span>${escape(d.name || state.devices.find(x => x.id === d.id)?.name || d.id)}</span><span>${toolText(statuses[d.status] || d.status)}${d.error ? ` · ${escape(d.error)}` : ''}</span></div>`).join('')}</article>`).join(''); icons();
}
function releaseMedia() { for (const url of mediaURLs.values()) URL.revokeObjectURL(url); mediaURLs.clear(); }
async function fileBlob(id) {
  const url = `/api/tools/captures/${encodeURIComponent(id)}/file`;
  const response = await fetch(connection ? connection.base + url : url, { headers: connection ? { Authorization: `Bearer ${connection.token}` } : {}, credentials: 'omit', signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(t('Could not load capture. Refresh and try again.'));
  return response.blob();
}
function saveBlob(blob, name) { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
function renderCaptures() {
  $('#capture-recordings').innerHTML = deviceToolsState.recordings.map(x => `<article class="tool-card"><h2>${escape(x.deviceName)}</h2><p>${toolText(x.status === 'recording' ? 'Recording · stops automatically after 3 minutes' : 'Finalizing video…')}</p>${x.status === 'recording' ? `<button class="button danger" data-record-stop="${x.id}">${icon('square')}${toolText('Stop recording')}</button>` : ''}</article>`).join('');
  const fingerprint = JSON.stringify(deviceToolsState.captures) + window.SnapkitI18n.language;
  if ($('#capture-list').dataset.content === fingerprint) { icons(); return; }
  $('#capture-list').dataset.content = fingerprint; releaseMedia();
  $('#capture-list').innerHTML = deviceToolsState.captures.length ? deviceToolsState.captures.map(x => `<article class="tool-card capture-card"><h2>${escape(x.deviceName)}</h2><p>${toolText(x.kind === 'image' ? 'Screenshot' : 'Screen recording')}</p><time>${escape(new Date(x.createdAt).toLocaleString(window.SnapkitI18n.language === 'vi' ? 'vi-VN' : 'en-GB'))}</time>${x.status === 'ready' ? `<div data-media="${x.id}"></div><div class="tool-buttons"><button class="button" data-capture-preview="${x.id}">${toolText('Preview')}</button><button class="button" data-capture-download="${x.id}">${icon('download')}${toolText('Download')}</button>` : `<p role="status">${toolText('Capture failed')}: ${toolText(x.error || '')}</p><div class="tool-buttons">`}<button class="button" data-capture-delete="${x.id}">${toolText('Delete capture')}</button></div></article>`).join('') : `<div class="tool-empty">${toolText('No captures for this project yet. Take a screenshot to get started.')}</div>`;
  icons();
}
async function refreshDeviceTools() {
  if (toolsLoading) return;
  toolsLoading = true;
  try { const workspace = state.settings.workspace, result = await api('/api/tools'); if (workspace !== state.settings.workspace) return; deviceToolsState = result; renderSets(); renderCaptures(); }
  finally { toolsLoading = false; }
}
$('#set-form').addEventListener('submit', event => { event.preventDefault(); busy($('#set-form button[type=submit]'), async () => {
  await api('/api/tools/sets/save', { id: editingSetId || undefined, name: $('#set-name').value, deviceIds: $$('#set-devices input:checked').map(x => x.value) }); $('#set-name').value = ''; editingSetId = ''; toast('Device set saved'); await refreshDeviceTools();
}); });
$('#panel-sets').addEventListener('click', event => {
  const button = event.target.closest('[data-set-start],[data-set-delete],[data-set-select],[data-set-edit]'); if (!button) return;
  busy(button, async () => {
    if (button.dataset.setEdit) { const set = deviceToolsState.sets.find(x => x.id === button.dataset.setEdit); editingSetId = set.id; $('#set-name').value = set.name; $$('#set-devices input').forEach(input => { input.checked = set.deviceIds.includes(input.value); }); $('#set-name').focus(); toast('Edit the name or devices, then save'); }
    if (button.dataset.setStart) { await api(`/api/tools/sets/${button.dataset.setStart}/start`, {}); await refreshDeviceTools(); }
    if (button.dataset.setDelete && confirm(t('Delete this saved set? Your devices and their data are kept.'))) { await api(`/api/tools/sets/${button.dataset.setDelete}/delete`, {}); await refreshDeviceTools(); }
    if (button.dataset.setSelect) {
      const set = deviceToolsState.sets.find(x => x.id === button.dataset.setSelect), targetIds = set.deviceIds.filter(id => state.devices.some(d => d.id === id && d.state === 'online' && d.flutterId));
      if (!targetIds.length) throw new Error(t('Start a device in this set first.'));
      const result = await api('/api/targets', { ids: targetIds }); state.settings = result.settings; render(); toast('Ready devices selected for the next IDE debug run');
    }
  });
});
function filteredLogLines() { const text = $('#log-search').value.toLocaleLowerCase(), level = $('#log-level').value; return logLines.filter(line => line.id > logClearedAt && (!text || line.text.toLocaleLowerCase().includes(text)) && (level === 'all' || (level === 'error' ? /\bE\b|error|fatal|fault/i : /\b[WEF]\b|warn|error|fatal|fault/i).test(line.text))); }
function renderLogLines() { const output = $('#log-output'); output.textContent = filteredLogLines().map(line => line.text).join('\n'); if ($('#log-follow').checked) output.scrollTop = output.scrollHeight; }
async function pollLogs() {
  if (!logDeviceId || logPolling || activePage !== 'logs' || document.hidden) return;
  logPolling = true;
  try { const id = logDeviceId, result = await api(`/api/tools/logs/${encodeURIComponent(id)}?after=${logCursor}`); if (id !== logDeviceId) return;
    logCursor = Math.max(logCursor, result.next - 1); logLines = [...logLines, ...result.lines].slice(-1000);
    $('#log-status').textContent = t(result.status === 'running' ? 'Streaming' : result.status === 'failed' ? 'Failed' : 'Stopped');
    $('#log-detail').textContent = result.detail || (result.truncated ? t('Older lines were discarded to keep the viewer responsive.') : '');
    $('#log-stop').disabled = result.status !== 'running'; if ($('#log-follow').checked) renderLogLines();
  } catch (e) { $('#log-detail').textContent = e.message; } finally { logPolling = false; }
}
$('#log-start').addEventListener('click', event => busy(event.currentTarget, async () => {
  const id = $('#log-device').value; if (!id) throw new Error(t('No supported device online'));
  if (logDeviceId && logDeviceId !== id) await api(`/api/tools/logs/${encodeURIComponent(logDeviceId)}/stop`, {});
  await api(`/api/tools/logs/${encodeURIComponent(id)}/start`, {}); logDeviceId = id; logLines = []; logCursor = 0; logClearedAt = 0; await pollLogs();
}));
$('#log-stop').addEventListener('click', event => busy(event.currentTarget, async () => { if (logDeviceId) await api(`/api/tools/logs/${encodeURIComponent(logDeviceId)}/stop`, {}); await pollLogs(); }));
$('#log-device').addEventListener('change', () => { $('#log-detail').textContent = t('Press Start logs to switch to the selected device.'); });
$('#log-search').addEventListener('input', renderLogLines); $('#log-level').addEventListener('change', renderLogLines); $('#log-follow').addEventListener('change', renderLogLines);
$('#log-clear').addEventListener('click', () => { logClearedAt = logCursor; renderLogLines(); });
$('#log-export').addEventListener('click', () => { saveBlob(new Blob([filteredLogLines().map(x => x.text).join('\n')], { type: 'text/plain;charset=utf-8' }), `Snapkit-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`); });
$('#capture-shot').addEventListener('click', event => busy(event.currentTarget, () => captureAction('screenshot')));
$('#capture-record').addEventListener('click', event => busy(event.currentTarget, () => captureAction('record')));
async function captureAction(action, id = $('#capture-device').value) {
  if (!id) throw new Error(t('No supported device online'));
  await api(`/api/tools/captures/${encodeURIComponent(id)}/${action}`, {}); toast(action === 'screenshot' ? 'Screenshot saved' : 'Recording started'); await refreshDeviceTools();
}
$('#capture-refresh').addEventListener('click', event => busy(event.currentTarget, refreshDeviceTools));
$('#panel-captures').addEventListener('click', event => {
  const button = event.target.closest('[data-record-stop],[data-capture-delete],[data-capture-download],[data-capture-preview]'); if (!button) return;
  busy(button, async () => {
    if (button.dataset.recordStop) { await api(`/api/tools/recordings/${button.dataset.recordStop}/stop`, {}); await refreshDeviceTools(); }
    const id = button.dataset.captureDelete || button.dataset.captureDownload || button.dataset.capturePreview;
    if (!id) return;
    const capture = deviceToolsState.captures.find(x => x.id === id); if (!capture) return;
    if (button.dataset.captureDelete) { if (!confirm(t('Delete this capture permanently from Snapkit?'))) return; await api(`/api/tools/captures/${id}/delete`, {}); await refreshDeviceTools(); return; }
    const blob = await fileBlob(id);
    if (button.dataset.captureDownload) { saveBlob(blob, `Snapkit-${capture.createdAt.replace(/[:.]/g, '-')}.${capture.kind === 'image' ? 'png' : 'mp4'}`); return; }
    const node = $(`[data-media="${id}"]`); if (!node) return;
    if (mediaURLs.has(id)) URL.revokeObjectURL(mediaURLs.get(id)); const url = URL.createObjectURL(blob); mediaURLs.set(id, url);
    const media = document.createElement(capture.kind === 'image' ? 'img' : 'video'); media.src = url; if (capture.kind === 'image') media.alt = capture.deviceName; else { media.controls = true; media.preload = 'metadata'; } node.replaceChildren(media);
  });
});
$('#devices-grid').addEventListener('click', event => {
  const button = event.target.closest('[data-tool-action]'); if (!button) return;
  const id = button.closest('[data-device]').dataset.device;
  if (button.dataset.toolAction === 'logs') { showProductPage('logs'); $('#log-device').value = id; $('#log-start').click(); }
  else { showProductPage('captures'); $('#capture-device').value = id; busy(button, () => captureAction(button.dataset.toolAction === 'record' ? 'record' : 'screenshot', id)); }
});
$$('[data-open-project]').forEach(button => button.addEventListener('click', showWorkspace));
document.addEventListener('snapkit:page', event => { if (['sets', 'logs', 'captures'].includes(event.detail)) { renderToolDevices(); refreshDeviceTools().catch(error => toast(error.message, true)); } if (event.detail !== 'captures') releaseMedia(); });
document.addEventListener('snapkit:state', renderToolDevices);
document.addEventListener('snapkit:language', () => { renderToolDevices(); renderSets(); renderCaptures(); renderLogLines(); });
setInterval(() => { if (!document.hidden && ['sets', 'captures'].includes(activePage)) refreshDeviceTools().catch(() => {}); if (activePage === 'logs') pollLogs(); }, 1500);
