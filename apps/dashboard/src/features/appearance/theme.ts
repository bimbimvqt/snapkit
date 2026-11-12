import {activeTheme,themeTokens} from '../../../../../packages/domain/personal-themes.js';
import {getFocusExperience,subscribeFocusExperience} from '../kit/focus-store';
export type Appearance = 'system' | 'light' | 'dark';
const media = window.matchMedia('(prefers-color-scheme: light)');
const valid = (value: unknown): value is Appearance => ['system', 'light', 'dark'].includes(String(value));
let appearance: Appearance = 'system';
try { const saved = localStorage.getItem('snapkit-theme'); if (valid(saved)) appearance = saved; } catch {}
function applyPalette(){
  const tokens=themeTokens(activeTheme(getFocusExperience()),document.documentElement.classList.contains('light'));
  for(const [key,color] of Object.entries(tokens)) document.documentElement.style.setProperty(key,color as string);
  document.documentElement.dataset.personalTheme=getFocusExperience().space;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',tokens['--bg']);
  document.dispatchEvent(new Event('snapkit:appearance'));
}
export function applyAppearance(value: Appearance) {
  appearance = value;
  try { localStorage.setItem('snapkit-theme', value); } catch {}
  const light = value === 'light' || value === 'system' && media.matches;
  document.documentElement.classList.toggle('light', light);
  document.documentElement.dataset.appearance = value;
  applyPalette();
  void window.snapkitDesktop?.setAppearance?.(value).catch(() => {});
}
export const getAppearance = () => appearance;
media.addEventListener('change', () => { if (appearance === 'system') applyAppearance(appearance); });
window.addEventListener('storage', event => { if (event.key === 'snapkit-theme') applyAppearance(valid(event.newValue) ? event.newValue : 'system'); });
applyAppearance(appearance);
subscribeFocusExperience(applyPalette);
