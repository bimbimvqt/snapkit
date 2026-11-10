import { t, $, $$, escape, icon, icons, busy, api, toast, state, connection, showWorkspace } from '../../legacy/device-controller.js';
import macMiniImage from './assets/mac-mini.webp';
import macStudioImage from './assets/mac-studio.webp';
import macbookImage from './assets/macbook.webp';
import windowsImage from './assets/windows.webp';
/* Product navigation and guided setup. Device operations remain in app.js. */
let product = null, toolState = null, activePage = 'devices', productLoading = false;
let toolPromise = null, toolError = '', setupEpoch = 0;
const productEditors = [
  ['vscode', 'Visual Studio Code', 'Extension available', 'code-xml'],
  ['cursor', 'Cursor', 'Extension available', 'mouse-pointer-2'],
  ['antigravity', 'Antigravity', 'Extension available', 'orbit']
];
function showProductPage(page) {
  if (document.body.dataset.developerRole === 'backend' && ['devices', 'setup', 'sets', 'logs', 'captures', 'releases', 'guide'].includes(page)) page = 'backend';
  if (!['backend', 'devices', 'setup', 'preferences', 'plan', 'guide', 'sets', 'logs', 'captures', 'releases', 'updates'].includes(page)) return;
  activePage = page;
  $$('.app-panel').forEach(panel => panel.classList.toggle('hidden', panel.id !== `panel-${page}`));
  $$('[data-app-page]').forEach(button => { button.classList.toggle('active', (button.dataset.appPage === page || (page === 'backend' && button.dataset.appPage === 'devices'))); button.setAttribute('aria-current', (button.dataset.appPage === page || (page === 'backend' && button.dataset.appPage === 'devices')) ? 'page' : 'false'); });
  $('#breadcrumb-page').textContent = { backend: 'Backend', updates: t('Updates'), releases: t("Build & release"), devices: t("Devices"), setup: t("Setup & tools"), preferences: t("Preferences"), guide: t("Quick start guide"), sets: t("Device sets"), logs: t("Device logs"), captures: t("Captures"), plan: t("Your plan") }[page];
  if (page === 'preferences' && !toolState) void checkTools();
  if (page === 'setup') { if (!product) void loadProduct(); if (!toolState) void checkTools(); updateSetupView(); }
  document.dispatchEvent(new CustomEvent('snapkit:page', { detail: page }));
  window.scrollTo({ top: 0, behavior: 'instant' });
  const heading = $(`#panel-${page} h1`); heading?.setAttribute('tabindex', '-1'); heading?.focus({ preventScroll: true });
}
$$('[data-app-page]').forEach(button => button.addEventListener('click', () => showProductPage(button.dataset.appPage)));
$$('[data-go]').forEach(button => button.addEventListener('click', () => showProductPage(button.dataset.go)));
$('#journey-project').addEventListener('click', showWorkspace);
$('#journey-device').addEventListener('click', () => { $('#add-device').click(); });
let journeyInitialized = false, journeyHasState = !!state.scannedAt;
$('#setup-card>summary').addEventListener('click', () => { journeyInitialized = true; });
function updateJourney() {
  $('#journey-workspace').textContent = state.settings.workspace ? state.settings.workspace.split(/[\\/]/).filter(Boolean).at(-1) : t(document.body.dataset.framework === 'react-native' ? "Connect a React Native project" : "Connect a Flutter project");
  const online = state.devices.filter(device => device.state === 'online').length;
  $('#journey-devices').textContent = online ? t("{0} device{1} ready to use", [online, online === 1 ? '' : 's']) : t("Create one or connect your phone");
  $('#journey-project .step-number').classList.toggle('complete', !!state.settings.workspace);
  $('#journey-device .step-number').classList.toggle('complete', online > 0);
  $('#journey-progress').textContent = state.settings.workspace && online ? t('Project connected · {0} online', [online]) : t('Connect project → Start devices → Debug');
  if (product && journeyHasState && !journeyInitialized) {
    $('#setup-card').open = !product.preferences?.onboardingComplete && !(state.settings.workspace && online > 0);
    journeyInitialized = true;
  }
}
document.addEventListener('snapkit:state', () => { journeyHasState = true; updateJourney(); });
function renderEditors() {
  const selected = productEditors.some(([id]) => id === product?.preferences?.editor) ? product.preferences.editor : 'vscode';
  $('#editor-options').innerHTML = productEditors.map(([id, name, detail, symbol]) => `<button type="button" class="editor-option ${selected === id ? 'chosen' : ''}" data-editor="${id}" aria-pressed="${selected === id}">${icon(symbol)}<strong>${escape(t(name))}</strong><small>${escape(t(detail))}</small>${selected === id ? icon('circle-check') : ''}</button>`).join('');
  $('#extension-download').classList.remove('hidden');
  const name = productEditors.find(([id]) => id === selected)[1];
  $('#editor-help').textContent = document.body.dataset.framework === 'react-native' ? t('Install Snapkit Debug Sync 1.6.0 in your editor. Select Snapkit React Native in Run and Debug, then press F5.') : t("In {0}, install Snapkit Debug Sync and press F5 to debug on your selected devices.", [name]);
  if (window.SNAPKIT_PREVIEW || window.SNAPKIT_CONTROLLER) $('#extension-download').href = 'https://github.com/bimbimvqt/snapkit/releases/latest';
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
  product.preferences = result.preferences; $('#setup-card').open = false; toast(t("You can reopen Quick setup anytime."));
}));
function updateSetupView() {
  const ready = !!product && !!toolState;
  const loading = !!toolPromise || productLoading;
  $('#setup-content').classList.toggle('hidden', !ready);
  $('#setup-content').setAttribute('aria-busy', String(loading));
  $('#setup-loading').classList.toggle('hidden', ready || !!toolError);
  $('#setup-error').classList.toggle('hidden', !toolError);
  $('#setup-error-message').textContent = toolError ? t(toolError) + ' ' + t('Reconnect your local Snapkit app, then check again.') : '';
  $('#setup-status').textContent = loading || (!ready && !toolError) ? t(ready ? 'Refreshing tool checks…' : 'Checking your tools…') : '';
  $('#refresh-tools').disabled = loading;
  $('#refresh-tools').setAttribute('aria-busy', String(loading));
  $('#check-tools').disabled = loading;
  $('#check-tools').setAttribute('aria-busy', String(loading));
  $('#setup-retry').disabled = loading;
}
function invalidateTools() {
  setupEpoch++; toolPromise = null; toolState = null; toolError = ''; updateSetupView();
}
function checkTools({ fresh = false } = {}) {
  if (toolPromise) return toolPromise;
  const epoch = setupEpoch;
  toolError = '';
  // Defer the request until the promise is assigned so loading is visible immediately.
  toolPromise = Promise.resolve().then(async () => {
    try {
      const result = await api('/api/diagnostics' + (fresh ? '?fresh=1' : ''));
      if (epoch !== setupEpoch) return;
      toolState = result; renderTools();
    } catch (error) { if (epoch === setupEpoch) toolError = error.message; }
    finally { if (epoch === setupEpoch) { toolPromise = null; updateSetupView(); } }
  });
  updateSetupView(); return toolPromise;
}
$('#setup-retry').addEventListener('click', () => {
  toolError = '';
  if (!product) void loadProduct();
  void checkTools({ fresh: true });
});
function renderTools() {
      const computer = toolState.computer || {};
      const osName = computer.osName || { darwin: 'macOS', win32: 'Windows', linux: 'Linux' }[toolState.platform] || t('This computer');
      $('#computer-label').textContent = computer.model || osName;
      $('#computer-subtitle').textContent = computer.chip || t('This computer');
      const art = $('#computer-art');
      const imageKind = toolState.platform === 'win32' ? 'windows' : toolState.platform === 'darwin' ? ({ mini: 'mini', studio: 'studio', laptop: 'macbook' }[computer.form] || (/Mac Studio/i.test(computer.model || '') ? 'studio' : null)) : null;
      const computerImages = { mini: macMiniImage, studio: macStudioImage, macbook: macbookImage, windows: windowsImage };
      art.className = `computer-art${imageKind ? ` computer-art-${imageKind}` : ''}`;
      art.innerHTML = imageKind ? `<img src="${computerImages[imageKind]}" alt="" width="280" height="156" decoding="async">` : icon(computer.form === 'laptop' ? 'laptop' : 'monitor');
      const rows = [['Name', computer.name], ['Chip', computer.chip], ['Memory', toolState.memoryGB ? `${toolState.memoryGB} GB` : null], ['Architecture', toolState.arch?.toUpperCase()], ['Available storage', toolState.freeDiskGB != null ? `${toolState.freeDiskGB} GB` : null]];
      $('#computer-specs').innerHTML = rows.filter(([, value]) => value).map(([label, value]) => `<div class="computer-row"><dt>${escape(t(label))}</dt><dd>${escape(value)}</dd></div>`).join('');
      $('#computer-os-name').textContent = osName;
      $('#computer-os-version').textContent = computer.osVersion || t('Version unavailable');
      $('#computer-advice').textContent = t(toolState.advice);
      $('#tool-checks').innerHTML = [...toolState.checks].sort((a, b) => Number(a.status === 'ready') - Number(b.status === 'ready')).map(check => `<article class="tool-check ${check.status}"><span class="tool-symbol">${icon(check.status === 'ready' ? 'check' : 'wrench')}</span><div><div class="tool-title"><h3>${escape(t(check.title))}</h3><span>${check.status === 'ready' ? t("Ready") : t("Needs setup")}</span></div>${check.status === 'ready' ? `<details class="interface-details"><summary>${t("More details")}</summary><p>${escape(t(check.detail))}</p></details>` : `<p>${escape(t(check.detail))}</p>`}${check.status !== 'ready' ? `<a class="text-link" href="${escape(check.help)}" target="_blank" rel="noopener noreferrer">${t("Open setup guide")} ${icon('arrow-up-right')}</a>` : ''}</div></article>`).join('');
      const ready = toolState.checks.filter(check => check.status === 'ready').length;
      const missing = toolState.checks.length - ready;
      $('#readiness-summary').textContent = t(missing ? '{0} ready · {1} need setup' : '{0} tools ready. Choose your project and devices.', missing ? [ready, missing] : [ready]);
      $('#journey-tools').textContent = t("{0} of {1} tools ready", [ready, toolState.checks.length]);
      $('[data-go="setup"] .step-number').classList.toggle('complete', toolState.ready);
      $('#storage-locations').innerHTML = Object.entries(toolState.storage || {}).filter(([,value]) => value).map(([name,value]) => `<dt>${escape({ root: t("Snapkit settings"), android: t("Android devices"), ios: t("iOS devices") }[name] || name)}</dt><dd>${escape(value)}</dd>`).join('');
      icons();
}
$('#check-tools').addEventListener('click', () => checkTools({ fresh: true }));
$('#refresh-tools').addEventListener('click', () => checkTools({ fresh: true }));
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
      invalidateTools();
    } catch (error) { $('#preferences-error').textContent = t(error.message); }
  });
});
$('#restart-desktop').addEventListener('click', () => window.snapkitDesktop?.restart());
if (window.snapkitDesktop) {
  $('#connection-button').classList.add('hidden');
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="https://"]');
    if (link) { event.preventDefault(); window.snapkitDesktop.openExternal(link.href).catch(error => toast(error.message, true)); }
  });
}
async function loadProduct() {
  if ((window.SNAPKIT_CONTROLLER && !connection) || productLoading) return;
  productLoading = true; updateSetupView();
  try {
    product = await api('/api/product');

    $('#pref-flutter').value = product.preferences?.flutterSDK || '';
    $('#pref-android').value = product.preferences?.androidSDK || '';
    renderEditors(); updateJourney();
    if (window.snapkitDesktop && !product.preferences?.onboardingComplete) await checkTools();
  } catch { if (!product) toolError = 'Could not load setup information.'; }
  finally { productLoading = false; updateSetupView(); }
}
document.addEventListener('snapkit:state', () => { if (!product && (!window.SNAPKIT_CONTROLLER || connection)) loadProduct(); });
loadProduct();

