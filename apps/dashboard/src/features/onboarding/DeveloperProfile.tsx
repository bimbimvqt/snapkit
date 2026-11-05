import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { api, connection } from '../../legacy/device-controller.js';
import { showProductPage } from '../workspace/product.js';
import { Icon } from '../../shared/ui/icons';
import { t, useLanguage } from '../../shared/ui/use-language';
import './onboarding.css';

type Profile = { role: 'frontend' | 'backend'; framework: 'flutter' | 'react-native' | null };
function DeveloperProfile() {
  useLanguage();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draft, setDraft] = useState<Profile>({ role: 'frontend', framework: null });
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const loaded = useRef(false);
  const apply = (value: Profile) => {
    setProfile(value); document.body.dataset.developerRole = value.role;
    document.body.dataset.framework = value.framework || '';
    document.dispatchEvent(new CustomEvent('snapkit:profile', { detail: value }));
    if (value.role === 'backend') showProductPage('backend');
  };
  useEffect(() => {
    const load = async () => {
      if (loaded.current || window.SNAPKIT_PREVIEW || (window.SNAPKIT_CONTROLLER && !connection)) return;
      loaded.current = true;
      try {
        const result = await api('/api/product');
        if (result.preferences.developerProfile) { apply(result.preferences.developerProfile); setDraft(result.preferences.developerProfile); }
        else setOpen(true);
      } catch { loaded.current = false; }
    };
    void load(); document.addEventListener('snapkit:state', load);
    return () => document.removeEventListener('snapkit:state', load);
  }, []);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  const edit = () => { setDraft(profile || { role: 'frontend', framework: null }); setError(''); setOpen(true); };
  async function save() {
    setBusy(true); setError('');
    try {
      const value = { ...draft, framework: draft.role === 'backend' ? null : draft.framework };
      const result = await api('/api/preferences', { developerProfile: value });
      apply(result.preferences.developerProfile); setOpen(false);
      if (value.role === 'frontend') showProductPage('devices');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  return <>
    {createPortal(<section className="profile-preference tool-card"><div><span className="product-kicker">{t('DEVELOPER PROFILE')}</span><h2>{profile?.role === 'backend' ? 'Backend' : profile?.framework === 'react-native' ? 'Frontend · React Native' : profile ? 'Frontend · Flutter' : t('Choose your workspace')}</h2><p>{t('Personalize Snapkit for your stack. Change this anytime.')}</p></div><button className="button" onClick={edit}><Icon name="sliders-horizontal" />{t('Change profile')}</button></section>, document.getElementById('profile-preference-root')!)}
    {createPortal(<section className="backend-welcome"><span className="profile-terminal"><Icon name="terminal" /> snapkit / backend</span><span className="profile-soon">{t('Coming soon')}</span><h1>{t('Your backend workspace is on its way.')}</h1><p>{t('A home for your services, APIs and local environments. Backend tools are not available yet.')}</p><div className="backend-features">{[['code-xml', 'API workspace'], ['layers', 'Local services'], ['terminal', 'Service logs']].map(([icon, title]) => <article key={title}><Icon name={icon} /><h2>{t(title)}</h2><span>{t('Coming soon')}</span></article>)}</div><button className="button primary" onClick={edit}>{t('Explore Frontend tools')}<Icon name="arrow-right" /></button><p className="profile-footnote">{t('Your choice is saved on this computer.')}</p></section>, document.getElementById('backend-root')!)}
    <dialog ref={dialog} id="developer-onboarding" aria-labelledby="profile-title" aria-describedby="profile-description" onCancel={event => { if (!profile || busy) event.preventDefault(); else setOpen(false); }}>
      <div className="profile-dialog-top"><span className="profile-terminal"><Icon name="terminal" /> snapkit / setup</span><span className="profile-step">{t('MAKE IT YOURS')}</span>{profile && <button className="icon-button" aria-label={t('Close')} disabled={busy} onClick={() => setOpen(false)}><Icon name="x" /></button>}</div>
      <h1 id="profile-title">{t('What do you build?')}</h1><p id="profile-description">{t('Pick your role. We’ll prepare the right tools for your workflow.')}</p>
      <fieldset disabled={busy}><legend>{t('01 / YOUR ROLE')}</legend><div className="profile-options">{(['frontend', 'backend'] as const).map(role => <button key={role} type="button" className={`profile-choice ${draft.role === role ? 'selected' : ''}`} aria-pressed={draft.role === role} onClick={() => setDraft({ ...draft, role })}><span className="profile-choice-top"><Icon name={role === 'frontend' ? 'panels-top-left' : 'layers'} /><span className="profile-selection">{draft.role === role && <Icon name="check" />}</span></span><strong>{role === 'frontend' ? 'Frontend' : 'Backend'}</strong><span>{t(role === 'frontend' ? 'Build experiences. Ship to devices.' : 'Services, APIs and infrastructure.')}</span>{role === 'backend' && <small className="profile-soon">{t('Coming soon')}</small>}</button>)}</div></fieldset>
      {draft.role === 'frontend' ? <fieldset disabled={busy}><legend>{t('02 / YOUR FRAMEWORK')}</legend><div className="framework-options">{(['flutter', 'react-native'] as const).map(framework => <button type="button" key={framework} className={`framework-choice ${draft.framework === framework ? 'selected' : ''}`} aria-pressed={draft.framework === framework} onClick={() => setDraft({ ...draft, framework })}><span className="framework-code">{framework === 'flutter' ? 'Fl' : 'Rn'}</span><span><strong>{framework === 'flutter' ? 'Flutter' : 'React Native'}</strong><small>{framework === 'flutter' ? 'Dart' : 'JavaScript / TypeScript'}</small></span><span className="profile-selection">{draft.framework === framework && <Icon name="check" />}</span></button>)}</div><div className="profile-context"><Icon name="info" /><p>{t(draft.framework === 'react-native' ? 'Devices, logs, captures and IDE debug for native React Native projects. Expo Go and build & release are not supported yet.' : draft.framework === 'flutter' ? 'Devices, IDE debug, logs, captures and build & release. Ready for your Flutter workflow.' : 'Choose the stack you use most. Your project’s framework is detected when you connect it.')}</p></div></fieldset> : <div className="profile-context backend-context"><Icon name="clock-3" /><p>{t('Backend tools are coming soon. Save your profile to see what’s planned, or choose Frontend to start using device tools.')}</p></div>}
      <p className="field-error" role="alert">{error ? t(error) : ''}</p><div className="profile-dialog-footer"><span><Icon name="hard-drive" />{t('Saved locally. Change anytime.')}</span><button type="button" className="button primary" disabled={busy || (draft.role === 'frontend' && !draft.framework)} onClick={() => void save()}>{t(busy ? 'Saving…' : draft.role === 'backend' ? 'Save Backend profile' : 'Open my workspace')}<Icon name="arrow-right" /></button></div>
    </dialog>
  </>;
}
export function mountDeveloperProfile() {
  const host = document.createElement('div'); document.body.append(host);
  const preferences = document.createElement('div'); preferences.id = 'profile-preference-root'; document.querySelector('#panel-preferences .product-heading')!.after(preferences);
  const backend = document.createElement('section'); backend.id = 'panel-backend'; backend.className = 'app-panel hidden'; backend.innerHTML = '<div id="backend-root"></div>'; document.querySelector('main')!.append(backend);
  const root = createRoot(host); root.render(<DeveloperProfile />);
  return () => { root.unmount(); host.remove(); preferences.remove(); backend.remove(); };
}
