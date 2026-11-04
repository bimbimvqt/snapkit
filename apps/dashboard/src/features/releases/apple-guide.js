import { t, busy, state, connection } from '../../legacy/device-controller.js';
/* Setup is optional for builds. Switching guidance never changes the release form. */
(() => {
  const el = id => document.getElementById(id);
  function route(value) {
    if (!['keys', 'xcode'].includes(value)) return;
    document.querySelectorAll('[data-apple-route]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.appleRoute === value)));
    el('apple-route-keys').hidden = value !== 'keys'; el('apple-route-xcode').hidden = value !== 'xcode';
    el('apple-open-xcode').hidden = !window.snapkitDesktop?.openXcode || connection || window.SNAPKIT_CONTROLLER || window.SNAPKIT_PREVIEW || state.platform !== 'darwin';
  }
  function open(value = 'keys', focus = true) {
    el('release-credentials').open = true; route(value);
    if (focus) { el('apple-setup-title').focus({ preventScroll: true }); el('release-credentials').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }); }
  }
  window.SnapkitAppleGuide = { open };
  el('panel-releases').addEventListener('click', event => { const button = event.target.closest('[data-apple-help]'); if (button) open(button.dataset.appleHelp); });
  document.querySelectorAll('[data-apple-route]').forEach(button => button.addEventListener('click', () => route(button.dataset.appleRoute)));
  el('release-credentials').addEventListener('click', event => { if (event.target.closest('[data-apple-edit]')) route('keys'); });
  el('release-credentials').addEventListener('toggle', () => { if (el('release-credentials').open) route(document.querySelector('[data-apple-route][aria-pressed="true"]').dataset.appleRoute); });
  el('apple-open-xcode').addEventListener('click', () => busy(el('apple-open-xcode'), async () => {
    el('apple-xcode-error').textContent = ''; delete el('apple-xcode-error').dataset.source;
    try { await window.snapkitDesktop.openXcode(); }
    catch { el('apple-xcode-error').dataset.source = 'Could not open Xcode. Install Xcode and open it from Applications.'; el('apple-xcode-error').textContent = t(el('apple-xcode-error').dataset.source); }
  }));
  document.addEventListener('snapkit:language', () => { if (el('apple-xcode-error').dataset.source) el('apple-xcode-error').textContent = t(el('apple-xcode-error').dataset.source); });
  document.addEventListener('snapkit:state', () => { el('apple-open-xcode').hidden = !window.snapkitDesktop?.openXcode || connection || window.SNAPKIT_CONTROLLER || window.SNAPKIT_PREVIEW || state.platform !== 'darwin'; });
})();

export {};
