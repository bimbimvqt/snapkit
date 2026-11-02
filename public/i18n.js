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
    for (const select of document.querySelectorAll('[data-language-select]')) select.value = language;
  }
  function setLanguage(value) {
    if (!supported(value)) return;
    language = value;
    const url = new URL(location.href);
    if (url.searchParams.has('lang')) { url.searchParams.set('lang', value); history.replaceState(history.state, '', url); }
    try { localStorage.setItem('snapkit-language', value); } catch {}
    apply();
    document.dispatchEvent(new CustomEvent('snapkit:language', { detail: { language } }));
    window.snapkitDesktop?.setLanguage?.(language).catch(() => {});
  }
  window.SnapkitI18n = { t, setLanguage, get language() { return language; } };
  bind(document); apply();
  if (supported(requested)) { try { localStorage.setItem('snapkit-language', language); } catch {} }
  document.addEventListener('change', event => { if (event.target.matches('[data-language-select]')) setLanguage(event.target.value); });
  window.addEventListener('storage', event => { if (event.key === 'snapkit-language' && supported(event.newValue)) setLanguage(event.newValue); });
})();
