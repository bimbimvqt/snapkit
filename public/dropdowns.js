/* Custom menus retain native form values, but never open an OS select/datalist popup. */
(() => {
  let active = null, sequence = 0;
  const controls = new Set();
  const tr = text => window.SnapkitI18n?.t(text) || text;
  const svg = (name) => name === 'check' ? '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m4 10 4 4 8-8"/></svg>' : '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m6 8 4 4 4-4"/></svg>';
  function make(source, input = null) {
    const id = source.id || `snapkit-choice-${++sequence}`, listId = `${id}-listbox`;
    source.id = id;
    const wrapper = document.createElement('div'); wrapper.className = input ? 'choice-control choice-editable' : 'choice-control';
    (input || source).before(wrapper); wrapper.append(input || source);
    const trigger = input || document.createElement('button');
    if (!input) { source.classList.add('choice-source'); source.tabIndex = -1; source.setAttribute('aria-hidden', 'true'); trigger.type = 'button'; trigger.className = 'choice-trigger'; trigger.id = `${id}-trigger`; wrapper.append(trigger); }
    else { input.removeAttribute('list'); input.setAttribute('autocomplete', 'off'); }
    trigger.setAttribute('role', 'combobox'); trigger.setAttribute('aria-haspopup', 'listbox'); trigger.setAttribute('aria-expanded', 'false'); trigger.setAttribute('aria-controls', listId); if (input) trigger.setAttribute('aria-autocomplete', 'list');
    const error = document.createElement('p'); error.className = 'choice-error'; error.id = `${id}-error`; error.hidden = true; error.setAttribute('role', 'alert'); wrapper.append(error);
    const popup = document.createElement('div'); popup.className = 'choice-popup'; popup.setAttribute('popover', 'manual'); wrapper.append(popup);
    const search = document.createElement('input'); search.type = 'search'; search.className = 'choice-search'; search.autocomplete = 'off';
    const list = document.createElement('div'); list.className = 'choice-options'; list.id = listId; list.setAttribute('role', 'listbox');
    const empty = document.createElement('p'); empty.className = 'choice-empty'; empty.setAttribute('role', 'status');
    popup.append(search, list, empty);
    let opened = false, query = '', selectedIndex = -1, timer, options = [], signature = '';
    const labels = input?.labels || source.labels;
    const labelIds = [...(labels || [])].map(label => { label.id ||= `${id}-label-${++sequence}`; return label.id; });
    if (labelIds.length) { trigger.setAttribute('aria-labelledby', labelIds.join(' ')); list.setAttribute('aria-labelledby', labelIds.join(' ')); }
    else { trigger.setAttribute('aria-label', source.getAttribute('aria-label') || id); list.setAttribute('aria-label', source.getAttribute('aria-label') || id); }
    function filtered() { return options.map((item, index) => ({ ...item, index })).filter(item => !item.hidden && (!query || item.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()))); }
    function position() {
      if (!opened) return;
      const rect = trigger.getBoundingClientRect(), gap = 6, edge = 10;
      const width = Math.min(Math.max(rect.width, 220), innerWidth - edge * 2), below = innerHeight - rect.bottom - gap - edge, above = rect.top - gap - edge;
      const bottom = below >= Math.min(popup.scrollHeight, 270) || below >= above;
      const height = Math.min(340, Math.max(90, bottom ? below : above));
      popup.style.width = `${width}px`; popup.style.maxHeight = `${height}px`; popup.style.left = `${Math.max(edge, Math.min(rect.left, innerWidth - width - edge))}px`;
      popup.style.top = `${bottom ? Math.min(rect.bottom + gap, innerHeight - 90 - edge) : Math.max(edge, rect.top - gap - Math.min(popup.scrollHeight, height))}px`;
    }
    function renderOptions() {
      const items = filtered(); list.replaceChildren();
      for (const item of items) {
        const option = document.createElement('button'); option.type = 'button'; option.className = 'choice-option'; option.id = `${listId}-${item.index}`; option.dataset.index = item.index; option.setAttribute('role', 'option'); option.setAttribute('aria-selected', String(item.index === selectedIndex)); option.disabled = item.disabled; option.tabIndex = -1;
        const text = document.createElement('span'); text.textContent = item.label; const check = document.createElement('span'); check.className = 'choice-check'; check.innerHTML = svg('check'); option.append(text, check); list.append(option);
      }
      empty.textContent = tr('No matching options'); empty.hidden = items.length > 0;
      search.placeholder = tr('Search options…'); search.setAttribute('aria-label', tr('Search options'));
      search.hidden = !!input || options.filter(x => !x.hidden).length < 8;
      position();
    }
    function sync() {
      const next = [...source.options].map(option => ({ value: option.value, label: option.label || option.textContent || option.value, disabled: option.disabled || option.parentElement?.disabled === true, hidden: option.hidden }));
      const value = input ? input.value : source.value;
      selectedIndex = next.findIndex(option => option.value === value);
      const nextSignature = JSON.stringify([next, value, source.disabled, source.required, window.SnapkitI18n?.language]);
      if (signature === nextSignature) return; signature = nextSignature; options = next;
      if (!labelIds.length) { const label = source.getAttribute('aria-label') || id; trigger.setAttribute('aria-label', label); list.setAttribute('aria-label', label); }
      if (!input) {
        const text = document.createElement('span'); text.className = 'choice-value'; text.id = `${id}-value`; if (labelIds.length) trigger.setAttribute('aria-labelledby', [...labelIds, text.id].join(' ')); text.textContent = options[selectedIndex]?.label || tr('Choose an option'); trigger.replaceChildren(text); const chevron = document.createElement('span'); chevron.className = 'choice-chevron'; chevron.innerHTML = svg('chevron'); trigger.append(chevron);
        trigger.disabled = source.disabled || !options.some(x => !x.disabled && !x.hidden);
        trigger.setAttribute('aria-required', String(source.required)); trigger.setAttribute('aria-invalid', String(!source.validity.valid && trigger.dataset.invalid === 'true'));
      }
      if (source.disabled) close();
      if (opened) { const focusedIndex = Number(document.activeElement?.dataset.index); renderOptions(); if (Number.isInteger(focusedIndex) && list.querySelector(`[data-index="${focusedIndex}"]`)) focusOption(focusedIndex); }
    }
    function focusOption(index) { const option = list.querySelector(`[data-index="${index}"]`); if (option && !option.disabled) { option.focus({ preventScroll: true }); const item = option.getBoundingClientRect(), viewport = list.getBoundingClientRect(); if (item.bottom > viewport.bottom) list.scrollTop += item.bottom - viewport.bottom; else if (item.top < viewport.top) list.scrollTop -= viewport.top - item.top; } }
    function open(focus = true) {
      sync(); if ((!input && trigger.disabled) || (input && !options.length)) return;
      active?.close(); active = api; query = input ? input.value : ''; search.value = ''; opened = true; trigger.setAttribute('aria-expanded', 'true');
      renderOptions(); popup.showPopover(); position();
      if (focus && !input) { if (!search.hidden) search.focus({ preventScroll: true }); else { const items = filtered().filter(x => !x.disabled); focusOption(items.find(x => x.index === selectedIndex)?.index ?? items[0]?.index); } }
    }
    function close(focus = false) { if (!opened) return; opened = false; popup.hidePopover(); trigger.setAttribute('aria-expanded', 'false'); if (active === api) active = null; if (focus) trigger.focus({ preventScroll: true }); }
    function choose(index) {
      const item = options[index]; if (!item || item.disabled) return;
      (input || source).value = item.value; trigger.dataset.invalid = 'false'; trigger.setAttribute('aria-invalid', 'false'); error.hidden = true; trigger.removeAttribute('aria-describedby'); close(true); signature = ''; sync();
      (input || source).dispatchEvent(new Event('input', { bubbles: true })); (input || source).dispatchEvent(new Event('change', { bubbles: true }));
    }
    trigger.addEventListener('click', event => { event.preventDefault(); if (input) { if (!opened) open(false); } else if (opened) close(); else open(); });
    trigger.addEventListener('keydown', event => {
      if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); if (!opened) open(false); const items = filtered().filter(x => !x.disabled); focusOption((event.key === 'ArrowUp' ? items.at(-1) : items.find(x => x.index === selectedIndex) || items[0])?.index); }
      else if (event.key === 'Escape' && opened) { event.preventDefault(); event.stopPropagation(); close(true); }
      else if (!input && ['Enter', ' '].includes(event.key)) { event.preventDefault(); opened ? close(true) : open(); }
      else if (!input && event.key.length === 1 && !event.ctrlKey && !event.metaKey) { event.preventDefault(); if (!opened) open(false); query += event.key; clearTimeout(timer); timer = setTimeout(() => { query = ''; }, 650); renderOptions(); focusOption(filtered().find(x => !x.disabled)?.index); }
    });
    popup.addEventListener('click', event => { const option = event.target.closest('[data-index]'); if (option) { event.preventDefault(); choose(Number(option.dataset.index)); } });
    popup.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return; }
      if (event.key === 'Tab') { close(true); return; }
      const items = filtered().filter(x => !x.disabled), index = items.findIndex(x => x.index === Number(document.activeElement?.dataset.index));
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) && !(event.target === search && ['Home', 'End'].includes(event.key))) {
        event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : event.key === 'ArrowDown' ? Math.min(index + 1, items.length - 1) : index < 0 ? items.length - 1 : Math.max(index - 1, 0); focusOption(items[next]?.index);
      }
      else if (event.key === 'Enter' && event.target === search) { event.preventDefault(); const item = items[0]; if (item) choose(item.index); }
      else if (event.key.length === 1 && event.target !== search && !event.metaKey && !event.ctrlKey && event.key !== ' ') { event.preventDefault(); query += event.key; clearTimeout(timer); timer = setTimeout(() => { query = ''; }, 650); renderOptions(); focusOption(filtered().find(x => !x.disabled)?.index); }
    });
    search.addEventListener('input', () => { query = search.value; renderOptions(); });
    if (input) input.addEventListener('input', () => { query = input.value; signature = ''; sync(); if (!opened) open(false); else renderOptions(); });
    source.addEventListener('change', () => { signature = ''; sync(); });
    source.addEventListener('invalid', event => { event.preventDefault(); trigger.dataset.invalid = 'true'; trigger.setAttribute('aria-invalid', 'true'); error.textContent = tr('Choose an option'); error.hidden = false; trigger.setAttribute('aria-describedby', error.id); trigger.focus(); open(); });
    source.form?.addEventListener('reset', () => { close(); setTimeout(() => { signature = ''; sync(); }, 0); });
    for (const label of labels || []) label.addEventListener('click', event => { if (event.target === label || event.target === source) { event.preventDefault(); trigger.focus(); } });
    new MutationObserver(sync).observe(source, { childList: true, subtree: true, characterData: true, attributes: true });
    if (!input) for (const property of ['value', 'selectedIndex']) {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, property);
      Object.defineProperty(source, property, { configurable: true, get() { return descriptor.get.call(this); }, set(value) { descriptor.set.call(this, value); sync(); } });
    }
    const api = { source, trigger, popup, wrapper, close, sync, position, get opened() { return opened; } }; controls.add(api); sync(); return api;
  }
  for (const select of document.querySelectorAll('select')) make(select);
  for (const input of document.querySelectorAll('input[list]')) { const source = document.getElementById(input.getAttribute('list')); if (source) make(source, input); }
  document.addEventListener('pointerdown', event => { if (active && !active.wrapper.contains(event.target)) active.close(); }, true);
  document.addEventListener('focusin', event => { if (active && !active.wrapper.contains(event.target)) active.close(); });
  document.addEventListener('snapkit:language', () => { for (const control of controls) control.sync(); });
  document.addEventListener('snapkit:page', () => active?.close());
  document.addEventListener('close', event => { if (active && event.target.contains(active.wrapper)) active.close(); }, true);
  document.addEventListener('scroll', event => { if (active && !active.popup.contains(event.target) && (event.target === document || event.target === window || event.target.contains?.(active.trigger))) { const rect = active.trigger.getBoundingClientRect(); if (rect.bottom < 0 || rect.top > innerHeight) active.close(); else active.position(); } }, true);
  window.addEventListener('resize', () => active?.close());
})();
