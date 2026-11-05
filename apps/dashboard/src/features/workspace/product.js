import { t, $, $$, escape, icon, icons, busy, api, toast, state, connection, showWorkspace } from '../../legacy/device-controller.js';
/* Product navigation and guided setup. Device operations remain in app.js. */
let product = null, toolState = null, activePage = 'devices', productLoading = false;
const productEditors = [
  ['vscode', 'Visual Studio Code', 'Extension available', 'code-xml'],
  ['cursor', 'Cursor', 'Extension · beta', 'mouse-pointer-2'],
  ['antigravity', 'Antigravity', 'Extension · beta', 'orbit']
];
function showProductPage(page) {
  if (document.body.dataset.developerRole === 'backend' && ['devices', 'setup', 'sets', 'logs', 'captures', 'releases', 'guide'].includes(page)) page = 'backend';
  if (!['backend', 'devices', 'setup', 'preferences', 'plan', 'guide', 'sets', 'logs', 'captures', 'releases', 'updates'].includes(page)) return;
  activePage = page;
  $$('.app-panel').forEach(panel => panel.classList.toggle('hidden', panel.id !== `panel-${page}`));
  $$('[data-app-page]').forEach(button => { button.classList.toggle('active', (button.dataset.appPage === page || (page === 'backend' && button.dataset.appPage === 'devices'))); button.setAttribute('aria-current', (button.dataset.appPage === page || (page === 'backend' && button.dataset.appPage === 'devices')) ? 'page' : 'false'); });
  $('#breadcrumb-page').textContent = { backend: 'Backend', updates: t('Updates'), releases: t("Build & release"), devices: t("Devices"), setup: t("Setup & tools"), preferences: t("Preferences"), guide: t("Quick start guide"), sets: t("Device sets"), logs: t("Device logs"), captures: t("Captures"), plan: t("Your plan") }[page];
  if (page === 'setup' && !toolState) checkTools();
  document.dispatchEvent(new CustomEvent('snapkit:page', { detail: page }));
  window.scrollTo({ top: 0, behavior: 'instant' });
  const heading = $(`#panel-${page} h1`); heading?.setAttribute('tabindex', '-1'); heading?.focus({ preventScroll: true });
}
$$('[data-app-page]').forEach(button => button.addEventListener('click', () => showProductPage(button.dataset.appPage)));
$$('[data-go]').forEach(button => button.addEventListener('click', () => showProductPage(button.dataset.go)));
$('#journey-project').addEventListener('click', showWorkspace);
$('#journey-device').addEventListener('click', () => { $('#add-device').click(); });
function updateJourney() {
  $('#journey-workspace').textContent = state.settings.workspace ? state.settings.workspace.split(/[\\/]/).filter(Boolean).at(-1) : t(document.body.dataset.framework === 'react-native' ? "Connect a React Native project" : "Connect a Flutter project");
  const online = state.devices.filter(device => device.state === 'online').length;
  $('#journey-devices').textContent = online ? t("{0} device{1} ready to use", [online, online === 1 ? '' : 's']) : t("Create one or connect your phone");
  $('#journey-project .step-number').classList.toggle('complete', !!state.settings.workspace);
  $('#journey-device .step-number').classList.toggle('complete', online > 0);
}
document.addEventListener('snapkit:state', updateJourney);
function renderEditors() {
  const selected = productEditors.some(([id]) => id === product?.preferences?.editor) ? product.preferences.editor : 'vscode';
  $('#editor-options').innerHTML = productEditors.map(([id, name, detail, symbol]) => `<button type="button" class="editor-option ${selected === id ? 'chosen' : ''}" data-editor="${id}" aria-pressed="${selected === id}">${icon(symbol)}<strong>${escape(t(name))}</strong><small>${escape(t(detail))}</small>${selected === id ? icon('circle-check') : ''}</button>`).join('');
  $('#extension-download').classList.remove('hidden');
  const name = productEditors.find(([id]) => id === selected)[1];
  $('#editor-help').textContent = document.body.dataset.framework === 'react-native' ? t('Install Snapkit Debug Sync 1.5.0 in your editor. Select Snapkit React Native in Run and Debug, then press F5.') : t("In {0}, install Snapkit Debug Sync and press F5 to debug on your selected devices.", [name]);
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
      $('#tool-checks').innerHTML = toolState.checks.map(check => `<article class="tool-check ${check.status}"><span class="tool-symbol">${icon(check.status === 'ready' ? 'check' : 'wrench')}</span><div><div class="tool-title"><h3>${escape(t(check.title))}</h3><span>${check.status === 'ready' ? t("Ready") : t("Needs setup")}</span></div>${check.status === 'ready' ? `<details class="interface-details"><summary>${t("More details")}</summary><p>${escape(t(check.detail))}</p></details>` : `<p>${escape(t(check.detail))}</p>`}${check.status !== 'ready' ? `<a class="text-link" href="${escape(check.help)}" target="_blank" rel="noopener noreferrer">${t("Open setup guide")} ${icon('arrow-up-right')}</a>` : ''}</div></article>`).join('');
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
  $('#breadcrumb-page').textContent = t({ backend: 'Backend', updates: 'Updates', releases: 'Build & release', devices: 'Devices', setup: 'Setup & tools', preferences: 'Preferences', plan: 'Your plan', guide: 'Quick start guide', sets: 'Device sets', logs: 'Device logs', captures: 'Captures' }[activePage]);
  if (toolState) renderTools();
});
window.snapkitDesktop?.setLanguage?.(window.SnapkitI18n.language).catch(() => {});

document.addEventListener('snapkit:navigate', event => showProductPage(event.detail));
export { activePage, showProductPage };

document.addEventListener('snapkit:profile', () => { toolState = null; updateJourney(); renderEditors(); renderFrameworkGuidance(); });

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
    "Install Snapkit Debug Sync 1.5.0 in VS Code, Cursor or Antigravity. Select online devices, choose Snapkit React Native in Run and Debug, then press F5."
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
    "VS Code: Extensions → … → Install from VSIX. Cursor and Antigravity integration is in beta. Keep Dart and Flutter extensions installed.",
    "Install Snapkit Debug Sync from VSIX. The Snapkit React Native profile uses the built-in JavaScript debugger. Cursor and Antigravity integration is in beta."
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
