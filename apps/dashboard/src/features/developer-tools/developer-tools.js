import { t, $, escape, busy, api, state, loadState, toast, showWorkspace, connection } from '../../legacy/device-controller.js';
import './developer-tools.css';

let context = '', epoch = 0, profiles = [], doctor = null;
const key = () => JSON.stringify([state.settings.spaceId, state.settings.workspace, state.settings.framework, state.settings.flavor, state.settings.target, state.settings.defineFile]);
function render() {
  const connected = !!state.settings.workspace && state.settings.framework !== 'backend';
  $('#run-profile-save').disabled = !connected;
  $('#doctor-check').disabled = !connected || $('#doctor-check').getAttribute('aria-busy') === 'true';
  $('#doctor-project').textContent = state.settings.workspace || t('Choose a project first.');
  $('#run-profile-list').innerHTML = profiles.length ? profiles.map(profile => `<article class="run-profile"><div><strong>${escape(profile.name)}</strong><p>${escape(profile.framework === 'flutter' ? [profile.flavor || t('Default flavor'), profile.target, profile.defineFile].filter(Boolean).join(' · ') : 'React Native')} · ${escape(t('{0} saved devices', [profile.targetIds.length]))}</p></div><div class="tool-buttons"><button class="button" data-profile-activate="${escape(profile.id)}">${t('Use profile')}</button><button class="button" data-profile-delete="${escape(profile.id)}" aria-label="${escape(t('Delete profile {0}', [profile.name]))}">${t('Delete')}</button></div></article>`).join('') : `<p>${t('No saved run profiles. Save your current IDE setup to reuse it later.')}</p>`;
  $('#doctor-results').innerHTML = doctor ? `<p role="status">${t(doctor.ready ? 'Project checks passed' : 'Project needs attention')} · ${escape(new Date(doctor.checkedAt).toLocaleTimeString())}</p><div class="tool-checks">${doctor.checks.map(check => `<article class="tool-check ${check.status}"><div><h3>${escape(t(check.title))} · ${t(check.status === 'ready' ? 'Ready' : 'Needs setup')}</h3><p>${escape(t(check.detail))}</p></div></article>`).join('')}</div>` : `<p>${t('Check project dependencies, native folders and build tools before your next run.')}</p>`;
}
async function refreshProfiles() {
  if (window.SNAPKIT_CONTROLLER && !connection) return;
  const request = epoch;
  try { const result = await api('/api/run-profiles'); if (request === epoch) { profiles = result.profiles; $('#run-profile-error').textContent = ''; render(); } }
  catch (error) { if (request === epoch) $('#run-profile-error').textContent = t(error.message); }
}
function sync() {
  if (context === key()) return;
  context = key(); epoch++; profiles = []; doctor = null;
  $('#doctor-error').textContent = ''; $('#doctor-status').textContent = ''; $('#run-profile-error').textContent = ''; $('#run-profile-name').value = '';
  render(); void refreshProfiles();
}
$('#doctor-check').addEventListener('click', event => busy(event.currentTarget, async () => {
  const request = epoch;
  doctor = null; render();
  $('#doctor-error').textContent = ''; $('#doctor-status').textContent = t('Checking project…');
  try { const result = await api('/api/workspace/doctor'); if (request === epoch) { doctor = result; render(); } }
  catch (error) { if (request === epoch) $('#doctor-error').textContent = t(error.message); }
  finally { if (request === epoch) $('#doctor-status').textContent = ''; }
}));
$('#doctor-open-project').addEventListener('click', showWorkspace);
$('#run-profile-form').addEventListener('submit', event => {
  event.preventDefault();
  busy($('#run-profile-save'), async () => {
    const request = epoch;
    $('#run-profile-error').textContent = '';
    try {
      const result = await api('/api/run-profiles/save', {name: $('#run-profile-name').value});
      if (request !== epoch) return;
      profiles = result.profiles; $('#run-profile-name').value = ''; render(); toast('Run profile saved');
    } catch (error) { if (request === epoch) $('#run-profile-error').textContent = t(error.message); }
  });
});
$('#run-profile-list').addEventListener('click', event => {
  const button = event.target.closest('[data-profile-activate],[data-profile-delete]'); if (!button) return;
  busy(button, async () => {
    const request = epoch;
    const activate = !!button.dataset.profileActivate;
    $('#run-profile-error').textContent = '';
    try {
      const result = await api('/api/run-profiles/' + (activate ? 'activate' : 'delete'), {id: button.dataset.profileActivate || button.dataset.profileDelete});
      if (request !== epoch) return;
      profiles = result.profiles;
      if (activate) { await loadState(); toast('Run profile selected for the next IDE debug run'); }
      render();
    } catch (error) { if (request === epoch) $('#run-profile-error').textContent = t(error.message); }
  });
});
document.addEventListener('snapkit:state', sync);
document.addEventListener('snapkit:page', event => { if (event.detail === 'devices') void refreshProfiles(); });
document.addEventListener('snapkit:language', render);
sync();
