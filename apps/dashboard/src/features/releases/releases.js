/* Release UI talks only to the authenticated local agent. */
(() => {
  let catalog = null, releaseState = { jobs: [], busy: false }, selectedId = '', detail = null;
  let context = '', loading = false, catalogLoading = false, formBusy = false, uploadId = '', generation = 0;
  const el = id => document.getElementById(id);
  const text = (key, values) => escape(t(key, values));
  const statuses = { preparing: 'Preparing…', building: 'Building…', collecting: 'Saving artifact…', succeeded: 'Build complete', failed: 'Build failed', cancelled: 'Cancelled', interrupted: 'Interrupted', uploading: 'Uploading…', uploaded: 'Sent to Apple', unknown: 'Check App Store Connect' };
  const format = () => document.querySelector('[name="release-format"]:checked')?.value || 'apk';
  const title = kind => ({ apk: 'APK', aab: 'App Bundle', ipa: 'TestFlight IPA' })[kind];
  const selectedJob = () => releaseState.jobs.find(job => job.id === selectedId);
  function input() { return { format: format(), flavor: el('release-flavor').value, target: el('release-target').value.trim(), defineFile: el('release-defines').value.trim(), buildName: el('release-version').value.trim(), buildNumber: el('release-number').value.trim(), exportOptions: el('release-export-options').value.trim() }; }
  function localOnly() { return !connection && !window.SNAPKIT_CONTROLLER; }
  function updateControls() {
    const kind = format(), ready = catalog && state.settings.workspace && !catalogLoading;
    el('release-submit').disabled = !ready || window.SNAPKIT_PREVIEW || releaseState.busy || formBusy || (kind === 'ipa' ? catalog.platform !== 'darwin' || !catalog.ios : !catalog.android);
    el('release-submit').querySelector('span').textContent = t({ apk: 'Build APK', aab: 'Build App Bundle', ipa: 'Build TestFlight IPA' }[kind]) + (el('release-flavor').value ? ' · ' + el('release-flavor').value : '');
    el('release-ios-options').hidden = kind !== 'ipa';
    el('release-platform-note').textContent = window.SNAPKIT_PREVIEW ? t('Open Snapkit Desktop to build this workspace.') : releaseState.busy && releaseState.active?.workspace !== state.settings.workspace ? t('A release task is running in another workspace. Wait for it to finish before starting a build.') : kind === 'ipa' ? t(catalog?.platform !== 'darwin' ? 'TestFlight builds require macOS and Xcode.' : 'App Store distribution · signing comes from your Xcode project.') : t('Release mode · signing comes from your Android project.');
    el('release-key-status').textContent = t(releaseState.uploadConfigured ? 'Configured for this workspace' : 'Not configured');
    el('release-key-clear').disabled = !releaseState.uploadConfigured || !localOnly();
    el('release-key-form').querySelector('button[type=submit]').disabled = !state.settings.workspace || !localOnly();
    document.querySelectorAll('[data-release-file]').forEach(button => { button.hidden = !window.snapkitDesktop?.chooseReleaseFile; });
    const options = input(), pieces = [title(kind), options.flavor || t('Default (no flavor)'), options.target];
    el('release-summary').textContent = pieces.join(' · ');
    const args = ['flutter', 'build', { apk: 'apk', aab: 'appbundle', ipa: 'ipa' }[kind], '--release', ...(options.flavor ? ['--flavor', options.flavor] : []), '--target', options.target, ...(options.defineFile ? ['--dart-define-from-file', options.defineFile] : []), ...(options.buildName ? ['--build-name', options.buildName] : []), ...(options.buildNumber ? ['--build-number', options.buildNumber] : []), ...(kind === 'ipa' ? options.exportOptions ? ['--export-options-plist', options.exportOptions] : ['--export-method', 'app-store'] : [])];
    el('release-command').textContent = args.map(arg => /\s/.test(arg) ? JSON.stringify(arg) : arg).join(' ');
  }
  function applyProfile(index) {
    const profile = catalog?.profiles[index]; if (!profile) return;
    el('release-flavor').value = profile.flavor || ''; el('release-target').value = profile.target || 'lib/main.dart'; el('release-defines').value = profile.defineFile || '';
    el('release-form-error').textContent = profile.review ? t('This flavor has no matching debug profile. Review its entrypoint and defines before building.') : '';
    updateControls();
  }
  async function loadCatalog() {
    if (catalogLoading || !state.settings.workspace) return;
    const workspace = state.settings.workspace, epoch = generation; catalogLoading = true; updateControls(); el('release-catalog-error').textContent = '';
    try {
      const result = await api('/api/releases/catalog'); if (epoch !== generation || workspace !== state.settings.workspace) return;
      catalog = result;
      const profiles = result.profiles || [], flavors = [...new Set([...(result.flavors || []), ...profiles.map(profile => profile.flavor || '')])];
      if (!flavors.length) flavors.push('');
      el('release-profile').innerHTML = profiles.map((profile, index) => `<option value="${index}">${escape(t(profile.name))}${profile.flavor ? ' · ' + escape(profile.flavor) : ''}</option>`).join('');
      el('release-profile').disabled = !profiles.length;
      el('release-flavor').innerHTML = flavors.map(flavor => `<option value="${escape(flavor)}">${escape(flavor || t('Default (no flavor)'))}</option>`).join(''); el('release-flavor').disabled = !flavors.some(Boolean);
      el('release-project-version').textContent = result.version || '—';
      document.querySelectorAll('[name="release-format"]').forEach(radio => { radio.disabled = radio.value === 'ipa' ? !result.ios || result.platform !== 'darwin' : !result.android; });
      if (document.querySelector('[name="release-format"]:checked')?.disabled) document.querySelector('[name="release-format"]:not(:disabled)')?.click();
      const index = Math.max(0, profiles.findIndex(profile => profile.flavor === (state.settings.flavor || '') && profile.target === (state.settings.target || 'lib/main.dart')));
      el('release-profile').value = String(index); applyProfile(index);
    } catch (error) { if (epoch === generation) { catalog = null; el('release-catalog-error').textContent = t(error.message); } }
    finally { if (epoch === generation) { catalogLoading = false; updateControls(); } }
  }
  function resetWorkspace() {
    const next = JSON.stringify([state.settings.workspace, state.settings.flavor, state.settings.target, state.settings.defineFile]);
    if (context === next) return false;
    context = next; generation++; catalog = null; catalogLoading = false; loading = false; selectedId = ''; detail = null; releaseState = { jobs: [], busy: false };
    el('release-form').reset(); el('release-key-form').reset(); el('release-form-error').textContent = ''; el('release-key-error').textContent = ''; el('release-catalog-error').textContent = '';
    if (el('release-upload-dialog').open) el('release-upload-dialog').close();
    el('release-workspace').textContent = state.settings.workspace || '';
    el('release-layout').hidden = !state.settings.workspace; el('release-no-workspace').classList.toggle('hidden', !!state.settings.workspace);
    renderResults(); updateControls(); return true;
  }
  function renderResults() {
    const job = selectedJob(), activeStatus = job?.uploadStatus || job?.status;
    el('release-monitor-title').textContent = job ? `${title(job.plan.format)} · ${job.plan.flavor || t('Default (no flavor)')}` : t('Ready when you are.');
    el('release-status').textContent = t(statuses[activeStatus] || 'No build selected'); el('release-status').dataset.status = activeStatus || '';
    el('release-monitor-detail').textContent = job ? [new Date(job.startedAt).toLocaleString(window.SnapkitI18n.language), job.plan.target, job.plan.buildName || '', job.plan.buildNumber ? '#' + job.plan.buildNumber : '', releaseState.demo ? t('Demo only · no real build or upload') : ''].filter(Boolean).join(' · ') : t('Start a build to follow its progress and download the result.');
    el('release-active-error').textContent = t(job?.uploadError || job?.error || '');
    const active = job && releaseState.active?.id === job.id;
    const actions = job ? (active ? `<button type="button" class="button" data-release-cancel="${job.id}">${icon('square')}${text('Cancel task')}</button>` : '') + (job.status === 'succeeded' ? job.artifacts.map(item => `<button type="button" class="button" data-release-download="${item.id}" data-release-job="${job.id}">${icon('download')}${text('Download')} ${escape(item.name)} · ${(item.size / 1024 / 1024).toFixed(1)} MB</button>`).join('') + (job.plan.format === 'ipa' ? `<button type="button" class="button primary" data-release-upload="${job.id}" ${releaseState.busy || job.uploadStatus === 'uploaded' || !localOnly() ? 'disabled' : ''}>${icon('send')}${text(job.uploadStatus === 'uploaded' ? 'Sent to Apple' : 'Upload to TestFlight')}</button><p class="release-note">${text(job.uploadStatus === 'uploaded' ? 'Apple is processing this build. Check App Store Connect for validation and tester availability.' : !releaseState.uploadConfigured ? 'Configure App Store Connect below to enable upload.' : 'Upload sends this saved IPA. It does not rebuild the project.')}</p>` : '') : '') : '';
    if (el('release-current-actions').dataset.markup !== actions) { el('release-current-actions').innerHTML = actions; el('release-current-actions').dataset.markup = actions; }
    el('release-log-wrap').hidden = !job;
    const output = detail && job && detail.id === job.id ? detail.log || '' : '';
    if (el('release-log').textContent !== output) { el('release-log').textContent = output; if (el('release-follow').checked) el('release-log').scrollTop = el('release-log').scrollHeight; }
    const history = releaseState.jobs.map(item => `<article class="release-history-row${item.id === selectedId ? ' is-selected' : ''}"><button type="button" data-release-select="${item.id}" aria-pressed="${item.id === selectedId}"><strong>${escape(title(item.plan.format))} · ${escape(item.plan.flavor || t('Default (no flavor)'))}</strong><small>${text(statuses[item.uploadStatus || item.status] || item.status)} · ${escape(new Date(item.startedAt).toLocaleString(window.SnapkitI18n.language))}</small></button><button type="button" class="icon-button" data-release-delete="${item.id}" aria-label="${text('Remove build')}" ${releaseState.active?.id === item.id ? 'disabled' : ''}>${icon('trash-2')}</button></article>`).join('') || `<p class="release-note">${text('Your builds will appear here.')}</p>`;
    if (el('release-history').dataset.markup !== history) { el('release-history').innerHTML = history; el('release-history').dataset.markup = history; }
    el('release-history-count').textContent = releaseState.jobs.length; updateControls(); icons();
  }
  async function refreshResults() {
    if (loading || !state.settings.workspace) return;
    loading = true; const epoch = generation;
    try {
      const result = await api('/api/releases'); if (epoch !== generation) return;
      releaseState = result;
      if (!result.jobs.some(job => job.id === selectedId)) selectedId = result.jobs[0]?.id || '';
      if (selectedId) { const next = await api('/api/releases/' + selectedId); if (epoch !== generation) return; detail = next; }
      else detail = null;
      renderResults();
    } catch (error) { if (epoch === generation) el('release-active-error').textContent = t(error.message); }
    finally { if (epoch === generation) loading = false; }
  }
  el('release-profile').addEventListener('change', () => applyProfile(Number(el('release-profile').value)));
  el('release-flavor').addEventListener('change', () => { const index = catalog?.profiles.findIndex(profile => profile.flavor === el('release-flavor').value); if (index >= 0) { el('release-profile').value = String(index); applyProfile(index); } else updateControls(); });
  el('release-form').addEventListener('input', updateControls); el('release-form').addEventListener('change', updateControls);
  el('release-refresh').addEventListener('click', () => { loadCatalog(); refreshResults(); });
  el('release-form').addEventListener('submit', async event => {
    event.preventDefault(); if (el('release-submit').disabled) return;
    const epoch = generation; formBusy = true; el('release-form-error').textContent = ''; updateControls();
    try { const job = await api('/api/releases/build', input()); if (epoch !== generation) return; selectedId = job.id; releaseState.jobs.unshift(job); releaseState.busy = true; releaseState.active = { id: job.id, workspace: state.settings.workspace, operation: 'build' }; renderResults(); await refreshResults(); }
    catch (error) { if (epoch === generation) el('release-form-error').textContent = t(error.message); }
    finally { formBusy = false; updateControls(); }
  });
  el('release-key-form').addEventListener('submit', event => { event.preventDefault(); busy(el('release-key-form').querySelector('button[type=submit]'), async () => {
    el('release-key-error').textContent = '';
    try { await api('/api/releases/testflight/config', { keyId: el('release-key-id').value, issuerId: el('release-issuer').value, keyPath: el('release-key-path').value }); el('release-key-form').reset(); await refreshResults(); toast('Upload configuration saved on this computer'); }
    catch (error) { el('release-key-error').textContent = t(error.message); }
  }); });
  el('release-key-clear').addEventListener('click', () => busy(el('release-key-clear'), async () => { await api('/api/releases/testflight/config', { clear: true }); await refreshResults(); }));
  document.querySelectorAll('[data-release-file]').forEach(button => button.addEventListener('click', () => busy(button, async () => { const value = await window.snapkitDesktop?.chooseReleaseFile(button.dataset.releaseFile); if (value) { el(button.dataset.releaseFile === 'private-key' ? 'release-key-path' : 'release-export-options').value = value; updateControls(); } })));
  el('release-upload-confirm').addEventListener('click', () => busy(el('release-upload-confirm'), async () => {
    el('release-upload-error').textContent = '';
    try { await api(`/api/releases/${uploadId}/upload`, { confirm: uploadId }); el('release-upload-dialog').close(); await refreshResults(); }
    catch (error) { el('release-upload-error').textContent = t(error.message); }
  }));
  el('panel-releases').addEventListener('click', event => {
    const button = event.target.closest('[data-release-select],[data-release-cancel],[data-release-delete],[data-release-download],[data-release-upload]'); if (!button) return;
    if (button.dataset.releaseSelect) { selectedId = button.dataset.releaseSelect; detail = null; renderResults(); refreshResults(); return; }
    if (button.dataset.releaseUpload) {
      if (!releaseState.uploadConfigured) { el('release-credentials').open = true; el('release-key-id').focus(); return; }
      const job = releaseState.jobs.find(item => item.id === button.dataset.releaseUpload); uploadId = job.id;
      el('release-upload-summary').textContent = [title(job.plan.format), job.plan.flavor || t('Default (no flavor)'), job.plan.target, job.artifacts[0]?.name, job.uploadStatus === 'unknown' ? t('A previous upload may have reached Apple. Check App Store Connect before retrying.') : ''].filter(Boolean).join(' · ');
      el('release-upload-error').textContent = ''; el('release-upload-dialog').showModal(); return;
    }
    busy(button, async () => {
      if (button.dataset.releaseCancel) await api(`/api/releases/${button.dataset.releaseCancel}/cancel`, {});
      if (button.dataset.releaseDelete) { if (!confirm(t('Remove this saved build and its copied artifacts? Your Flutter project is kept.'))) return; await api(`/api/releases/${button.dataset.releaseDelete}/delete`, {}); }
      if (button.dataset.releaseDownload) {
        const route = `/api/releases/${button.dataset.releaseJob}/artifacts/${button.dataset.releaseDownload}`, anchor = document.createElement('a');
        if (connection) { const response = await fetch(connection.base + route, { headers: { Authorization: `Bearer ${connection.token}` }, credentials: 'omit' }); if (!response.ok) throw Error(t('Artifact not available.')); const url = URL.createObjectURL(await response.blob()); anchor.href = url; anchor.download = releaseState.jobs.find(job => job.id === button.dataset.releaseJob)?.artifacts.find(item => item.id === button.dataset.releaseDownload)?.name || 'release'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
        else { anchor.href = route; anchor.download = ''; anchor.click(); }
      }
      await refreshResults();
    });
  });
  document.addEventListener('snapkit:page', event => { if (event.detail === 'releases') { resetWorkspace(); if (!catalog) loadCatalog(); refreshResults(); } });
  document.addEventListener('snapkit:state', () => { if (resetWorkspace() && activePage === 'releases') { loadCatalog(); refreshResults(); } });
  document.addEventListener('snapkit:language', () => { renderResults(); });
  setInterval(() => { if (!document.hidden && activePage === 'releases') refreshResults(); }, 1500);
  resetWorkspace();
})();
