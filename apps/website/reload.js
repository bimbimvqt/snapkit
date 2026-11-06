// Run before parsing the page so reload never restores an old scroll position
// or jumps back to a section hash. Normal links and history navigation still work.
if (performance.getEntriesByType('navigation')[0]?.type === 'reload') {
  history.scrollRestoration = 'manual';
  if (location.hash) history.replaceState(history.state, '', location.pathname + location.search);
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  window.addEventListener('pageshow', () => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }), { once: true });
}
