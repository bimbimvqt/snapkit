// Small shared listbox for the website and administrator inbox.
(() => {
  let nextId = 0;
  function choiceIcon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('choice-icon', name === 'caret' ? 'choice-caret' : 'choice-check');
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', name === 'caret' ? 'm6 9 6 6 6-6' : 'm5 12 4 4L19 6');
    svg.append(path); return svg;
  }
  class SnapkitSelect extends HTMLElement {
    constructor() {
      super(); this.items = []; this.current = ''; this.onChange = null;
      this.scrollListener = event => { if (!this.menu?.hidden && !this.menu?.contains(event.target)) this.positionMenu(); };
      this.resizeListener = () => { if (!this.menu?.hidden) this.positionMenu(); };
      this.outside = event => { if (!this.contains(event.target)) this.close(); };
      this.languageListener = () => this.render();
    }
    configure({ items, value, name = '', labelledby, onChange }) {
      this.items = items; this.current = value; this.fieldName = name;
      this.labelledby = labelledby; this.onChange = onChange;
      if (this.isConnected) this.render();
      return this;
    }
    connectedCallback() {
      this.menuId ||= 'snapkit-options-' + ++nextId;
      this.render(); document.addEventListener('click', this.outside);
      document.addEventListener('snapkit:language', this.languageListener);
      document.addEventListener('scroll', this.scrollListener, true); window.addEventListener('resize', this.resizeListener);
    }
    disconnectedCallback() {
      document.removeEventListener('click', this.outside);
      document.removeEventListener('snapkit:language', this.languageListener);
      document.removeEventListener('scroll', this.scrollListener, true); window.removeEventListener('resize', this.resizeListener);
    }
    get value() { return this.current; }
    set value(value) { this.current = value; if (this.isConnected) this.render(); }
    get disabled() { return this.hasAttribute('disabled'); }
    set disabled(value) {
      this.toggleAttribute('disabled', value); this.close();
      if (this.trigger) this.trigger.disabled = value;
      if (this.input) this.input.disabled = value;
    }
    close(focus = false) {
      if (!this.menu) return;
      this.menu.hidden = true; this.trigger.setAttribute('aria-expanded', 'false');
      if (focus) this.trigger.focus({ preventScroll: true });
    }
    positionMenu() {
      const anchor = this.trigger.getBoundingClientRect();
      const height = Math.min(this.items.length * 48 + 12, 260);
      const above = innerHeight - anchor.bottom - 12 < height && anchor.top > innerHeight - anchor.bottom;
      Object.assign(this.menu.style, { position:'fixed', left:Math.max(8,Math.min(anchor.left,innerWidth-anchor.width-8))+'px', right:'auto', width:anchor.width+'px', top:above?'auto':anchor.bottom+7+'px', bottom:above?innerHeight-anchor.top+7+'px':'auto', maxHeight:Math.min(260,Math.max(100,above?anchor.top-16:innerHeight-anchor.bottom-16))+'px' });
    }
    focusOption(index) {
      const option = this.options[index]; if (!option) return;
      option.focus({ preventScroll: true });
      const top = option.offsetTop, bottom = top + option.offsetHeight;
      if (top < this.menu.scrollTop) this.menu.scrollTop = top;
      else if (bottom > this.menu.scrollTop + this.menu.clientHeight) this.menu.scrollTop = bottom - this.menu.clientHeight;
    }
    open(index) {
      if (this.disabled || !this.items.length) return;
      this.menu.hidden = false; this.trigger.setAttribute('aria-expanded', 'true');
      this.positionMenu();
      this.focusOption(Math.max(0, index ?? this.items.findIndex(item => item.value === this.current)));
    }
    render() {
      const t = text => window.SnapkitI18n?.t(text) ?? text;
      this.replaceChildren(); this.classList.add('snapkit-select');
      const chosen = this.items.find(item => item.value === this.current);
      this.input = document.createElement('input'); this.input.type = 'hidden'; this.input.name = this.fieldName || ''; this.input.value = this.current;
      this.trigger = document.createElement('button'); this.trigger.type = 'button'; this.trigger.className = 'choice-trigger';
      this.trigger.setAttribute('role', 'combobox'); this.trigger.setAttribute('aria-haspopup', 'listbox'); this.trigger.setAttribute('aria-expanded', 'false'); this.trigger.setAttribute('aria-controls', this.menuId);
      if (this.labelledby) this.trigger.setAttribute('aria-labelledby', this.labelledby);
      const text = document.createElement('span'); text.textContent = t(chosen?.label || 'Chọn một mục');
      const caret = choiceIcon('caret');
      this.trigger.append(text, caret);
      this.menu = document.createElement('div'); this.menu.id = this.menuId; this.menu.className = 'choice-menu'; this.menu.hidden = true; this.menu.setAttribute('role','listbox');
      if (this.labelledby) this.menu.setAttribute('aria-labelledby', this.labelledby);
      this.options = this.items.map((item, index) => {
        const option = document.createElement('button'); option.type = 'button'; option.tabIndex = -1; option.setAttribute('role','option');
        option.setAttribute('aria-selected', String(item.value === this.current)); option.dataset.value = item.value;
        const label = document.createElement('span'); label.textContent = t(item.label);
        const check = choiceIcon('check'); check.style.visibility = item.value === this.current ? 'visible' : 'hidden';
        option.append(label, check);
        option.onclick = () => { this.value = item.value; this.close(true); this.dispatchEvent(new Event('change', { bubbles: true })); this.onChange?.(item.value); };
        option.onkeydown = event => {
          const next = event.key === 'ArrowDown' ? (index + 1) % this.options.length : event.key === 'ArrowUp' ? (index + this.options.length - 1) % this.options.length : event.key === 'Home' ? 0 : event.key === 'End' ? this.options.length - 1 : null;
          if (next !== null) { event.preventDefault(); this.focusOption(next); }
          if (event.key === 'Escape') { event.preventDefault(); this.close(true); }
          if (event.key === 'Tab') this.close();
        };
        this.menu.append(option); return option;
      });
      this.trigger.onclick = () => this.menu.hidden ? this.open() : this.close();
      this.trigger.onkeydown = event => {
        if (['ArrowDown','ArrowUp','Home','End'].includes(event.key)) { event.preventDefault(); this.open(event.key === 'End' || event.key === 'ArrowUp' ? this.items.length - 1 : event.key === 'Home' ? 0 : undefined); }
        if (event.key === 'Escape') this.close();
      };
      this.append(this.input, this.trigger, this.menu); this.trigger.disabled = this.disabled; this.input.disabled = this.disabled;
      this.onfocusout = event => { if (!this.contains(event.relatedTarget)) this.close(); };
    }
  }
  customElements.define('snapkit-select', SnapkitSelect);
})();
