import {Select} from '../../shared/controls/Select';
import {useEffect,useRef,useState} from 'react';
import {Icon} from '../../shared/ui/icons';
import {t} from '../../shared/ui/use-language';
import {api} from '../../legacy/device-controller.js';
import type {FormState,TeamWorkspace,Project,Environment} from './types';

export const roleLabel=(role:string)=>t(({owner:'Owner',lead:'Tech Lead',developer:'Developer',qa:'QA',devops:'DevOps',designer:'Designer',viewer:'Viewer'} as Record<string,string>)[role]||role);
export const envLabel=(env:string)=>t(({development:'Development',staging:'Staging',production:'Production'} as Record<string,string>)[env]||env);
export const formTitles:Record<FormState['kind'],string>={workspace:'Create team workspace',project:'Create team project',invite:'Invite team member',member:'Edit member access',service:'Configure service',device:'Register team device',handoff:'Create QA handoff',local:'Prepare local session','remove-member':'Remove team member'};
export function TeamForm({form,workspace,project,busy,error,close,submit}:{form:FormState;workspace:TeamWorkspace|null;project:Project|undefined;busy:boolean;error:string;close:()=>void;submit:(data:FormData)=>Promise<void>}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [allProjects,setAllProjects]=useState(form.member?.projectIds===null||form.kind==='invite');
 const [browseError,setBrowseError]=useState('');const [browsing,setBrowsing]=useState(false);const pathInput=useRef<HTMLInputElement>(null);
 const [serviceKind,setServiceKind]=useState(form.service?.kind||(workspace?.membership.serviceLayers?.includes('backend')?'backend':workspace?.membership.serviceLayers?.[0])||'backend');
 useEffect(()=>{dialog.current?.showModal();return()=>dialog.current?.close();},[]);
 async function browse(){setBrowsing(true);setBrowseError('');try{const value=await api('/api/folders/pick',{purpose:'workspace',language:window.SnapkitI18n.language});if(value.path&&pathInput.current)pathInput.current.value=value.path;}catch(e){setBrowseError(e instanceof Error?e.message:String(e));}finally{setBrowsing(false);}}
 const field=(label:string,name:string,options:{required?:boolean;maxLength?:number;defaultValue?:string;type?:string;placeholder?:string}={})=><label className="teams-field">{t(label)}<input name={name} autoComplete="off" {...options}/></label>;
 return <dialog className="teams-dialog" ref={dialog} aria-labelledby="teams-form-title" onCancel={e=>{if(busy||browsing)e.preventDefault();else close();}} onClose={()=>{if(!busy&&!browsing)close();}}>
  <form onSubmit={e=>{e.preventDefault();void submit(new FormData(e.currentTarget));}}>
   <header><span className="teams-eyebrow">SNAPKIT TEAMS</span><button className="icon-button" type="button" aria-label={t('Close')} disabled={busy||browsing} onClick={close}><Icon name="x"/></button></header>
   <h2 id="teams-form-title">{t(formTitles[form.kind])}</h2>
   {['workspace','project','service','invite'].includes(form.kind)&&<p className="teams-form-step">{t('Step {0} of 4',[({workspace:1,project:2,service:3,invite:4} as Record<string,number>)[form.kind]])}</p>}
   <fieldset disabled={busy||browsing}>
   {form.kind==='workspace'&&<>{field('Team workspace name','name',{required:true,maxLength:80})}<p className="teams-help">{t('You will own this workspace. Next, add your first project.')}</p></>}
   {form.kind==='project'&&<>{field('Project name','name',{required:true,maxLength:80})}<label className="teams-field">{t('Description')}<textarea name="description" maxLength={500} rows={3}/></label></>}
   {(form.kind==='invite'||form.kind==='member')&&<>
    {form.kind==='invite'?field('Google account email','email',{required:true,type:'email',maxLength:254}):<p className="teams-help">{form.member?.email}</p>}
    <label className="teams-field">{t('Team role')}<Select name="role" aria-label={t('Team role')} defaultValue={form.member?.role||'developer'}>{['lead','developer','qa','devops','designer','viewer'].map(r=><option value={r} key={r}>{roleLabel(r)}</option>)}</Select></label>
    <div className="teams-field"><span>{t('Project scope')}</span><label className="teams-check"><input type="checkbox" name="allProjects" checked={allProjects} onChange={e=>setAllProjects(e.target.checked)}/>{t('All current and future projects')}</label>{!allProjects&&workspace?.projects.map(p=><label className="teams-check" key={p.id}><input type="checkbox" name="projectIds" value={p.id} defaultChecked={form.member?.projectIds?.includes(p.id)}/>{p.name}</label>)}</div>
    <div className="teams-field"><span>{t('Environment scope')}</span>{(['development','staging','production'] as Environment[]).map(e=><label className="teams-check" key={e}><input type="checkbox" name="environments" value={e} defaultChecked={form.member?.environments.includes(e)??e!=='production'}/>{envLabel(e)}</label>)}</div>
    <div className="teams-field"><span>{t('Service layer scope')}</span>{['mobile','frontend','backend','data','mock'].map(layer=><label className="teams-check" key={layer}><input type="checkbox" name="serviceLayers" value={layer} defaultChecked={form.member?.serviceLayers?.includes(layer)??true}/>{t(layer)}</label>)}</div>
    <p className="teams-help">{t('Ask your teammate to sign in with this Google email and accept in Teams. No email is sent. Expires in 7 days.')}</p>
   </>}
   {form.kind==='service'&&<>
    {field('Service name','name',{required:true,maxLength:80,defaultValue:form.service?.name})}
    <label className="teams-field">{t('Project layer')}<Select name="kind" aria-label={t('Project layer')} value={serviceKind} onChange={e=>setServiceKind(e.target.value)}>{['mobile','frontend','backend','data','mock'].filter(k=>workspace?.membership.serviceLayers?.includes(k)??true).map(k=><option value={k} key={k}>{t(k)}</option>)}</Select></label>
    {field('Repository URL','repository',{type:'url',maxLength:2000,defaultValue:form.service?.repository,placeholder:'https://github.com/team/project'})}
    {field('Runtime requirement','runtime',{maxLength:120,defaultValue:form.service?.runtime,placeholder:'Node 22 / Flutter 3.35 / Postgres 16'})}
    <label className="teams-field">{t('Service owner')}<Select name="ownerId" aria-label={t('Service owner')} defaultValue={form.service?.ownerId||''}><option value="">{t('Unassigned')}</option>{workspace?.members.filter(m=>(m.projectIds===null||m.projectIds.includes(project?.id||''))&&(m.serviceLayers?.includes(serviceKind)??true)).map(m=><option key={m.userId} value={m.userId}>{m.name||m.email}</option>)}</Select></label>
    <p className="teams-help">{t('Add only what this service needs. Never enter passwords or tokens.')}</p>
   </>}
   {form.kind==='device'&&<>
    {field('Device name','name',{required:true,maxLength:80})}<label className="teams-field">{t('Platform')}<Select name="platform" aria-label={t('Platform')}><option value="android">Android</option><option value="ios">iOS</option></Select></label>{field('Host label','host',{maxLength:120,placeholder:t('e.g. QA workstation')})}<p className="teams-help">{t('Registers a shared booking resource. It does not connect or share control of a personal device.')}</p>
   </>}
   {form.kind==='handoff'&&<>
    {field('Handoff title','title',{required:true,maxLength:160})}{field('Commit hash','commit',{required:true,maxLength:40,placeholder:'8d2f4a1'})}{field('Build artifact URL','buildUrl',{required:true,type:'url',maxLength:2000})}{field('Build SHA-256','artifactSha256',{required:true,maxLength:64})}{field('Fixture reference','fixture',{maxLength:160})}<label className="teams-field">{t('Test steps')}<textarea name="steps" rows={4} maxLength={4000}/></label><p className="teams-help">{t('References are shared with the team. Use artifact links without tokens or query parameters. Do not include credentials or personal data.')}</p>
   </>}
   {form.kind==='local'&&<><p className="teams-help">{project?.name} · Blueprint v{project?.blueprint.version}</p><label className="teams-field">{t('Local project folder')}<span className="teams-folder"><input ref={pathInput} name="path" required maxLength={4096} placeholder="/Users/you/Projects/project"/><button className="button" type="button" onClick={()=>void browse()}>{t(browsing?'Opening…':'Browse')}</button></span></label><p className="teams-help">{t('Choose the existing project folder on this computer. Then run your project from your editor.')}</p></>}
   {form.kind==='remove-member'&&<p className="teams-help">{t('Remove access to this workspace and release their device reservations?')}<br/><strong>{form.member?.email}</strong></p>}
   </fieldset>
   {(error||browseError)&&<p className="teams-error" role="alert">{t(error||browseError)}</p>}
   <footer><button className="button" type="button" disabled={busy||browsing} onClick={close}>{t('Cancel')}</button><button className="button primary" type="submit" disabled={busy||browsing}>{t(busy?'Saving…':form.kind==='remove-member'?'Remove member':form.kind==='local'?'Prepare session':form.kind==='invite'?'Create invitation':'Save')}</button></footer>
  </form>
 </dialog>;
}
