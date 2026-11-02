/* Product navigation and guided setup. Device operations remain in app.js. */
let product = null, toolState = null, activePage = 'devices', productLoading = false;
const productEditors = [
  ['vscode', 'Visual Studio Code', 'Extension available', 'code-xml'],
  ['cursor', 'Cursor', 'Extension · beta', 'mouse-pointer-2'],
  ['antigravity', 'Antigravity', 'Extension · beta', 'orbit'],
  ['android-studio', 'Android Studio', 'Device management', 'bot'],
  ['intellij', 'IntelliJ IDEA', 'Device management', 'braces'],
  ['other', 'Another editor', 'Device management', 'terminal']
];
function showProductPage(page) {
  if (!['devices', 'setup', 'preferences', 'plan'].includes(page)) return;
  activePage = page;
  $$('.app-panel').forEach(panel => panel.classList.toggle('hidden', panel.id !== `panel-${page}`));
  $$('[data-app-page]').forEach(button => { button.classList.toggle('active', button.dataset.appPage === page); button.setAttribute('aria-current', button.dataset.appPage === page ? 'page' : 'false'); });
  $('#breadcrumb-page').textContent = { devices: t("Devices"), setup: t("Setup & tools"), preferences: t("Preferences"), plan: t("Your plan") }[page];
  if (page === 'setup' && !toolState) checkTools();
  window.scrollTo({ top: 0, behavior: 'instant' });
  const heading = $(`#panel-${page} h1`); heading?.setAttribute('tabindex', '-1'); heading?.focus({ preventScroll: true });
}
$$('[data-app-page]').forEach(button => button.addEventListener('click', () => showProductPage(button.dataset.appPage)));
$$('[data-go]').forEach(button => button.addEventListener('click', () => showProductPage(button.dataset.go)));
$('#journey-project').addEventListener('click', showWorkspace);
$('#journey-device').addEventListener('click', () => { $('#add-device').click(); });
function updateJourney() {
  $('#journey-workspace').textContent = state.settings.workspace ? state.settings.workspace.split(/[\\/]/).filter(Boolean).at(-1) : t("Connect a Flutter project");
  const online = state.devices.filter(device => device.state === 'online').length;
  $('#journey-devices').textContent = online ? t("{0} device{1} ready to use", [online, online === 1 ? '' : 's']) : t("Create one or connect your phone");
  $('#journey-project .step-number').classList.toggle('complete', !!state.settings.workspace);
  $('#journey-device .step-number').classList.toggle('complete', online > 0);
}
document.addEventListener('snapkit:state', updateJourney);
function renderEditors() {
  const selected = product?.preferences?.editor || 'vscode';
  $('#editor-options').innerHTML = productEditors.map(([id, name, detail, symbol]) => `<button type="button" class="editor-option ${selected === id ? 'chosen' : ''}" data-editor="${id}" aria-pressed="${selected === id}">${icon(symbol)}<strong>${escape(t(name))}</strong><small>${escape(t(detail))}</small>${selected === id ? icon('circle-check') : ''}</button>`).join('');
  const extension = ['vscode', 'cursor', 'antigravity'].includes(selected);
  $('#extension-download').classList.toggle('hidden', !extension);
  $('#editor-help').textContent = extension ? t("Install Snapkit Debug Sync, choose a normal Flutter debug profile in your editor, then start Debug. Your selected devices are used for the next run.") : t("Start your devices here, then choose them in your editor’s own device selector. Group debug and coordinated restart are not integrated with this editor yet.");
  if (window.SNAPKIT_PREVIEW || window.SNAPKIT_CONTROLLER) $('#extension-download').href = 'https://github.com/bimbimvqt/snapkit/releases/tag/v0.2.0-beta.5';
  icons();
}
$('#editor-options').addEventListener('click', event => {
  const button = event.target.closest('[data-editor]'); if (!button) return;
  busy(button, async () => {
    const result = await api('/api/preferences', { editor: button.dataset.editor });
    product.preferences = result.preferences; renderEditors();
    toast(t("Editor preference saved"));
  });
});
$('#hide-welcome').addEventListener('click', event => busy(event.currentTarget, async () => {
  const result = await api('/api/preferences', { onboardingComplete: true });
  product.preferences = result.preferences; $('#setup-card').classList.add('hidden'); toast(t("You can find this guidance in Setup & tools."));
}));
async function checkTools() {
  await busy($('#check-tools'), async () => {
    $('#tool-checks').setAttribute('aria-busy', 'true');
    try {
      toolState = await api('/api/diagnostics?fresh=1');
      renderTools();
    } catch (error) { $('#tool-checks').innerHTML = `<div class="product-note">${icon('wifi-off')}<p>${escape(t(error.message))} ${t('Reconnect your local Snapkit app, then check again.')}</p></div>`; icons(); }
    finally { $('#tool-checks').removeAttribute('aria-busy'); }
  });
}
function renderTools() {
      const osName = { darwin: 'macOS', win32: 'Windows', linux: 'Linux' }[toolState.platform] || t("This computer");
      $('#computer-label').textContent = `${osName} · ${toolState.arch === 'arm64' ? 'Apple Silicon / ARM64' : 'Intel / AMD'}${toolState.memoryGB ? t(" · {0} GB memory", [toolState.memoryGB]) : ''}`;
      $('#computer-advice').textContent = t(toolState.advice);
      $('#tool-checks').innerHTML = toolState.checks.map(check => `<article class="tool-check ${check.status}"><span class="tool-symbol">${icon(check.status === 'ready' ? 'check' : 'wrench')}</span><div><div class="tool-title"><h3>${escape(t(check.title))}</h3><span>${check.status === 'ready' ? t("Ready") : t("Needs setup")}</span></div><p>${escape(t(check.detail))}</p>${check.status !== 'ready' ? `<a class="text-link" href="${escape(check.help)}" target="_blank" rel="noopener noreferrer">${t("Open setup guide")} ${icon('arrow-up-right')}</a>` : ''}</div></article>`).join('');
      const ready = toolState.checks.filter(check => check.status === 'ready').length;
      $('#journey-tools').textContent = t("{0} of {1} tools ready", [ready, toolState.checks.length]);
      $('[data-go="setup"] .step-number').classList.toggle('complete', toolState.ready);
      $('#storage-locations').innerHTML = Object.entries(toolState.storage || {}).filter(([,value]) => value).map(([name,value]) => `<dt>${escape({ root: t("Snapkit settings"), android: t("Android devices"), ios: t("iOS devices") }[name] || name)}</dt><dd>${escape(value)}</dd>`).join('');
      icons();
}
$('#check-tools').addEventListener('click', checkTools);
for (const kind of ['flutter', 'android']) {
  $(`#browse-${kind}-sdk`).addEventListener('click', event => busy(event.currentTarget, async () => {
    $('#preferences-error').textContent = ''; $('#preferences-result').textContent = '';
    try {
      const result = await api('/api/folders/pick', { purpose: `${kind}SDK`, language: window.SnapkitI18n.language });
      if (result.path) {
        const input = $(`#pref-${kind}`);
        input.value = result.path; input.dispatchEvent(new Event('input', { bubbles: true })); input.focus();
        $('#preferences-result').textContent = t("Folder selected. Save preferences to apply this change.");
      }
    } catch (error) { $('#preferences-error').textContent = t(error.message); }
  }));
}
$('#preferences-form').addEventListener('submit', event => {
  event.preventDefault(); $('#preferences-error').textContent = '';
  busy($('#save-preferences'), async () => {
    try {
      const result = await api('/api/preferences', { flutterSDK: $('#pref-flutter').value, androidSDK: $('#pref-android').value });
      product.preferences = result.preferences; $('#preferences-result').textContent = t(result.message);
      $('#restart-desktop').classList.toggle('hidden', !window.snapkitDesktop);
      toolState = null;
    } catch (error) { $('#preferences-error').textContent = t(error.message); }
  });
});
$('#restart-desktop').addEventListener('click', () => window.snapkitDesktop?.restart());
$('#check-updates').addEventListener('click', event => busy(event.currentTarget, async () => {
  if (!window.snapkitDesktop) { $('#update-status').textContent = t("Desktop downloads and release notes are available on GitHub."); $('#update-download').href = 'https://github.com/bimbimvqt/snapkit/releases'; $('#update-download').classList.remove('hidden'); return; }
  try {
    const update = await window.snapkitDesktop.checkUpdates();
    const current = await window.snapkitDesktop.version();
    $('#update-status').textContent = !update.version || update.version === current.version ? t("You’re using the latest available beta.") : t("Snapkit {0} is available. Close your work when ready, then download the update.", [update.version]);
    if (update.url && update.version !== current.version) {
      const url = new URL(update.url);
      if (url.origin !== 'https://github.com' || !url.pathname.startsWith('/bimbimvqt/snapkit/releases/')) throw new Error(t("Invalid release link"));
      $('#update-download').href = url.href; $('#update-download').classList.remove('hidden');
    }
  } catch { $('#update-status').textContent = t("Could not reach the update service. Keep using Snapkit offline and try again later."); }
}));
if (window.snapkitDesktop) {
  $('#connection-button').classList.add('hidden');
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="https://"]');
    if (link) { event.preventDefault(); window.snapkitDesktop.openExternal(link.href).catch(error => toast(error.message, true)); }
  });
}
async function loadProduct() {
  if ((window.SNAPKIT_CONTROLLER && !connection) || productLoading) return;
  productLoading = true;
  try {
    product = await api('/api/product');
    $('#product-version').textContent = product.version;
    $('#setup-card').classList.toggle('hidden', !!product.preferences?.onboardingComplete);
    $('#pref-flutter').value = product.preferences?.flutterSDK || '';
    $('#pref-android').value = product.preferences?.androidSDK || '';
    renderEditors(); updateJourney();
    if (window.snapkitDesktop && !product.preferences?.onboardingComplete) await checkTools();
  } catch { /* Device management remains available if optional product details cannot load. */ }
  finally { productLoading = false; }
}
document.addEventListener('snapkit:state', () => { if (!product && (!window.SNAPKIT_CONTROLLER || connection)) loadProduct(); });
loadProduct();

document.addEventListener('snapkit:language', () => {
  renderEditors(); updateJourney();
  $('#breadcrumb-page').textContent = t({ devices: 'Devices', setup: 'Setup & tools', preferences: 'Preferences', plan: 'Your plan' }[activePage]);
  if (toolState) renderTools();
});
window.snapkitDesktop?.setLanguage?.(window.SnapkitI18n.language).catch(() => {});
