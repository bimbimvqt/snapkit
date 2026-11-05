import './shared/i18n/messages.js';
import '../../../packages/ui/i18n.js';
import './shared/controls/dropdowns.js';
import { installIcons } from './shared/ui/icons';
installIcons();
// Legacy controllers are explicit ES modules. They never own React feature children.
// Keep startup ordered until each remaining screen moves behind its own React boundary.
try {
  const devices = await import('./legacy/device-controller.js');
  await import('./features/workspace/product.js');
  const [, { accountReady }, , , { mountUpdates }] = await Promise.all([
    import('./features/device-tools/tools.js'),
    import('./features/account/account.js'),
    import('./features/releases/releases.js'),
    import('./features/releases/apple-guide.js'),
    import('./features/updates/UpdatePage')
  ]);
  document.getElementById('update-loading')?.remove();
  document.getElementById('update-banner')?.replaceChildren();
  document.getElementById('update-indicator')?.replaceChildren();
  document.getElementById('app-cache-root')?.replaceChildren();
  const unmountUpdates = mountUpdates();
  await devices.init();
  await accountReady;
  const { mountDeveloperProfile } = await import('./features/onboarding/DeveloperProfile');
  const unmountDeveloperProfile = mountDeveloperProfile();
  document.body.dataset.uiReady = 'true';
  document.body.classList.remove('app-starting');
  document.getElementById('dashboard-startup')?.remove();
  document.dispatchEvent(new Event('snapkit:ui-ready'));
  window.snapkitDesktop?.ready?.();
  if (import.meta.hot) {
    import.meta.hot.dispose(() => { unmountUpdates(); unmountDeveloperProfile(); });
    // Legacy controllers use native listeners; full reload prevents duplicate subscriptions.
    import.meta.hot.accept(() => location.reload());
  }

} catch (error) {
  console.error('Dashboard startup failed', error);
  const message = document.querySelector('#dashboard-startup p');
  if (message) message.textContent = window.SnapkitI18n.t('Could not start Snapkit. Reload the app to try again.');
}
