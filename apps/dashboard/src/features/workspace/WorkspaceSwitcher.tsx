import {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {api, state, loadState, showWorkspace} from '../../legacy/device-controller.js';
import {showProductPage} from './product.js';
import {Icon} from '../../shared/ui/icons';
import {t, useLanguage} from '../../shared/ui/use-language';
import flutterLogo from '../onboarding/assets/flutter.svg';
import reactLogo from '../onboarding/assets/react-native.svg';
import './workspaces.css';
import type {ProjectDraft} from './types';

type Kind = 'flutter' | 'react-native' | 'backend';
type Space = {id:string; name:string; type:Kind; project:string};
type Listing = {activeId:string; workspaces:Space[]};
const label = (type:Kind) => type === 'flutter' ? 'Flutter' : type === 'react-native' ? 'React Native' : 'Backend';
function Mark({type}:{type:Kind}) {return type === 'backend' ? <Icon name="layers"/> : <img src={type === 'flutter' ? flutterLogo : reactLogo} width="24" height="24" alt=""/>;}
function WorkspaceSwitcher() {
  useLanguage();
  const [current,setCurrent] = useState({...state.settings});
  const [listing,setListing] = useState<Listing>({activeId:'',workspaces:[]});
  const [menu,setMenu] = useState(false), [creating,setCreating] = useState(false);
  const [loading,setLoading] = useState(false), [busy,setBusy] = useState(false), [error,setError] = useState('');
  const [kind,setKind] = useState<Kind>('flutter'), [name,setName] = useState('');
  const pendingDraft = useRef<ProjectDraft | null>(null);
  useEffect(() => {
    const recover = (event: Event) => {
      const {type, draft} = (event as CustomEvent<{type:Kind; draft:ProjectDraft}>).detail;
      pendingDraft.current = draft; setKind(type); setName(draft.path.split(/[\\/]/).filter(Boolean).at(-1)?.slice(0,80) || ''); setError(''); setMenu(false); setCreating(true);
    };
    document.addEventListener('snapkit:create-workspace', recover);
    return () => document.removeEventListener('snapkit:create-workspace', recover);
  }, []);
  function closeCreate() {
    setCreating(false); const draft = pendingDraft.current; pendingDraft.current = null;
    if(draft) requestAnimationFrame(() => showWorkspace(draft));
  }
  const trigger=useRef<HTMLButtonElement>(null), picker=useRef<HTMLDialogElement>(null), form=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const sync=()=>{
      const value={...state.settings}; setCurrent(value);
      if(value.spaceId) {
        const role=value.framework === 'backend' ? 'backend' : 'frontend', framework=role === 'backend' ? '' : value.framework || 'flutter';
        if(document.body.dataset.developerRole !== role || document.body.dataset.framework !== framework) {
          document.body.dataset.developerRole=role; document.body.dataset.framework=framework;
          document.dispatchEvent(new CustomEvent('snapkit:profile',{detail:{role,framework}}));
          showProductPage(role==='backend'?'backend':'devices', {discover:false});
        }
      }
    };
    sync(); document.addEventListener('snapkit:state',sync);
    return()=>document.removeEventListener('snapkit:state',sync);
  },[]);
  useEffect(()=>{
    const dialog=picker.current;
    if(menu && dialog && !dialog.open) {
      const rect=trigger.current!.getBoundingClientRect();
      dialog.style.left=Math.max(12,Math.min(rect.left,innerWidth-344))+'px';
      dialog.style.top=Math.min(rect.bottom+6,innerHeight-240)+'px';
      dialog.showModal();
    } else if(!menu && dialog?.open) dialog.close();
  },[menu]);
  useEffect(()=>{if(creating && !form.current?.open)form.current?.showModal();else if(!creating && form.current?.open)form.current.close();},[creating]);
  async function openMenu(){setError('');setLoading(true);setMenu(true);try {setListing(await api('/api/workspaces') as Listing);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setLoading(false);}}
  function openCreate(){setMenu(false);setKind(current.framework === 'react-native'?'react-native':'flutter');setName('');setError('');setCreating(true);}
  async function activate(id:string){
    if(id===listing.activeId){setMenu(false);return;}
    setBusy(true);setError('');
    try {await api('/api/workspaces/activate',{id});await loadState();setMenu(false);showProductPage(state.settings.framework==='backend'?'backend':'devices');}
    catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
  }
  async function create(event:React.FormEvent){event.preventDefault();setBusy(true);setError('');
    try {await api('/api/workspaces/create',{name:name.trim(),type:kind});await loadState();const draft=pendingDraft.current;pendingDraft.current=null;setCreating(false);showProductPage(kind==='backend'?'backend':'devices');if(draft&&kind!=='backend')requestAnimationFrame(()=>showWorkspace(draft));}
    catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
  }
  const type:Kind=current.framework === 'backend'?'backend':current.framework === 'react-native'?'react-native':'flutter';
  const title=current.spaceName || current.workspace?.split(/[\\/]/).filter(Boolean).at(-1) || t('Select workspace');
  return <>
    <button ref={trigger} className="workspace-switch" id="workspace-switch" aria-label={`${title}, ${t('Switch workspace')}`} aria-haspopup="dialog" aria-expanded={menu} onClick={()=>void openMenu()} title={title}>
      <span className="workspace-icon"><Mark type={type}/></span><span><strong id="workspace-name">{title}</strong><small>{label(type)} · {t('Workspace')}</small></span><Icon name="chevrons-up-down"/>
    </button>
    <dialog ref={picker} id="workspace-picker" aria-labelledby="workspace-picker-title" onClose={()=>setMenu(false)} onCancel={e=>{if(busy)e.preventDefault();}} onClick={e=>{if(!busy&&e.target===picker.current)setMenu(false);}}>
      <div className="space-picker-heading"><span id="workspace-picker-title">{t('Workspaces')}</span><button className="icon-button" aria-label={t('Close')} disabled={busy} onClick={()=>setMenu(false)}><Icon name="x"/></button></div>
      <div className="space-list" aria-busy={loading}>
        {loading?<p className="space-muted">{t('Loading…')}</p>:listing.workspaces.map(space=><button key={space.id} className="space-row" aria-pressed={space.id===listing.activeId} disabled={busy} onClick={()=>void activate(space.id)} title={space.project||space.name}>
          <span className="space-mark"><Mark type={space.type}/></span><span className="space-row-text"><strong>{space.name}</strong><small>{label(space.type)} · {space.type==='backend'?t('Coming soon'):space.project?space.project.split(/[\\/]/).filter(Boolean).at(-1):t('No project connected')}</small></span>{space.id===listing.activeId&&<Icon name="check"/>}
        </button>)}
      </div>
      {error&&<p className="field-error" role="alert">{t(error)}</p>}
      <div className="space-picker-actions"><button className="space-row" disabled={busy} onClick={openCreate}><Icon name="plus"/><span>{t('Create workspace')}</span></button>{type!=='backend'&&<button className="space-row" disabled={busy} onClick={()=>{setMenu(false);showWorkspace();}}><Icon name="folder-code"/><span>{t('Project settings')}</span></button>}</div>
    </dialog>
    <dialog ref={form} id="create-workspace-dialog" aria-labelledby="create-space-title" onClose={closeCreate} onCancel={e=>{if(busy)e.preventDefault();}}>
      <form onSubmit={event=>void create(event)}>
        <div className="space-form-heading"><span className="profile-terminal"><Icon name="folder-open"/> snapkit / workspace</span><button type="button" className="icon-button" aria-label={t('Close')} disabled={busy} onClick={closeCreate}><Icon name="x"/></button></div>
        <h2 id="create-space-title">{t('Create workspace')}</h2><p className="space-description">{t('Keep each stack and its project settings in a separate workspace.')}</p>
        <fieldset disabled={busy}><legend>{t('Workspace type')}</legend><div className="space-types">{(['flutter','react-native','backend'] as Kind[]).map(value=><button type="button" key={value} className="space-type" aria-pressed={kind===value} onClick={()=>setKind(value)}><Mark type={value}/><strong>{label(value)}</strong><small>{value==='backend'?t('Coming soon'):value==='flutter'?'Dart':'JavaScript / TypeScript'}</small><span className="space-type-check">{kind===value&&<Icon name="check"/>}</span></button>)}</div></fieldset>
        <label htmlFor="space-name">{t('Workspace name')}</label><input id="space-name" value={name} onChange={e=>setName(e.target.value)} placeholder={t('e.g. Mobile team')} maxLength={80} required disabled={busy} autoComplete="off"/>
        <div className="space-note"><Icon name={kind==='backend'?'clock-3':'folder-open'}/><p>{t(kind==='backend'?'You can create this workspace now. Backend tools are coming soon.':'Connect an existing project after creating the workspace. Your source files stay in their current folder.')}</p></div>
        <p className="field-error" role="alert">{error?t(error):''}</p><div className="space-form-footer"><button type="button" className="button" disabled={busy} onClick={closeCreate}>{t('Cancel')}</button><button type="submit" className="button primary" disabled={busy||!name.trim()}>{t(busy?'Creating…':'Create workspace')}<Icon name="arrow-right"/></button></div>
      </form>
    </dialog>
  </>;
}
export function mountWorkspaceSwitcher(){const old=document.getElementById('workspace-switch')!;const host=document.createElement('div');host.className='workspace-switch-root';old.replaceWith(host);const root=createRoot(host);flushSync(()=>root.render(<WorkspaceSwitcher/>));const create=()=>document.getElementById('workspace-switch')?.click();document.addEventListener('snapkit:workspaces',create);return()=>{document.removeEventListener('snapkit:workspaces',create);root.unmount();host.remove();};}
