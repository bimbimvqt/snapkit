/* Release UI talks only to the authenticated local agent. */
(() => {
  let apple = { teams: [], selections: {} }, appleLoading = false, appleSaving = false, appleEpoch = 0, detectedTeams = [];
  let catalog = null, releaseState = { jobs: [], busy: false }, selectedId = '', detail = null, runDeviceId = '';
  let context = '', loading = false, catalogLoading = false, formBusy = false, uploadId = '', generation = 0;
  const el = id => document.getElementById(id);
  const text = (key, values) => escape(t(key, values));
  function setAppleError(id, message = '') { el(id).dataset.source = message; el(id).textContent = t(message); }
  const statuses = { preparing: 'Preparing…', building: 'Building…', collecting: 'Saving artifact…', succeeded: 'Build complete', failed: 'Build failed', cancelled: 'Cancelled', interrupted: 'Interrupted', blocked: 'Upload blocked', uploading: 'Uploading…', uploaded: 'Sent to Apple', unknown: 'Check App Store Connect' };
  const format = () => document.querySelector('[name="release-format"]:checked')?.value || 'apk';
  const title = kind => ({ apk: 'APK', aab: 'App Bundle', ipa: 'IPA' })[kind];
  const jobTitle = job => job.plan.operation === 'run' ? t('Run Release') : job.plan.purpose === 'testflight' ? t('TestFlight IPA') : title(job.plan.format);
  const jobStatus = job => job.plan.operation === 'run' && job.status === 'succeeded' ? 'Release launch complete' : job.plan.operation === 'run' && job.status === 'building' ? 'Building and launching…' : statuses[job.uploadStatus || job.status] || job.status;
  const selectedJob = () => releaseState.jobs.find(job => job.id === selectedId);
  function input(purpose = 'ipa') { return { purpose, apple: purpose === 'testflight' && el('release-use-apple').checked ? apple.selections[el('release-flavor').value] : undefined, format: format(), flavor: el('release-flavor').value, target: el('release-target').value.trim(), defineFile: el('release-defines').value.trim(), buildName: el('release-version').value.trim(), buildNumber: el('release-number').value.trim(), exportOptions: el('release-export-options').value.trim() }; }
  function localOnly() { return !connection && !window.SNAPKIT_CONTROLLER; }
  function renderRunControls() {
    const devices = (state.devices || []).filter(device => device.group === 'physical' && device.state === 'online' && device.flutterId && ['ios', 'android'].includes(device.platform));
    const picker = el('release-run-device');
    const options = `<option value="">${text(devices.length ? 'Choose a device' : 'No physical device connected')}</option>` + devices.map(device => `<option value="${escape(device.id)}">${escape(device.name)} · ${device.platform === 'ios' ? 'iOS' : 'Android'}</option>`).join('');
    if (picker.dataset.options !== options) { picker.innerHTML = options; picker.dataset.options = options; }
    picker.value = runDeviceId;
    const target = devices.find(device => device.id === runDeviceId), optionsInput = input();
    const unsupported = target?.platform === 'ios' && catalog?.platform !== 'darwin';
    const debugging = target && state.debugSessions?.some(session => [target.id, target.flutterId].includes(session.deviceId));
    picker.disabled = !devices.length || formBusy;
    el('release-run-submit').disabled = !target || !catalog || catalogLoading || !localOnly() || !!window.SNAPKIT_PREVIEW || formBusy || releaseState.busy || unsupported || debugging || !(target.platform === 'ios' ? catalog.ios : catalog.android);
    el('release-run-submit').querySelector('span').textContent = t('Run Release') + (optionsInput.flavor ? ' · ' + optionsInput.flavor : '');
    el('release-run-note').textContent = t(!localOnly() ? 'Run Release is available in the local app only.' : !devices.length ? 'Connect and unlock your phone, approve USB debugging or trust, then refresh Devices. Paired Wi-Fi devices also work.' : unsupported ? 'Running on iPhone requires macOS and Xcode.' : debugging ? 'Stop debugging this device before running Release.' : 'Choose the phone that should receive this release build.');
    el('release-run-summary').textContent = target ? [target.name, optionsInput.flavor || t('Default (no flavor)'), optionsInput.target].join(' · ') : '';
    el('release-run-command').hidden = !target;
    if (target) el('release-run-command').textContent = ['flutter', 'run', '--release', '--no-resident', '--device-id', target.flutterId, ...(optionsInput.flavor ? ['--flavor', optionsInput.flavor] : []), '--target', optionsInput.target, ...(optionsInput.defineFile ? ['--dart-define-from-file', optionsInput.defineFile] : [])].map(arg => /\s/.test(arg) ? JSON.stringify(arg) : arg).join(' ');
  }
  function updateControls() {
    renderRunControls();
    const kind = format(), ready = catalog && state.settings.workspace && !catalogLoading;
    el('release-submit').disabled = !ready || window.SNAPKIT_PREVIEW || releaseState.busy || formBusy || (kind === 'ipa' ? !localOnly() || catalog.platform !== 'darwin' || !catalog.ios : !catalog.android);
    el('release-submit').querySelector('span').textContent = t({ apk: 'Build APK', aab: 'Build App Bundle', ipa: 'Create IPA' }[kind]) + (el('release-flavor').value ? ' · ' + el('release-flavor').value : '');
    el('release-testflight-build').hidden = kind !== 'ipa'; el('release-ipa-note').hidden = kind !== 'ipa';
    el('release-connected-options').hidden = !el('release-use-apple').checked;
    const destination = apple.selections[el('release-flavor').value];
    el('release-testflight-build').disabled = el('release-submit').disabled || el('release-use-apple').checked && (appleLoading || appleSaving || !destination || destination.teamId !== el('release-apple-team').value || destination.appId !== el('release-apple-app').value);
    el('release-ios-options').hidden = kind !== 'ipa';
    el('release-apple-selection').hidden = kind !== 'ipa';
    el('release-platform-note').textContent = window.SNAPKIT_PREVIEW ? t('Open Snapkit Desktop to build this workspace.') : releaseState.busy && releaseState.active?.workspace !== state.settings.workspace ? t('A release task is running in another workspace. Wait for it to finish before starting a build.') : kind === 'ipa' ? t(catalog?.platform !== 'darwin' ? 'TestFlight builds require macOS and Xcode.' : !catalog?.ios ? 'This workspace does not contain an iOS project.' : 'App Store distribution · signing comes from your Xcode project.') : t(catalog && !catalog.android ? 'This workspace does not contain an Android project.' : 'Release mode · signing comes from your Android project.');
    el('release-key-status').textContent = apple.teams.length ? `${apple.teams.length} ${t('connected teams')}` : t('Not configured');
    el('release-key-form').querySelector('button[type=submit]').disabled = !state.settings.workspace || !localOnly() || !!window.SNAPKIT_PREVIEW;
    document.querySelectorAll('[data-release-file]').forEach(button => { button.hidden = !window.snapkitDesktop?.chooseReleaseFile; });
    const options = input(), pieces = [title(kind), options.flavor || t('Default (no flavor)'), options.target];
    el('release-summary').textContent = [...pieces, ...(kind === 'ipa' && options.apple ? [options.apple.teamName, options.apple.bundleId] : [])].join(' · ');
    const args = ['flutter', 'build', { apk: 'apk', aab: 'appbundle', ipa: 'ipa' }[kind], '--release', ...(options.flavor ? ['--flavor', options.flavor] : []), '--target', options.target, ...(options.defineFile ? ['--dart-define-from-file', options.defineFile] : []), ...(options.buildName ? ['--build-name', options.buildName] : []), ...(options.buildNumber ? ['--build-number', options.buildNumber] : []), ...(kind === 'ipa' ? options.exportOptions ? ['--export-options-plist', options.exportOptions] : ['--export-method', 'app-store'] : [])];
    el('release-command').textContent = args.map(arg => /\s/.test(arg) ? JSON.stringify(arg) : arg).join(' ');
  }
  function applyProfile(index) {
    const profile = catalog?.profiles[index]; if (!profile) return;
    el('release-flavor').value = profile.flavor || ''; el('release-target').value = profile.target || 'lib/main.dart'; el('release-defines').value = profile.defineFile || '';
    el('release-form-error').textContent = profile.review ? t('This flavor has no matching debug profile. Review its entrypoint and defines before building.') : '';
    renderApple(); updateControls();
  }
  async function loadCatalog() {
    if (catalogLoading || !state.settings.workspace) return;
    const workspace = state.settings.workspace, epoch = generation;
    const previous = catalog ? { values: input(), profile: catalog.profiles[Number(el('release-profile').value)], buildName: catalog.buildName, buildNumber: catalog.buildNumber } : null;
    catalogLoading = true; updateControls(); el('release-catalog-error').textContent = '';
    try {
      const result = await api('/api/releases/catalog'); if (epoch !== generation || workspace !== state.settings.workspace) return;
      const [name = '', number = ''] = (result.version || '').split('+');
      result.buildName ??= name; result.buildNumber ??= number; catalog = result;
      const profiles = result.profiles || [], flavors = [...new Set([...(result.flavors || []), ...profiles.map(profile => profile.flavor || '')])];
      if (!flavors.length) flavors.push('');
      el('release-profile').innerHTML = profiles.map((profile, index) => `<option value="${index}">${escape(t(profile.name))}${profile.flavor ? ' · ' + escape(profile.flavor) : ''}</option>`).join('');
      el('release-profile').disabled = !profiles.length;
      el('release-flavor').innerHTML = flavors.map(flavor => `<option value="${escape(flavor)}">${escape(flavor || t('Default (no flavor)'))}</option>`).join(''); el('release-flavor').disabled = !flavors.some(Boolean);
      el('release-project-version').textContent = result.version || '—';
      document.querySelectorAll('[name="release-format"]').forEach(radio => { radio.disabled = radio.value === 'ipa' ? !result.ios || result.platform !== 'darwin' : !result.android; });
      if (document.querySelector('[name="release-format"]:checked')?.disabled) document.querySelector('[name="release-format"]:not(:disabled)')?.click();
      let index = previous?.profile ? profiles.findIndex(profile => profile.name === previous.profile.name && profile.flavor === previous.profile.flavor) : -1;
      if (index < 0) index = profiles.findIndex(profile => profile.current);
      if (index < 0) index = profiles.findIndex(profile => profile.flavor === (state.settings.flavor || '') && profile.target === (state.settings.target || 'lib/main.dart') && (profile.defineFile || '') === (state.settings.defineFile || ''));
      index = Math.max(0, index);
      el('release-profile').value = String(index); applyProfile(index);
      if (previous?.profile && ['flavor', 'target', 'defineFile'].some(key => previous.values[key] !== (previous.profile[key] || ''))) {
        el('release-flavor').value = previous.values.flavor; el('release-target').value = previous.values.target; el('release-defines').value = previous.values.defineFile;
      }
      el('release-version').value = previous && previous.values.buildName !== previous.buildName ? previous.values.buildName : result.buildName;
      el('release-number').value = previous && previous.values.buildNumber !== previous.buildNumber ? previous.values.buildNumber : result.buildNumber;
    } catch (error) { if (epoch === generation) { catalog = null; el('release-catalog-error').textContent = t(error.message); } }
    finally { if (epoch === generation) { catalogLoading = false; updateControls(); } }
  }
  function resetWorkspace() {
    const next = JSON.stringify([state.settings.workspace, state.settings.flavor, state.settings.target, state.settings.defineFile]);
    if (context === next) return false;
    context = next; generation++; catalog = null; catalogLoading = false; loading = false; selectedId = ''; detail = null; releaseState = { jobs: [], busy: false };
    runDeviceId = ''; el('release-run-error').textContent = ''; el('release-form').reset(); el('release-key-form').reset(); el('release-form-error').textContent = ''; setAppleError('release-key-error', ''); el('release-catalog-error').textContent = '';
    if (el('release-upload-dialog').open) el('release-upload-dialog').close();
    el('release-workspace').textContent = state.settings.workspace || '';
    el('release-layout').hidden = !state.settings.workspace; el('release-no-workspace').classList.toggle('hidden', !!state.settings.workspace);
    apple = { teams: [], selections: {} }; appleLoading = false; appleSaving = false; appleEpoch++; detectedTeams = []; renderSuggestions(); renderApple();
    renderResults(); updateControls(); return true;
  }
  function renderResults() {
    const job = selectedJob(), activeStatus = job?.uploadStatus || job?.status;
    el('release-monitor-title').textContent = job ? `${jobTitle(job)} · ${job.plan.flavor || t('Default (no flavor)')}` : t('Ready when you are.');
    el('release-status').textContent = t(job ? jobStatus(job) : 'No build selected'); el('release-status').dataset.status = activeStatus || '';
    el('release-monitor-detail').textContent = job ? [new Date(job.startedAt).toLocaleString(window.SnapkitI18n.language), job.apple ? `${job.apple.teamName} · ${job.apple.bundleId} · ${job.apple.teamId}` : job.signing ? `${job.signing.bundleId} · ${job.signing.teamId}` : '', job.plan.device?.name || '', job.plan.target, job.plan.buildName || '', job.plan.buildNumber ? '#' + job.plan.buildNumber : '', releaseState.demo ? t('Demo only · no real build or upload') : ''].filter(Boolean).join(' · ') : t('Start a build to follow its progress and download the result.');
    el('release-active-error').textContent = t(job?.uploadError || job?.error || '');
    const active = job && releaseState.active?.id === job.id;
    const actions = job ? (active ? `<button type="button" class="button" data-release-cancel="${job.id}">${icon('square')}${text('Cancel task')}</button>` : '') + (job.status === 'succeeded' ? job.artifacts.map(item => `<button type="button" class="button" data-release-download="${item.id}" data-release-job="${job.id}">${icon('download')}${text('Download')} ${escape(item.name)} · ${(item.size / 1024 / 1024).toFixed(1)} MB</button>`).join('') + (job.plan.format === 'ipa' && job.plan.operation !== 'run' ? `<button type="button" class="button primary" data-release-upload="${job.id}" ${releaseState.busy || job.uploadStatus === 'uploaded' || !localOnly() ? 'disabled' : ''}>${icon('send')}${text(job.uploadStatus === 'uploaded' ? 'Sent to Apple' : 'Upload to TestFlight')}</button><button type="button" class="button" data-apple-help="xcode">${icon('monitor')}${text('Xcode instructions')}</button><p class="release-note">${text(job.uploadStatus === 'uploaded' ? 'Apple is processing this build. Check App Store Connect for validation and tester availability.' : !uploadConfigured(job) ? 'Reconnect the Apple team used by this IPA before uploading.' : 'Upload sends this saved IPA. It does not rebuild the project.')}</p>` : '') : '') : '';
    if (el('release-current-actions').dataset.markup !== actions) { el('release-current-actions').innerHTML = actions; el('release-current-actions').dataset.markup = actions; }
    el('release-log-wrap').hidden = !job;
    const output = detail && job && detail.id === job.id ? detail.log || '' : '';
    if (el('release-log').textContent !== output) { el('release-log').textContent = output; if (el('release-follow').checked) el('release-log').scrollTop = el('release-log').scrollHeight; }
    const history = releaseState.jobs.map(item => `<article class="release-history-row${item.id === selectedId ? ' is-selected' : ''}"><button type="button" data-release-select="${item.id}" aria-pressed="${item.id === selectedId}"><strong>${escape(jobTitle(item))} · ${escape(item.plan.flavor || t('Default (no flavor)'))}</strong><small>${text(jobStatus(item))} · ${escape(new Date(item.startedAt).toLocaleString(window.SnapkitI18n.language))}</small></button><button type="button" class="icon-button" data-release-delete="${item.id}" aria-label="${text('Remove build')}" ${releaseState.active?.id === item.id ? 'disabled' : ''}>${icon('trash-2')}</button></article>`).join('') || `<p class="release-note">${text('Your builds will appear here.')}</p>`;
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
  el('release-flavor').addEventListener('change', () => { const index = catalog?.profiles.findIndex(profile => profile.flavor === el('release-flavor').value); if (index >= 0) { el('release-profile').value = String(index); applyProfile(index); } else { renderApple(); updateControls(); } });
  el('release-form').addEventListener('input', updateControls); el('release-form').addEventListener('change', updateControls);
  el('release-refresh').addEventListener('click', () => { loadCatalog(); loadApple(); refreshResults(); });
  el('release-reset-version').addEventListener('click', () => { el('release-version').value = catalog?.buildName || ''; el('release-number').value = catalog?.buildNumber || ''; updateControls(); });
  el('release-form').addEventListener('submit', async event => {
    event.preventDefault(); const purpose = event.submitter?.id === 'release-testflight-build' ? 'testflight' : 'ipa'; if ((purpose === 'testflight' ? el('release-testflight-build') : el('release-submit')).disabled) return;
    const epoch = generation; formBusy = true; el('release-form-error').textContent = ''; updateControls();
    try { const job = await api('/api/releases/build', input(purpose)); if (epoch !== generation) return; selectedId = job.id; releaseState.jobs.unshift(job); releaseState.busy = true; releaseState.active = { id: job.id, workspace: state.settings.workspace, operation: 'build' }; renderResults(); await refreshResults(); }
    catch (error) { if (epoch === generation) el('release-form-error').textContent = t(error.message); }
    finally { formBusy = false; updateControls(); }
  });
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-run-release]'); if (!button || button.disabled) return;
    showProductPage('releases'); runDeviceId = button.dataset.runRelease; updateControls();
    el('release-run-title').scrollIntoView({ block: 'center' }); el('release-run-title').focus({ preventScroll: true });
  });
  el('release-run-device').addEventListener('input', () => { runDeviceId = el('release-run-device').value; el('release-run-error').textContent = ''; updateControls(); });
  el('release-run-submit').addEventListener('click', async () => {
    if (el('release-run-submit').disabled || !el('release-target').reportValidity()) return;
    const epoch = generation, values = { ...input(), deviceId: runDeviceId };
    formBusy = true; el('release-run-error').textContent = ''; updateControls();
    try {
      const job = await api('/api/releases/run', values); if (epoch !== generation) return;
      selectedId = job.id; releaseState.jobs.unshift(job); releaseState.busy = true; releaseState.active = { id: job.id, workspace: state.settings.workspace, operation: 'run' };
      renderResults(); el('release-monitor-title').scrollIntoView({ block: 'nearest' }); await refreshResults();
    } catch (error) { if (epoch === generation) el('release-run-error').textContent = t(error.message); }
    finally { formBusy = false; updateControls(); }
  });
  const uploadConfigured = job => job?.apple ? releaseState.configuredTeamIds?.includes(job.apple.teamId) : job?.signing ? apple.selections[job.plan.flavor || '']?.teamId === job.signing.teamId && apple.selections[job.plan.flavor || '']?.bundleId === job.signing.bundleId : releaseState.uploadConfigured;
  function renderApple(preserve = false) {
    const flavor = el('release-flavor').value, saved = apple.selections[flavor], selected = preserve ? {teamId:el('release-apple-team').value,appId:el('release-apple-app').value} : saved;
    el('release-apple-team').innerHTML = `<option value="">${text(appleLoading ? 'Loading teams…' : 'Choose an Apple team')}</option>` + apple.teams.map(team => `<option value="${escape(team.teamId)}">${escape(team.name)} · ${escape(team.teamId)}</option>`).join('');
    el('release-apple-team').value = selected?.teamId || '';
    renderApps(selected?.appId);
    el('release-apple-teams').innerHTML = apple.teams.map(team => `<article><div><strong>${escape(team.name)}</strong><small>${escape(team.teamId)} · ${team.apps.length} ${text('apps')}</small></div><div class="release-team-actions"><button type="button" class="button" data-apple-edit="${escape(team.teamId)}">${text('Update key')}</button><button type="button" class="button" data-apple-remove="${escape(team.teamId)}" ${releaseState.busy || !localOnly() || window.SNAPKIT_PREVIEW ? 'disabled' : ''}>${text('Disconnect team')}</button></div></article>`).join('');
    el('release-apple-team').disabled = appleLoading || appleSaving || !localOnly();
  }
  function renderApps(appId = '') {
    const team = apple.teams.find(team => team.teamId === el('release-apple-team').value), saved = apple.selections[el('release-flavor').value];
    el('release-apple-app').innerHTML = `<option value="">${text(team && !team.apps.length ? 'No accessible apps in this team' : 'Choose an app')}</option>` + (team?.apps || []).map(app => `<option value="${escape(app.id)}">${escape(app.name)} · ${escape(app.bundleId)}</option>`).join('');
    el('release-apple-app').value = appId;
    el('release-apple-app').disabled = !team || appleLoading || appleSaving || !localOnly();
    el('release-apple-binding').textContent = saved && team?.teamId === saved.teamId && appId === saved.appId ? `${t('Saved for')} ${el('release-flavor').value || t('Default (no flavor)')} · ${saved.bundleId}` : t('Choose a team and app for managed signing or upload.');
    el('release-apple-refresh').disabled = !team || appleLoading || appleSaving || !localOnly();
  }
  async function loadApple() {
    if (!state.settings.workspace || !localOnly() || appleLoading) return;
    const epoch = generation, request = ++appleEpoch; appleLoading = true; renderApple(); updateControls(); setAppleError('release-apple-error', '');
    try { const result = await api('/api/apple/teams'); if (epoch === generation && request === appleEpoch) apple = result; }
    catch (error) { if (epoch === generation && request === appleEpoch) setAppleError('release-apple-error', error.message); }
    finally { if (epoch === generation && request === appleEpoch) { appleLoading = false; renderApple(); updateControls(); } }
  }
  el('release-apple-team').addEventListener('change', () => { renderApps(); updateControls(); });
  el('release-apple-app').addEventListener('change', async () => {
    const epoch = generation, flavor = el('release-flavor').value, teamId = el('release-apple-team').value, appId = el('release-apple-app').value;
    if (!teamId || !appId || appleSaving) return;
    appleSaving = true; setAppleError('release-apple-error', ''); updateControls(); el('release-apple-team').disabled = true; el('release-apple-app').disabled = true;
    try { const saved = await api('/api/apple/selection', { flavor, teamId, appId }); if (epoch === generation) apple.selections[flavor] = saved; }
    catch (error) { if (epoch === generation) setAppleError('release-apple-error', error.message); }
    finally { if (epoch === generation) { appleSaving = false; renderApple(); updateControls(); } }
  });
  const showConnection = () => { if (window.SnapkitAppleGuide) window.SnapkitAppleGuide.open('keys'); else { el('release-credentials').open = true; el('release-team-name').focus(); } };
  el('release-apple-connect').addEventListener('click', showConnection);
  el('release-credentials').addEventListener('toggle', async () => {
    if (!el('release-credentials').open || !localOnly() || !state.settings.workspace) return;
    const epoch = generation;
    try { const result = await api('/api/apple/detected'); if (epoch !== generation) return;
      detectedTeams = result.teams; renderSuggestions();
      const candidates = detectedTeams.filter(team => team.source === 'project');
      if (!el('release-team-id').value && candidates.length === 1) { el('release-team-id').value = candidates[0].teamId; if (!el('release-team-name').value) el('release-team-name').value = candidates[0].name || ''; }
    } catch { if (epoch === generation) { detectedTeams = []; renderSuggestions(); } }
  });
  function renderSuggestions() {
      el('release-team-suggestions').innerHTML = detectedTeams.length ? text('Detected on this Mac:') + ' ' + detectedTeams.map(team => `<button type="button" class="button" data-apple-suggest="${escape(team.teamId)}" data-apple-name="${escape(team.name)}">${escape(team.name || team.teamId)} · ${escape(team.teamId)}</button>`).join(' ') : text('Find your Team ID at developer.apple.com/account → Membership details.');
  }
  el('release-credentials').addEventListener('click', event => {
    const suggest = event.target.closest('[data-apple-suggest]'), edit = event.target.closest('[data-apple-edit]'), remove = event.target.closest('[data-apple-remove]');
    if (remove) busy(remove, async () => { const epoch = generation; if (!confirm(t('Remove this team connection? Saved IPAs keep their original destination.'))) return; const result = await api(`/api/apple/teams/${remove.dataset.appleRemove}/remove`, {}); if (epoch !== generation) return; apple = result; renderApple(); await refreshResults(); });
    if (suggest) { el('release-team-id').value = suggest.dataset.appleSuggest; if (suggest.dataset.appleName) el('release-team-name').value = suggest.dataset.appleName; }
    if (edit) { const team = apple.teams.find(team => team.teamId === edit.dataset.appleEdit); el('release-key-form').reset(); el('release-team-id').value = team.teamId; el('release-team-name').value = team.name; el('release-key-id').focus(); }
  });
  el('release-key-form').addEventListener('submit', event => { event.preventDefault(); const epoch = generation; busy(el('release-key-form').querySelector('button[type=submit]'), async () => {
    setAppleError('release-key-error', '');
    try { const result = await api('/api/apple/teams', { teamId: el('release-team-id').value, name: el('release-team-name').value, keyId: el('release-key-id').value, issuerId: el('release-issuer').value, keyPath: el('release-key-path').value }); if (epoch !== generation) return; apple = result; el('release-key-form').reset(); renderApple(); await refreshResults(); toast('Apple team connected'); }
    catch (error) { if (epoch === generation) setAppleError('release-key-error', error.message); }
  }); });
  el('release-apple-refresh').addEventListener('click', () => busy(el('release-apple-refresh'), async () => { const teamId = el('release-apple-team').value, epoch = generation; setAppleError('release-apple-error', ''); try { const result = await api(`/api/apple/teams/${teamId}/refresh`, {}); if (epoch !== generation) return; apple = result; renderApple(true); updateControls(); } catch (error) { if (epoch === generation) setAppleError('release-apple-error', error.message); } }));
  el('release-key-path').addEventListener('input', () => { const match = /(?:^|[\\/])AuthKey_([A-Z0-9]{10})\.p8$/.exec(el('release-key-path').value.trim()); if (match) el('release-key-id').value = match[1]; });
  document.querySelectorAll('[data-release-file]').forEach(button => button.addEventListener('click', () => busy(button, async () => { const value = await window.snapkitDesktop?.chooseReleaseFile(button.dataset.releaseFile); if (value) { el(button.dataset.releaseFile === 'private-key' ? 'release-key-path' : 'release-export-options').value = value; el(button.dataset.releaseFile === 'private-key' ? 'release-key-path' : 'release-export-options').dispatchEvent(new Event('input', {bubbles:true})); updateControls(); } })));
  el('release-upload-confirm').addEventListener('click', () => busy(el('release-upload-confirm'), async () => {
    el('release-upload-error').textContent = '';
    try { await api(`/api/releases/${uploadId}/upload`, { confirm: uploadId }); el('release-upload-dialog').close(); await refreshResults(); }
    catch (error) { el('release-upload-error').textContent = t(error.message); }
  }));
  el('panel-releases').addEventListener('click', event => {
    const button = event.target.closest('[data-release-select],[data-release-cancel],[data-release-delete],[data-release-download],[data-release-upload]'); if (!button) return;
    if (button.dataset.releaseSelect) { selectedId = button.dataset.releaseSelect; detail = null; renderResults(); refreshResults(); return; }
    if (button.dataset.releaseUpload) {
      const job = releaseState.jobs.find(item => item.id === button.dataset.releaseUpload);
      if (!uploadConfigured(job)) {
        document.querySelector('[name="release-format"][value="ipa"]').checked = true;
        el('release-flavor').value = job.plan.flavor || ''; el('release-use-apple').checked = true; renderApple(); updateControls();
        setAppleError('release-apple-error', 'Choose the Apple team and app matching this saved IPA.');
        if (!apple.teams.length) { if (job.signing) el('release-team-id').value = job.signing.teamId; showConnection(); } else el('release-apple-selection').scrollIntoView({behavior:'smooth',block:'center'});
        return;
      }
      uploadId = job.id;
      el('release-upload-summary').textContent = [title(job.plan.format), job.plan.flavor || t('Default (no flavor)'), job.plan.buildName || '', job.plan.buildNumber ? '#' + job.plan.buildNumber : '', job.plan.target, (job.apple || apple.selections[job.plan.flavor || '']) ? (() => { const target = job.apple || apple.selections[job.plan.flavor || '']; return `${target.teamName} · ${target.teamId} · ${target.appName} · ${target.bundleId}`; })() : '', job.artifacts[0]?.name, job.uploadStatus === 'unknown' ? t('A previous upload may have reached Apple. Check App Store Connect before retrying.') : ''].filter(Boolean).join(' · ');
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
  document.addEventListener('snapkit:page', event => { if (event.detail === 'releases') { resetWorkspace(); if (!catalog) loadCatalog(); loadApple(); refreshResults(); } });
  document.addEventListener('snapkit:state', () => { updateControls(); if (resetWorkspace() && activePage === 'releases') { loadCatalog(); loadApple(); refreshResults(); } });
  document.addEventListener('snapkit:language', () => { renderApple(true); renderSuggestions(); for (const id of ['release-key-error','release-apple-error']) setAppleError(id, el(id).dataset.source || ''); renderResults(); });
  setInterval(() => { if (!document.hidden && activePage === 'releases') refreshResults(); }, 1500);
  resetWorkspace();
})();
