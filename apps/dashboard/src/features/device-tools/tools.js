import { activePage, showProductPage } from '../workspace/product.js';
import { t, $, $$, escape, icon, icons, busy, api, toast, state, connection, render, showWorkspace } from '../../legacy/device-controller.js';
/* Project tools use the authenticated local agent, including paired website sessions. */
let deviceToolsState = { sets: [], jobs: [], captures: [], recordings: [] }, toolsLoading = false;
let editingSetId = '', currentLogStatus = 'stopped';
let logLines = [], logCursor = 0, logDeviceId = '', logClearedAt = 0, logPolling = false;
const mediaURLs = new Map();
let thumbnailEpoch = 0, thumbnailActive = 0, thumbnailQueue = [], thumbnailController = new AbortController();
let captureViewerId = '', viewerURL = '', viewerController = null;
const thumbnailObserver = new IntersectionObserver(entries => { for (const entry of entries) if (entry.isIntersecting && activePage === 'captures') { thumbnailObserver.unobserve(entry.target); thumbnailQueue.push({ node: entry.target, epoch: thumbnailEpoch }); pumpThumbnails(); } }, { rootMargin: '200px' });
const toolText = value => escape(t(value));
function supportedDevices() { return state.devices.filter(d => d.state === 'online' && (d.platform === 'android' || (d.group === 'ios' && (state.platform === 'darwin' || state.demo || window.SNAPKIT_PREVIEW)))); }
function renderToolDevices() {
  const fingerprint = JSON.stringify([state.devices.map(d => [d.id, d.name, d.state]), state.settings.workspace, window.SnapkitI18n.language]); if (renderToolDevices.last === fingerprint) return; renderToolDevices.last = fingerprint;
  if (renderToolDevices.workspace !== state.settings.workspace) { editingSetId = ''; $('#set-name').value = ''; $$('#set-devices input').forEach(input => { input.checked = false; }); deviceToolsState = { sets: [], jobs: [], captures: [], recordings: [] }; releaseMedia(); renderSets(); renderCaptures(); updateSetEditor(); renderToolDevices.workspace = state.settings.workspace; }
  const devices = supportedDevices();
  for (const select of $$('.tool-device-picker')) {
    const chosen = select.value;
    select.innerHTML = devices.length ? devices.map(d => `<option value="${escape(d.id)}">${escape(d.name)}</option>`).join('') : `<option value="">${toolText('No supported device online')}</option>`;
    if (devices.some(d => d.id === chosen)) select.value = chosen;
  }
  $$('.tool-project').forEach(node => { node.textContent = state.settings.workspace || t('Choose a project to save device sets and captures.'); });
  updateLogControls();
  const picked = new Set($$('#set-devices input:checked').map(x => x.value));
  $('#set-devices').innerHTML = `<legend>${toolText('Devices in this set')}</legend>` + (state.devices.length ? state.devices.map(d => `<label><input type="checkbox" value="${escape(d.id)}" ${picked.has(d.id) ? 'checked' : ''}>${escape(d.name)} <small>· ${toolText(d.state === 'online' ? 'Online' : 'Offline')}</small></label>`).join('') : `<p>${toolText('Add or connect a device first.')}</p>`);
}
function renderSets() {
  const setsFingerprint = JSON.stringify([deviceToolsState.sets, state.devices.map(d => [d.id, d.name, d.state, d.flutterId]), state.settings.targetIds, state.settings.selectedSetId, state.settings.ideEnabled, window.SnapkitI18n.language]);
  if ($('#set-list').dataset.content !== setsFingerprint) { $('#set-list').dataset.content = setsFingerprint;
  $('#set-list').innerHTML = deviceToolsState.sets.length ? deviceToolsState.sets.map(set => {
    const selected = state.settings.selectedSetId === set.id && state.settings.targetIds?.length > 0 && state.settings.targetIds.every(id => set.deviceIds.includes(id));
    const ready = set.deviceIds.filter(id => state.devices.some(d => d.id === id && d.state === 'online' && d.flutterId));
    const chosen = selected ? state.settings.targetIds : [];
    const complete = selected && ready.length === chosen.length && ready.every(id => chosen.includes(id));
    const online = chosen.filter(id => ready.includes(id)).length;
    return `<article class="tool-card set-card${selected ? ' is-selected' : ''}" data-set-id="${set.id}"><div class="set-card-heading"><h2>${escape(set.name)}</h2>${selected ? `<span class="set-badge">${icon('check-circle-2')}${toolText('Selected for IDE')}</span>` : ''}</div><p class="set-members">${set.deviceIds.map(id => escape(state.devices.find(d => d.id === id)?.name || t('Missing device'))).join(' · ')}</p>${selected ? `<div class="set-selection"><strong>${escape(t('{0} of {1} devices selected', [chosen.length, set.deviceIds.length]))}</strong><span>${escape(t('{0} selected devices online', [online]))}</span><p>${toolText(state.settings.ideEnabled === false ? 'IDE sync is paused. Enable it in Devices to use this selection.' : 'Applies to your next IDE debug run. Current sessions stay unchanged.')}</p></div>` : ''}<div class="tool-buttons"><button class="button primary" data-set-start="${set.id}">${icon('play')}${toolText('Start set')}</button><button class="button" data-set-select="${set.id}" aria-pressed="${selected}" ${complete ? 'disabled' : ''}>${selected ? icon('check') : ''}${toolText(complete ? 'Selected for IDE' : selected ? 'Update ready devices' : 'Select ready devices for IDE')}</button><button class="button" data-set-edit="${set.id}">${toolText('Edit set')}</button><button class="button" data-set-delete="${set.id}">${toolText('Delete set')}</button></div></article>`;
  }).join('') : `<div class="tool-empty">${toolText('No device sets yet. Save the devices you use together for this project.')}</div>`;
  }
  const jobsFingerprint = JSON.stringify([deviceToolsState.jobs, window.SnapkitI18n.language]);
  if ($('#set-jobs').dataset.content === jobsFingerprint) { icons(); return; } $('#set-jobs').dataset.content = jobsFingerprint;
  const statuses = { waiting: 'Waiting', starting: 'Starting…', ready: 'Ready', missing: 'Missing device', connect: 'Connect phone first', busy: 'Device is busy', timeout: 'Still starting — refresh Devices', failed: 'Failed' };
  $('#set-jobs').innerHTML = deviceToolsState.jobs.slice(-5).reverse().map(job => `<article class="tool-card"><h2>${escape(job.name)} · ${toolText(job.status === 'running' ? 'Starting…' : 'Finished')}</h2>${job.devices.map(d => `<div class="tool-job-row"><span>${escape(d.name || state.devices.find(x => x.id === d.id)?.name || d.id)}</span><span>${toolText(statuses[d.status] || d.status)}${d.error ? ` · ${escape(d.error)}` : ''}</span></div>`).join('')}</article>`).join(''); icons();
}
function releaseMedia() {
  $('#capture-list').dataset.content = ''; thumbnailEpoch++; thumbnailController.abort(); thumbnailController = new AbortController(); thumbnailObserver.disconnect(); thumbnailQueue = [];
  for (const url of mediaURLs.values()) URL.revokeObjectURL(url); mediaURLs.clear();
  if ($('#capture-viewer').open) $('#capture-viewer').close();
}
async function fileBlob(id, signal = AbortSignal.timeout(120000)) {
  const url = `/api/tools/captures/${encodeURIComponent(id)}/file`;
  const response = await fetch(connection ? connection.base + url : url, { headers: connection ? { Authorization: `Bearer ${connection.token}` } : {}, credentials: 'omit', signal: AbortSignal.any([signal, AbortSignal.timeout(120000)]) });
  if (!response.ok) throw new Error(t('Could not load capture. Refresh and try again.'));
  return response.blob();
}
function thumbnailBlob(media) {
  const width = media.videoWidth || media.naturalWidth, height = media.videoHeight || media.naturalHeight;
  if (!width || !height) throw new Error(t('Could not load preview.'));
  const scale = Math.min(1, 480 / width, 360 / height), canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
  canvas.getContext('2d').drawImage(media, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error(t('Could not load preview.'))), 'image/webp', .85));
}
async function makeThumbnail(capture, signal) {
  const blob = await fileBlob(capture.id, signal), url = URL.createObjectURL(blob);
  const media = document.createElement(capture.kind === 'image' ? 'img' : 'video');
  try {
    await new Promise((resolve, reject) => {
      let timer;
      const finish = error => { clearTimeout(timer); signal.removeEventListener('abort', abort); media.onload = media.onloadeddata = media.onerror = null; error ? reject(error) : resolve(); };
      const abort = () => finish(new DOMException('Aborted', 'AbortError'));
      timer = setTimeout(() => finish(new Error(t('Could not load preview.'))), 20000);
      signal.addEventListener('abort', abort, { once: true });
      media.onerror = () => finish(new Error(t('Could not load preview.')));
      if (capture.kind === 'image') media.onload = () => finish();
      else { media.muted = true; media.playsInline = true; media.preload = 'auto'; media.onloadeddata = () => finish(); }
      media.src = url;
      if (signal.aborted) abort();
    });
    return await thumbnailBlob(media);
  } finally { if (capture.kind !== 'image') { media.pause(); media.removeAttribute('src'); media.load(); } else media.removeAttribute('src'); URL.revokeObjectURL(url); }
}
function pumpThumbnails() {
  while (thumbnailActive < 2 && thumbnailQueue.length) {
    const { node, epoch } = thumbnailQueue.shift(); if (epoch !== thumbnailEpoch || !node.isConnected) continue;
    const capture = deviceToolsState.captures.find(x => x.id === node.dataset.media); if (!capture) continue;
    thumbnailActive++; const signal = thumbnailController.signal;
    (async () => {
      try {
        let url = mediaURLs.get(capture.id);
        if (!url) { const blob = await makeThumbnail(capture, signal); if (epoch !== thumbnailEpoch || signal.aborted) return; url = URL.createObjectURL(blob); mediaURLs.set(capture.id, url); }
        if (!node.isConnected || epoch !== thumbnailEpoch) return;
        const image = document.createElement('img'); image.src = url; image.alt = capture.deviceName; image.decoding = 'async'; node.replaceChildren(image);
        if (capture.kind === 'video') { const play = document.createElement('span'); play.className = 'capture-play'; play.innerHTML = icon('play'); node.append(play); icons(); }
        node.classList.add('loaded'); node.removeAttribute('aria-busy');
      } catch (error) { if (signal.aborted || epoch !== thumbnailEpoch || !node.isConnected) return; node.innerHTML = `${icon('image-off')}<span>${toolText('Preview unavailable · click to retry')}</span>`; node.removeAttribute('aria-busy'); icons(); }
      finally { thumbnailActive--; pumpThumbnails(); }
    })();
  }
}
async function showCaptureViewer(capture) {
  const dialog = $('#capture-viewer');
  viewerController?.abort(); viewerController = new AbortController(); const controller = viewerController;
  if (viewerURL) URL.revokeObjectURL(viewerURL); viewerURL = ''; captureViewerId = capture.id;
  $('#capture-viewer-title').textContent = capture.deviceName;
  $('#capture-viewer-meta').textContent = `${t(capture.kind === 'image' ? 'Screenshot' : 'Screen recording')} · ${new Date(capture.createdAt).toLocaleString(window.SnapkitI18n.language === 'vi' ? 'vi-VN' : 'en-GB')}`;
  $('#capture-viewer-content').innerHTML = `<p role="status">${toolText('Loading preview…')}</p>`;
  $('#capture-viewer-retry').hidden = true;
  if (!dialog.open) dialog.showModal();
  try {
    const blob = await fileBlob(capture.id, controller.signal); if (controller.signal.aborted || !dialog.open) return;
    viewerURL = URL.createObjectURL(blob);
    const media = document.createElement(capture.kind === 'image' ? 'img' : 'video');
    if (capture.kind === 'image') media.alt = capture.deviceName;
    else { media.controls = true; media.playsInline = true; media.preload = 'metadata'; }
    media.onerror = () => { if (!controller.signal.aborted) { $('#capture-viewer-content').textContent = t('Could not load preview.'); $('#capture-viewer-retry').hidden = false; } };
    media.src = viewerURL; $('#capture-viewer-content').replaceChildren(media);
  } catch (error) { if (!controller.signal.aborted) { $('#capture-viewer-content').textContent = t('Could not load preview.'); $('#capture-viewer-retry').hidden = false; } }
}
$('#capture-viewer').addEventListener('close', () => {
  viewerController?.abort(); const video = $('#capture-viewer-content video'); if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
  $('#capture-viewer-content').replaceChildren(); if (viewerURL) URL.revokeObjectURL(viewerURL); viewerURL = '';
  $(`[data-capture-preview="${captureViewerId}"]`)?.focus({ preventScroll: true }); captureViewerId = '';
});
$('#capture-viewer').addEventListener('click', event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.currentTarget.close(); } });
$('#capture-viewer-retry').addEventListener('click', () => { const capture = deviceToolsState.captures.find(x => x.id === captureViewerId); if (capture) showCaptureViewer(capture); });
$('#capture-viewer-download').addEventListener('click', event => busy(event.currentTarget, async () => { const capture = deviceToolsState.captures.find(x => x.id === captureViewerId); if (capture) await downloadCapture(capture); }));
async function downloadCapture(capture) { const blob = await fileBlob(capture.id); saveBlob(blob, `Snapkit-${capture.createdAt.replace(/[:.]/g, '-')}.${capture.kind === 'image' ? 'png' : 'mp4'}`); }
function saveBlob(blob, name) { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
function renderCaptures() {
  updateLogControls();
  $('#capture-recordings').innerHTML = deviceToolsState.recordings.map(x => `<article class="tool-card"><h2>${escape(x.deviceName)}</h2><p>${toolText(x.status === 'recording' ? 'Recording · stops automatically after 3 minutes' : 'Finalizing video…')}</p>${x.status === 'recording' ? `<button class="button danger" data-record-stop="${x.id}">${icon('square')}${toolText('Stop recording')}</button>` : ''}</article>`).join('');
  const fingerprint = JSON.stringify(deviceToolsState.captures) + window.SnapkitI18n.language;
  if ($('#capture-list').dataset.content === fingerprint) { icons(); return; }
  thumbnailObserver.disconnect(); thumbnailQueue = [];
  const ready = new Set(deviceToolsState.captures.filter(x => x.status === 'ready').map(x => x.id));
  for (const [id, url] of mediaURLs) if (!ready.has(id)) { URL.revokeObjectURL(url); mediaURLs.delete(id); }
  if (captureViewerId && !ready.has(captureViewerId)) $('#capture-viewer').close();
  $('#capture-list').dataset.content = fingerprint;
  $('#capture-list').innerHTML = deviceToolsState.captures.length ? deviceToolsState.captures.map(x => `<article class="tool-card capture-card"><h2>${escape(x.deviceName)}</h2><p>${toolText(x.kind === 'image' ? 'Screenshot' : 'Screen recording')}</p><time>${escape(new Date(x.createdAt).toLocaleString(window.SnapkitI18n.language === 'vi' ? 'vi-VN' : 'en-GB'))}</time>${x.status === 'ready' ? `<button class="capture-thumbnail" data-media="${x.id}" data-capture-preview="${x.id}" aria-label="${escape(t('View {0}', [x.deviceName]))}" aria-haspopup="dialog" aria-busy="true">${icon(x.kind === 'image' ? 'image' : 'video')}<span>${toolText('Loading preview…')}</span></button><div class="tool-buttons"><button class="button" data-capture-download="${x.id}">${icon('download')}${toolText('Download')}</button>` : `<p role="status">${toolText('Capture failed')}: ${toolText(x.error || '')}</p><div class="tool-buttons">`}<button class="button" data-capture-delete="${x.id}">${toolText('Delete capture')}</button></div></article>`).join('') : `<div class="tool-empty">${toolText('No captures for this project yet. Take a screenshot to get started.')}</div>`;
  $$('#capture-list [data-media]').forEach(node => thumbnailObserver.observe(node));
  icons();
}
async function refreshDeviceTools() {
  if (toolsLoading) return;
  toolsLoading = true;
  try { const workspace = state.settings.workspace, result = await api('/api/tools'); if (workspace !== state.settings.workspace) return; deviceToolsState = result; renderSets(); renderCaptures(); }
  finally { toolsLoading = false; }
}
$('#set-form').addEventListener('submit', event => { event.preventDefault(); busy($('#set-form button[type=submit]'), async () => {
  await api('/api/tools/sets/save', { id: editingSetId || undefined, name: $('#set-name').value, deviceIds: $$('#set-devices input:checked').map(x => x.value) }); $('#set-name').value = ''; editingSetId = ''; updateSetEditor(); toast('Device set saved'); await refreshDeviceTools();
}); });
$('#panel-sets').addEventListener('click', event => {
  const button = event.target.closest('[data-set-start],[data-set-delete],[data-set-select],[data-set-edit]'); if (!button) return;
  busy(button, async () => {
    if (button.dataset.setEdit) { const set = deviceToolsState.sets.find(x => x.id === button.dataset.setEdit); editingSetId = set.id; updateSetEditor(); $('#set-name').value = set.name; $$('#set-devices input').forEach(input => { input.checked = set.deviceIds.includes(input.value); }); $('#set-name').focus(); toast('Edit the name or devices, then save'); }
    if (button.dataset.setStart) { await api(`/api/tools/sets/${button.dataset.setStart}/start`, {}); await refreshDeviceTools(); }
    if (button.dataset.setDelete && confirm(t('Delete this saved set? Your devices and their data are kept.'))) { await api(`/api/tools/sets/${button.dataset.setDelete}/delete`, {}); await refreshDeviceTools(); }
    if (button.dataset.setSelect) {
      const set = deviceToolsState.sets.find(x => x.id === button.dataset.setSelect), targetIds = set.deviceIds.filter(id => state.devices.some(d => d.id === id && d.state === 'online' && d.flutterId));
      if (!targetIds.length) throw new Error(t('Start a device in this set first.'));
      const result = await api('/api/targets', { ids: targetIds, setId: set.id }); state.settings = result.settings; render(); toast('Ready devices selected for the next IDE debug run');
    }
  });
});
function updateLogControls() {
  $('#log-stop').disabled = currentLogStatus !== 'running' || $('#log-stop').hasAttribute('aria-busy');
  $('#log-start').disabled = !$('#log-device').value || $('#log-start').hasAttribute('aria-busy');
  $('#capture-shot').disabled = !$('#capture-device').value || !state.settings.workspace || $('#capture-shot').hasAttribute('aria-busy');
  $('#capture-record').disabled = !$('#capture-device').value || !state.settings.workspace || $('#capture-record').hasAttribute('aria-busy') || deviceToolsState.recordings.some(x => x.deviceId === $('#capture-device').value);
}
function filteredLogLines() { const text = $('#log-search').value.toLocaleLowerCase(), level = $('#log-level').value; return logLines.filter(line => line.id > logClearedAt && (!text || line.text.toLocaleLowerCase().includes(text)) && (level === 'all' || (level === 'error' ? /\bE\b|error|fatal|fault/i : /\b[WEF]\b|warn|error|fatal|fault/i).test(line.text))); }
function renderLogLines() { const output = $('#log-output'); output.textContent = filteredLogLines().map(line => line.text).join('\n'); if ($('#log-follow').checked) output.scrollTop = output.scrollHeight; }
async function pollLogs() {
  if (!logDeviceId || logPolling || activePage !== 'logs' || document.hidden) return;
  logPolling = true;
  try { const id = logDeviceId, result = await api(`/api/tools/logs/${encodeURIComponent(id)}?after=${logCursor}`); if (id !== logDeviceId) return;
    logCursor = Math.max(logCursor, result.next - 1); logLines = [...logLines, ...result.lines].slice(-1000);
    $('#log-status').textContent = t(result.status === 'running' ? 'Streaming' : result.status === 'failed' ? 'Failed' : 'Stopped');
    $('#log-detail').textContent = result.detail || (result.truncated ? t('Older lines were discarded to keep the viewer responsive.') : '');
    currentLogStatus = result.status; updateLogControls(); if ($('#log-follow').checked) renderLogLines();
  } catch (e) { $('#log-detail').textContent = e.message; } finally { logPolling = false; updateLogControls(); }
}
$('#log-start').addEventListener('click', event => busy(event.currentTarget, async () => {
  const id = $('#log-device').value; if (!id) throw new Error(t('No supported device online'));
  if (logDeviceId && logDeviceId !== id) await api(`/api/tools/logs/${encodeURIComponent(logDeviceId)}/stop`, {});
  await api(`/api/tools/logs/${encodeURIComponent(id)}/start`, {}); logDeviceId = id; logLines = []; logCursor = 0; logClearedAt = 0; await pollLogs();
}));
$('#log-stop').addEventListener('click', event => { busy(event.currentTarget, async () => { if (logDeviceId) await api(`/api/tools/logs/${encodeURIComponent(logDeviceId)}/stop`, {}); currentLogStatus = 'stopped'; await pollLogs(); }).finally(updateLogControls); });
$('#capture-device').addEventListener('change', updateLogControls);
$('#log-device').addEventListener('change', () => { updateLogControls(); $('#log-detail').textContent = t('Press Start logs to switch to the selected device.'); });
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
    if (button.dataset.captureDownload) await downloadCapture(capture);
    else await showCaptureViewer(capture);
  });
});
$('#devices-grid').addEventListener('click', event => {
  const button = event.target.closest('[data-tool-action]'); if (!button) return;
  const id = button.closest('[data-device]').dataset.device;
  if (button.dataset.toolAction === 'logs') { showProductPage('logs'); $('#log-device').value = id; $('#log-start').click(); }
  else { showProductPage('captures'); $('#capture-device').value = id; busy(button, () => captureAction(button.dataset.toolAction === 'record' ? 'record' : 'screenshot', id)); }
});
function updateSetEditor() { $('#set-editor-title').textContent = t(editingSetId ? 'Edit device set' : 'Create a device set'); $('#set-save').textContent = t(editingSetId ? 'Save changes' : 'Save device set'); $('#set-cancel').hidden = !editingSetId; }
$('#set-cancel').addEventListener('click', () => { editingSetId = ''; $('#set-name').value = ''; $$('#set-devices input').forEach(input => { input.checked = false; }); updateSetEditor(); $('#set-name').focus(); });
$$('[data-open-project]').forEach(button => button.addEventListener('click', showWorkspace));
document.addEventListener('snapkit:page', event => { if (['sets', 'logs', 'captures'].includes(event.detail)) { renderToolDevices(); refreshDeviceTools().catch(error => toast(error.message, true)); } if (event.detail !== 'captures') releaseMedia(); });
document.addEventListener('snapkit:state', () => { renderToolDevices(); renderSets(); });
document.addEventListener('snapkit:language', () => { renderToolDevices(); renderSets(); renderCaptures(); renderLogLines(); updateSetEditor(); });
setInterval(() => { if (!document.hidden && ['sets', 'captures'].includes(activePage)) refreshDeviceTools().catch(() => {}); if (activePage === 'logs') pollLogs(); }, 1500);

export {};
