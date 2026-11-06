// Run before layout. A reload returns to the top; a fresh section link and
// ordinary history navigation retain their usual behavior.
const reloadNavigation = performance.getEntriesByType('navigation')[0]?.type === 'reload' || performance.navigation?.type === 1;
if (reloadNavigation) {
  history.scrollRestoration = 'manual';
  if (location.hash) history.replaceState(history.state, '', location.pathname + location.search);
  const resetScroll = () => window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  resetScroll();
  // The head has no layout yet; reset once the content exists as well as after
  // the browser's restoration phase, before the next painted frame.
  document.addEventListener('DOMContentLoaded', resetScroll, { once: true });
  window.addEventListener('pageshow', () => { resetScroll(); requestAnimationFrame(resetScroll); }, { once: true });
  window.addEventListener('pagehide', () => { history.scrollRestoration = 'auto'; }, { once: true });
}