document.addEventListener('snapkit:language', () => {
  renderEditors(); updateJourney();
  $('#breadcrumb-page').textContent = t({ backend: 'Backend', updates: 'Updates', releases: 'Build & release', devices: 'Devices', setup: 'Setup & tools', preferences: 'Preferences', plan: 'Your plan', guide: 'Quick start guide', sets: 'Device sets', logs: 'Device logs', captures: 'Captures' }[activePage]);
  if (toolState) renderTools();
  updateSetupView();
});
window.snapkitDesktop?.setLanguage?.(window.SnapkitI18n.language).catch(() => {});

document.addEventListener('snapkit:navigate', event => showProductPage(event.detail));
export { activePage, showProductPage };

document.addEventListener('snapkit:profile', () => { invalidateTools(); updateJourney(); renderEditors(); renderFrameworkGuidance(); if (activePage === 'setup') void checkTools(); });

const frameworkGuidance = [
  [
    "#guide-tools > p",
    "Install Flutter and Android SDK for Android devices on macOS or Windows. For iOS Simulator, use macOS with Xcode, its command-line tools and an installed iOS runtime. Windows cannot run iOS Simulator.",
    "Install Node.js LTS and the Android SDK for React Native. For iOS Simulator, use macOS with Xcode and CocoaPods. Check your project’s React Native environment requirements."
  ],
  [
    "#guide-tools > .tool-note",
    "Check each tool, accept Android SDK licenses and save custom SDK paths in Preferences if detection fails.",
    "Snapkit discovers Android devices with ADB and iOS simulators with Xcode. Flutter is not required for React Native."
  ],
  [
    "#guide-project > p",
    "Choose the folder containing pubspec.yaml. Import a VS Code debug profile or select the flavor, Dart entrypoint and defines file. Snapkit stores these choices locally without changing your source or launch.json.",
    "Choose the folder containing package.json with a react-native dependency. Native android or ios folders are required for IDE debug. Expo projects need prebuild; Expo Go is not supported."
  ],
  [
    "#guide-project > .tool-note",
    "Moved your project? Choose its new folder again. Saved device sets belong to the original folder; Snapkit does not scan your disks to relocate source code.",
    "Snapkit detects your framework and stores project settings locally. Build & release for React Native is coming soon."
  ],
  [
    "#guide-debug > p",
    "In VS Code, Cursor or Antigravity, install Snapkit Debug Sync and the Dart/Flutter extensions. Open the same project, select online devices in Snapkit and press F5 in your normal Flutter profile.",
    "Install Snapkit Debug Sync 1.6.0 in VS Code, Cursor or Antigravity. Select online devices, choose Snapkit React Native in Run and Debug, then press F5."
  ],
  [
    "#guide-debug > .tool-note",
    "Android Studio and IntelliJ use their own device selector and debug controls. Hot Reload, Dart output and DevTools stay in your IDE. A new Snapkit selection applies to the next debug run.",
    "Snapkit launches each device and attaches its Hermes debugger. Stop devices independently. Supports Android and iOS Simulator; use Xcode for a physical iPhone. Fast Refresh stays in React Native/Metro."
  ],
  [
    "#guide-logs > p",
    "Select an online Android device or iOS Simulator, then start logs. Search by app name, package or message and filter warnings/errors. Pause following to read a line, or export the visible filtered log.",
    "Select an online Android device or iOS Simulator to read system logs. Filter by app name or message and export what you need."
  ],
  [
    "#guide-logs > .tool-note",
    "These are system logs, not the Flutter Debug Console. Keep the IDE open for Dart print output. Snapkit retains the latest 1,000 lines per stream and stops streams without a viewer after one minute.",
    "Keep your editor and Metro open for JavaScript output. Snapkit shows device system logs; Fast Refresh stays in React Native/Metro."
  ],
  [
    "#panel-setup .extension-card .interface-details-body > p:last-child",
    "VS Code: Extensions → … → Install from VSIX. Install the extension in Cursor or Antigravity too. Keep Dart and Flutter extensions installed.",
    "Install Snapkit Debug Sync from VSIX. The Snapkit React Native profile uses the built-in JavaScript debugger. Install the extension in Cursor or Antigravity too."
  ]
];
function renderFrameworkGuidance() {
 const backend = document.body.dataset.developerRole === 'backend';
 const home = $('.sidebar [data-app-page="devices"]');
 for (const node of home.childNodes) if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) node.textContent = backend ? 'Backend' : t('Devices');
 home.setAttribute('aria-label', backend ? 'Backend' : t('Devices'));
 home.title = backend ? 'Backend' : t('Devices');
 const native = document.body.dataset.framework === "react-native";
 for (const [selector, flutter, reactNative] of frameworkGuidance) { const node = $(selector); if (node) node.textContent = t(native ? reactNative : flutter); }
}
document.addEventListener("snapkit:language", renderFrameworkGuidance);
