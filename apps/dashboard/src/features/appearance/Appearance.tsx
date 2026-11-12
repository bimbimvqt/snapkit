import { useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { Icon } from '../../shared/ui/icons';
import { t, useLanguage } from '../../shared/ui/use-language';
import { applyAppearance, getAppearance, type Appearance } from './theme';
import './appearance.css';
import {ThemeLibrary} from './ThemeLibrary';
const subscribe = (notify: () => void) => { document.addEventListener('snapkit:appearance', notify); return () => document.removeEventListener('snapkit:appearance', notify); };
const choices: [Appearance, string, string][] = [['light', 'Light', 'sun'], ['dark', 'Dark', 'moon'], ['system', 'Auto', 'monitor']];
function AppearanceSettings() {
  useLanguage();
  const selected = useSyncExternalStore(subscribe, getAppearance);
  return <section className="preferences-card appearance-card" aria-labelledby="appearance-title"><div className="settings-section-title"><span className="settings-symbol"><Icon name="palette" /></span><div><h2 id="appearance-title">{t('Appearance')}</h2><p>{t('Make Snapkit feel at home.')}</p></div></div>
    <fieldset className="appearance-options"><legend>{t('Choose your appearance')}</legend>{choices.map(([value, label, symbol]) => <label key={value} className={`appearance-option ${selected === value ? 'selected' : ''}`}>
      <input type="radio" name="appearance" value={value} checked={selected === value} onChange={() => applyAppearance(value)} />
      <span className={`appearance-preview preview-${value}`} aria-hidden="true"><span className="preview-window"><span className="preview-sidebar"><b /><b /><b /></span><span className="preview-content"><b /><i /><i /></span></span></span>
      <span className="appearance-label"><Icon name={symbol} />{t(label)}<span className="appearance-check" aria-hidden="true">{selected === value && <Icon name="check" />}</span></span>
    </label>)}</fieldset><p className="appearance-note" role="status">{t(selected === 'system' ? 'Automatically matches your system’s light or dark appearance.' : 'Applied throughout Snapkit. Your choice is saved on this computer.')}</p>
    <ThemeLibrary/>
  </section>;
}
export function mountAppearance() { const root = createRoot(document.getElementById('appearance-root')!); root.render(<AppearanceSettings />); return () => root.unmount(); }
