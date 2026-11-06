/* Shared, dependency-free localization. Only authored UI copy is translated;
 * project names, device names, paths, identifiers and tool output stay intact. */
(() => {
  const catalog = window.SnapkitMessages || { source: 'en', translations: {} };
  const supported = value => ['en', 'vi'].includes(value);
  let saved;
  try { saved = localStorage.getItem('snapkit-language'); } catch {}
  const requested = new URLSearchParams(location.search).get('lang');
  let language = supported(requested) ? requested : supported(saved) ? saved : navigator.language?.toLowerCase().startsWith('vi') ? 'vi' : 'en';
  const records = [];
  const patterns = Object.entries(catalog.translations).filter(([key]) => /\{\d+\}/.test(key)).map(([key, translated]) => {
    const parts = key.split(/(\{\d+\})/);
    const indices = parts.filter(part => /^\{\d+\}$/.test(part)).map(part => Number(part.slice(1, -1)));
    const expression = parts.map(part => /^\{\d+\}$/.test(part) ? '(.*?)' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('');
    return { regex: new RegExp('^' + expression + '$', 's'), indices, translated };
  });
  const t = (key, values = []) => {
    let text = language === catalog.source ? key : catalog.translations[key] ?? key;
    if (language !== catalog.source && text === key && !Object.hasOwn(catalog.translations, key)) {
      for (const pattern of patterns) {
        const match = String(key).match(pattern.regex);
        if (!match) continue;
        text = pattern.translated;
        values = [];
        pattern.indices.forEach((index, i) => { values[index] = match[i + 1]; });
        break;
      }
    }
    return String(text).replace(/\{(\d+)\}/g, (match, index) => values[index] === undefined ? match : String(values[index]));
  };
  function bind(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentElement?.closest('script,style,code,pre,[data-i18n-ignore]')) continue;
      const source = node.nodeValue, key = source.trim();
      if (Object.hasOwn(catalog.translations, key)) records.push({ node, key, before: source.slice(0, source.indexOf(key)), after: source.slice(source.indexOf(key) + key.length), last: source });
    }
    for (const node of root.querySelectorAll('[placeholder],[aria-label],[title],[alt],meta[name="description"]')) {
      for (const attr of ['placeholder', 'aria-label', 'title', 'alt', ...(node.matches('meta[name="description"]') ? ['content'] : [])]) {
        const key = node.getAttribute(attr);
        if (Object.hasOwn(catalog.translations, key)) records.push({ node, attr, key, last: key });
      }
    }
  }
  function apply() {
    document.documentElement.lang = language;
    for (const record of records) {
      const { node, key, attr } = record;
      if (!node.isConnected) continue;
      const current = attr ? node.getAttribute(attr) : node.nodeValue;
      // A renderer may have replaced an initial placeholder with user data.
      if (current !== record.last) continue;
      const next = attr ? t(key) : record.before + t(key) + record.after;
      if (attr) node.setAttribute(attr, next); else node.nodeValue = next;
      record.last = next;
    }
    for (const trigger of document.querySelectorAll('[data-language-select]')) {
      trigger.dataset.languageCurrent = language;
      trigger.querySelector('[data-language-label]').textContent = language === 'vi' ? 'VN' : 'EN';
    }
    for (const option of document.querySelectorAll('[data-language]')) option.setAttribute('aria-checked', String(option.dataset.language === language));
  }
  let languageFrame, restoreScrollAnchor;
  function setLanguage(value) {
    if (!supported(value)) return;
    // Translated copy can change section heights. Disable browser anchoring through
    // the next paint so choosing a locale preserves the reader's scroll position.
    const root = document.documentElement, left = scrollX, top = scrollY;
    if (!restoreScrollAnchor) {
      const value = root.style.getPropertyValue('overflow-anchor'), priority = root.style.getPropertyPriority('overflow-anchor');
      restoreScrollAnchor = () => value ? root.style.setProperty('overflow-anchor', value, priority) : root.style.removeProperty('overflow-anchor');
    }
    cancelAnimationFrame(languageFrame);
    root.style.setProperty('overflow-anchor', 'none');
    root.getBoundingClientRect();
    language = value;
    const url = new URL(location.href);
    if (url.searchParams.has('lang')) { url.searchParams.set('lang', value); history.replaceState(history.state, '', url); }
    try { localStorage.setItem('snapkit-language', value); } catch {}
    apply();
    document.dispatchEvent(new CustomEvent('snapkit:language', { detail: { language } }));
    window.scrollTo({ left, top, behavior: 'instant' });
    languageFrame = requestAnimationFrame(() => {
      languageFrame = requestAnimationFrame(() => { restoreScrollAnchor(); restoreScrollAnchor = null; });
    });
    window.snapkitDesktop?.setLanguage?.(language).catch(() => {});
  }
  window.SnapkitI18n = { t, setLanguage, get language() { return language; } };
  bind(document); apply();
  if (supported(requested)) { try { localStorage.setItem('snapkit-language', language); } catch {} }
  const trigger = document.querySelector('[data-language-select]');
  const menu = document.querySelector('#language-menu');
  const options = [...(menu?.querySelectorAll('[data-language]') || [])];
  function closeMenu(restoreFocus = false) {
    if (!menu) return;
    menu.hidden = true; trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) trigger.focus({ preventScroll: true });
  }
  function openMenu(last = false) {
    menu.hidden = false; trigger.setAttribute('aria-expanded', 'true');
    (last ? options.at(-1) : options.find(option => option.dataset.language === language) || options[0])?.focus({ preventScroll: true });
  }
  trigger?.addEventListener('click', () => { if (menu.hidden) openMenu(); else closeMenu(); });
  trigger?.addEventListener('keydown', event => {
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); openMenu(event.key === 'ArrowUp'); }
  });
  menu?.addEventListener('click', event => {
    const option = event.target.closest('[data-language]');
    if (option) { setLanguage(option.dataset.language); closeMenu(true); }
  });
  menu?.addEventListener('keydown', event => {
    const index = options.indexOf(document.activeElement);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      options[next]?.focus({ preventScroll: true });
    }
  });
  document.addEventListener('keydown', event => {
    if (menu && !menu.hidden && event.key === 'Escape') { event.preventDefault(); closeMenu(true); }
  });
  document.addEventListener('pointerdown', event => { if (!event.target.closest('.language-picker')) closeMenu(); });
  document.addEventListener('focusin', event => { if (!event.target.closest('.language-picker')) closeMenu(); });
  window.addEventListener('storage', event => { if (event.key === 'snapkit-language' && supported(event.newValue)) setLanguage(event.newValue); });
})();
