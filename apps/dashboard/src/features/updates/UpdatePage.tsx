import {useActionFeedback} from '../../shared/ui/action-feedback';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { activePage, showProductPage } from '../workspace/product.js';
import { Icon } from '../../shared/ui/icons';
import { t, useLanguage } from '../../shared/ui/use-language';
import { updateStore } from './store';
import type { UpdateStatus } from './model';
const statuses: Record<UpdateStatus, string> = {
  idle: 'Check, download and install updates right here.', checking: 'Checking for updates…', latest: 'You’re using the latest version.',
  available: 'Snapkit {0} is ready to download.', downloading: 'Downloading Snapkit {0}…', verifying: 'Verifying and preparing the update…',
  ready: 'Snapkit {0} is ready to install.', installing: 'Restarting to install the update…', error: 'Could not finish the update. Try again.',
  unsupported: 'In-app updates are available in the installed macOS and Windows app.', web: 'Open Snapkit Desktop to update the app.'
};
const subscribePage = (notify: () => void) => { document.addEventListener('snapkit:page', notify); return () => document.removeEventListener('snapkit:page', notify); };
const mb = (bytes = 0) => (bytes / 1024 ** 2).toFixed(1);
const displayVersion = (version = '') => version.replace(/-beta\.(\d+)/i, ' ($1)');
function UpdatePage() {
  const state = useSyncExternalStore(updateStore.subscribe, updateStore.getSnapshot);
  const language = useLanguage();
  const page = useSyncExternalStore(subscribePage, () => activePage);
  const bridge = window.snapkitDesktop;
  const [action, setAction] = useState(false), [installing, setInstalling] = useState(false), [dismissed, dismiss] = useState(''), [cacheMessage, setCacheMessage] = useActionFeedback();
  const loading = useRef<HTMLDialogElement>(null), installButton = useRef<HTMLButtonElement>(null), wasBusy = useRef(false);
  const busy = installing || state.status === 'installing';
  const available = !!state.version && (['available', 'ready', 'downloading', 'verifying', 'installing', 'checking'].includes(state.status) || state.status === 'error' && state.retry === 'download');
  const noticeKey = state.version + ':' + (state.status === 'ready' ? 'ready' : 'available');
  const showNotice = available && ['available', 'ready', 'checking'].includes(state.status) && page !== 'updates' && dismissed !== noticeKey;
  const detail = state.error ? t(state.error) : state.status === 'downloading' ? t(state.transfer === 'planning' ? 'Preparing the update…' : '{0}% downloaded', [state.percent || 0]) : '';
  const transfer = state.transfer === 'delta' ? t('Downloading only changed data. Reusing {0} MB from this computer.', [mb(state.reused)]) : state.fallback ? t('Using the full package to complete this update.') : '';
  const technical = state.error ? '' : state.status === 'downloading' ? state.transfer === 'planning' ? t('Preparing a smaller update…') : `${state.percent || 0}% · ${mb(state.received)} / ${mb(state.size)} MB${transfer ? ' · ' + transfer : ''}` : state.status === 'ready' && state.transfer === 'delta' ? t('Smart update ready. Downloaded {0} MB instead of {1} MB.', [mb(state.downloadSize), mb(state.fullSize)]) : '';
  useEffect(() => {
    const refresh = () => { if (!document.hidden) void updateStore.refresh(); };
    refresh(); const timer = setInterval(refresh, 1000);
    for (const event of ['snapkit:page', 'visibilitychange']) document.addEventListener(event, refresh);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); for (const event of ['snapkit:page', 'visibilitychange']) document.removeEventListener(event, refresh); window.removeEventListener('focus', refresh); };
  }, []);
  useEffect(() => {
    document.getElementById('update-indicator')?.classList.toggle('hidden', !available);
    document.getElementById('update-banner')?.classList.toggle('hidden', !showNotice);
  }, [available, showNotice]);
  useLayoutEffect(() => {
    const dialog = loading.current;
    if (busy && dialog && !dialog.open) { dialog.showModal(); dialog.focus(); }
    if (!busy && dialog?.open) dialog.close();
    if (wasBusy.current && !busy) installButton.current?.focus();
    wasBusy.current = busy;
  }, [busy]);
  async function perform(run: (() => Promise<import('./model').UpdateState>) | undefined, install = false) {
    if (action || !run) return;
    if (install) flushSync(() => setInstalling(true));
    setAction(true);
    try { if (install) await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); await updateStore.perform(run); }
    finally { setAction(false); if (install) setInstalling(false); }
  }
  return <>
    <header className="page-heading"><div><h1 id="updates-title">{t('Updates')}</h1></div></header>
    <div className="preferences-card update-card" data-status={state.status}>
      <div className="updates-brand"><img src="./favicon.svg" alt="" width="56" height="56" /><span className="release-tag">Snapkit Desktop</span></div>
      <div className="setup-overview"><div><h2>Snapkit <span id="product-version">{displayVersion(state.current || __APP_VERSION__)}</span></h2><p id="update-status" role="status" aria-live="polite">{t(statuses[state.status], [displayVersion(state.version)])}</p></div>
        <button className={`button ${['downloading', 'verifying', 'ready', 'installing'].includes(state.status) ? 'hidden' : ''}`} type="button" id="check-updates" disabled={action || !bridge || ['unsupported', 'checking', 'downloading', 'verifying', 'ready', 'installing'].includes(state.status)} onClick={() => void perform(bridge?.checkUpdates)}><Icon name="refresh-cw" />{t('Check for updates')}</button>
      </div>
      <progress className={['downloading', 'verifying'].includes(state.status) ? '' : 'hidden'} id="update-progress" max="100" value={state.status === 'verifying' || state.transfer === 'planning' ? undefined : state.percent || 0} aria-label={t('Update download progress')} />
      <p id="update-detail" className={`fine-print ${detail ? '' : 'hidden'}`} role="status">{detail}</p>
      <div className="preferences-actions">
        <button id="update-download" type="button" className={`button primary ${state.status === 'available' || state.status === 'error' && state.retry === 'download' ? '' : 'hidden'}`} disabled={action} onClick={() => void perform(bridge?.downloadUpdate)}><Icon name="download" />{t('Download update')}</button>
        <button id="update-install" ref={installButton} type="button" className={`button primary ${state.status === 'ready' ? '' : 'hidden'}`} disabled={action} onClick={() => void perform(bridge?.installUpdate, true)}><Icon name="rotate-cw" />{t('Restart and install')}</button>
        <button id="update-cancel" type="button" className={`button ${state.status === 'downloading' ? '' : 'hidden'}`} disabled={action} onClick={() => void perform(bridge?.cancelUpdate)}>{t('Cancel download')}</button>
      </div><p className="fine-print">{t('Snapkit will restart to install the update.')}</p>
    </div>
    <details className="interface-details" id="update-details"><summary>{t('Update details')}</summary><div className="interface-details-body"><p id="update-transfer-detail" className={technical ? '' : 'hidden'}>{technical}</p>
      <a className="button updates-notes" href="https://github.com/bimbimvqt/snapkit/releases" target="_blank" rel="noopener noreferrer"><Icon name="notebook-text" />{t('Release notes')}<Icon name="arrow-up-right" /></a>
      <p className="updates-delta-note">{t('Smart updates reuse unchanged data on this computer when possible. Snapkit verifies the complete package before installation and uses a full download when needed.')}</p>
      <div className="updates-schedule"><Icon name="clock-3" /><div><h2>{t('Checked automatically every 10 minutes')}</h2><p id="update-schedule-note">{t(bridge && state.status !== 'unsupported' ? 'Checks run in the background while Snapkit is open. Downloads and restarts always need your action.' : 'Automatic checks are available in the installed macOS and Windows app.')}</p><p id="update-last-checked" role="status">{state.lastCheckedAt ? t('Last checked: {0}', [new Date(state.lastCheckedAt).toLocaleString(language)]) : t('No completed check yet.')}</p></div></div>
    </div></details>
    {createPortal(<>{t(state.status === 'ready' ? 'Ready' : state.status === 'downloading' ? '{0}%' : 'New', [state.percent || 0])}</>, document.getElementById('update-indicator')!)}
    {createPortal(<><Icon name="download" /><p id="update-banner-text" role="status" aria-live="polite">{available ? t(state.status === 'ready' ? 'Snapkit {0} is ready to install.' : 'Snapkit {0} is available.', [displayVersion(state.version)]) : ''}</p><button type="button" className="button" id="update-view" onClick={() => showProductPage('updates')}>{t('View update')}</button><button type="button" className="icon-button" id="update-dismiss" aria-label={t('Dismiss update notice')} onClick={() => dismiss(noticeKey)}><Icon name="x" /></button></>, document.getElementById('update-banner')!)}
    {createPortal(<dialog id="update-loading" ref={loading} aria-labelledby="update-loading-title" aria-describedby="update-loading-note" tabIndex={-1} onCancel={event => event.preventDefault()}><div className="update-loading-content"><img src="./favicon.svg" width="72" height="72" alt="" /><span className="update-loading-brand">Snapkit</span><h2 id="update-loading-title">{t('Preparing to restart…')}</h2><p id="update-loading-note">{t('Snapkit will close to install the update. Please keep your computer on.')}</p><div className="update-loading-track" role="progressbar" aria-label={t('Installing update')}><span /></div><p className="update-loading-hint">{t('Your projects, devices and account will be kept.')}</p><span className="update-loading-status" role="status" aria-live="polite">{busy ? t('Preparing to restart…') : ''}</span></div></dialog>, document.body)}
    {createPortal(<><div className="setup-overview"><div><h2>{t('App cache')}</h2><p>{t('Removes cached images, scripts and styles used by Snapkit’s interface.')}</p><p>{t('Keeps your sign-in, preferences, projects, SDKs, virtual devices and saved captures. This does not clear build or emulator caches.')}</p></div><button id="clear-app-cache" type="button" className="button" disabled={!bridge?.clearCache || action} onClick={async () => { if (!bridge?.clearCache) return; setAction(true); try { await bridge.clearCache(); setCacheMessage('Temporary app cache cleared.'); } catch { setCacheMessage('Could not clear the cache. Try again.'); } finally { setAction(false); } }}>{t('Clear cache')}</button></div></>, document.getElementById('app-cache-root')!)}
  </>;
}
export function mountUpdates() { const root = createRoot(document.getElementById('panel-updates')!); flushSync(() => root.render(<UpdatePage />)); return () => root.unmount(); }
