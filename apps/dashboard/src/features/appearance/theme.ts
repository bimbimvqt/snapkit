export type Appearance = 'system' | 'light' | 'dark';
const media = window.matchMedia('(prefers-color-scheme: light)');
const valid = (value: unknown): value is Appearance => ['system', 'light', 'dark'].includes(String(value));
let appearance: Appearance = 'system';
try { const saved = localStorage.getItem('snapkit-theme'); if (valid(saved)) appearance = saved; } catch {}
export function applyAppearance(value: Appearance) {
  appearance = value;
  try { localStorage.setItem('snapkit-theme', value); } catch {}
  const light = value === 'light' || value === 'system' && media.matches;
  document.documentElement.classList.toggle('light', light);
  document.documentElement.dataset.appearance = value;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#f6f7f8' : '#000000');
  void window.snapkitDesktop?.setAppearance?.(value).catch(() => {});
  document.dispatchEvent(new Event('snapkit:appearance'));
}
export const getAppearance = () => appearance;
media.addEventListener('change', () => { if (appearance === 'system') applyAppearance(appearance); });
window.addEventListener('storage', event => { if (event.key === 'snapkit-theme') applyAppearance(valid(event.newValue) ? event.newValue : 'system'); });
applyAppearance(appearance);
