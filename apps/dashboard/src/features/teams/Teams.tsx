import {updateStore} from '../updates/store';
import {useActionFeedback} from '../../shared/ui/action-feedback';
import {reconcileSnapshot} from '../../shared/state/reconcile.js';
import {DeviceHost} from './DeviceHost';
import {TeamStartKit} from './TeamStartKit';
import {TaskBoard} from './TaskBoard';
import {TeamDebug} from './TeamDebug';
import {WorkspaceOverview} from './WorkspaceOverview';
import {ProjectIcon} from './ProjectIcon';
import {SetupJourney} from './SetupJourney';
import {Select} from '../../shared/controls/Select';
import {useCallback,useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {createRoot} from 'react-dom/client';
import {createPortal,flushSync} from 'react-dom';
import {showProductPage} from '../workspace/product.js';
import {MemberIdentity,MemberProvider} from '../account/MemberIdentity';
import {api} from '../../legacy/device-controller.js';
import {Icon} from '../../shared/ui/icons';
import {t,useLanguage} from '../../shared/ui/use-language';
import {applyAppearance,getAppearance} from '../appearance/theme';
import {TeamForm,roleLabel,envLabel} from './TeamForm';
import type {Page,Environment,TeamListing,TeamWorkspace,Project,FormState,LocalSession,Service,Task} from './types';
import './teams.css';
import './messages.js';

const navigation:[Page,string,string][]=[['home','panels-top-left','Overview'],['tasks','list','Tasks'],['sessions','radio','Team Debug Sync'],['projects','layers','Projects & services'],['devices','smartphone','Device Lab'],['handoffs','package','Handoffs & approvals'],['members','shield-check','Members & access'],['audit','logs','Activity log']];
const emptyListing:TeamListing={userId:'',workspaces:[],invitations:[],roles:[],environments:[]};
const time=(value:string|number)=>new Date(value).toLocaleString(window.SnapkitI18n.language==='vi'?'vi-VN':'en-US',{dateStyle:'short',timeStyle:'short'});
const rolePermissions:[string,string[]][]=[['Edit project',['owner','lead','pm']],['Manage members',['owner']],['Create projects',['owner','lead','pm']],['Edit blueprint',['owner','lead','devops']],['Prepare local session',['owner','lead','developer','qa','devops']],['Reserve team devices',['owner','lead','developer','qa','devops']],['Confirm QA',['qa']],['Approve release',['lead','devops']]];
const statuses:Record<string,string>={pending:'Waiting for QA','qa-approved':'QA confirmed',approved:'Approved','changes-requested':'Changes requested'};
const actions:Record<string,string>={'task.assigned':'Task assigned','task.updated':'Task assignment updated','task.accepted':'Task accepted','task.status':'Task status changed','task.comment':'New task comment','task.unblocked':'A dependency is complete','task.blocked':'Task blocker updated','task.checklist':'Acceptance criteria','debug.prepared':'Prepare Debug Sync','debug.stop-requested':'Request stop','workspace.created':'Workspace created','project.created':'Project created','project.updated':'Project updated','start-kit.updated':'Team start kit updated','invitation.created':'Invitation created','invitation.email.sent':'Invitation email sent','invitation.email.failed':'Invitation email failed','invitation.accepted':'Invitation accepted','invitation.revoked':'Invitation revoked','member.access.updated':'Member access updated','member.removed':'Member removed','blueprint.updated':'Blueprint updated','device.registered':'Device registered','device.reserved':'Device reserved','device.released':'Device released','handoff.created':'Handoff created','handoff.qa-approved':'QA confirmed','handoff.approved':'Release approved','handoff.changes-requested':'Changes requested'};
function initialMode(){try{const product=new URL(location.href).searchParams.get('product');if(window.SNAPKIT_PREVIEW)return product==='teams'?'teams':'personal';return product==='teams'||localStorage.getItem('snapkit-product-mode')==='teams'?'teams':'personal';}catch{return 'personal';}}
function Teams({personalHost}:{personalHost:HTMLElement}){
 useLanguage();
 const update=useSyncExternalStore(updateStore.subscribe,updateStore.getSnapshot);
 const updateAvailable=!!update.version&&(['available','ready','downloading','verifying','installing','checking'].includes(update.status)||update.status==='error'&&update.retry==='download');
 const [mode,setMode]=useState(initialMode);
 const [sharedPage,setSharedPage]=useState<'profile'|'updates'|null>(null);const sharedHost=useRef<HTMLDivElement>(null);
 useEffect(()=>{const changed=(event:Event)=>{const page=(event as CustomEvent).detail;if(mode==='teams'&&(page==='profile'||page==='updates'))setSharedPage(page);};document.addEventListener('snapkit:page',changed);return()=>document.removeEventListener('snapkit:page',changed);},[mode]);
 useEffect(()=>{if(mode!=='teams'||!sharedPage)return;const panel=document.getElementById('panel-'+sharedPage),host=sharedHost.current;if(!panel||!host)return;const parent=panel.parentNode!,next=panel.nextSibling;host.append(panel);panel.classList.remove('hidden');return()=>{parent.insertBefore(panel,next?.parentNode===parent?next:null);};},[mode,sharedPage]);
 const [selectedTask,setSelectedTask]=useState(''),[debugTask,setDebugTask]=useState<Task|null>(null);
 const [page,setPage]=useState<Page>('home'),[listing,setListing]=useState<TeamListing>(emptyListing),[workspace,setWorkspace]=useState<TeamWorkspace|null>(null);
 const [workspaceId,setWorkspaceId]=useState(''),[projectId,setProjectId]=useState(''),[environment,setEnvironment]=useState<Environment>('development');
 const [pendingTaskId,setPendingTaskId]=useState('');
 const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useActionFeedback();
 const [form,setForm]=useState<FormState|null>(null),[formError,setFormError]=useState(''),[localSession,setLocalSession]=useState<LocalSession|null>(null);
 const epoch=useRef(0),heading=useRef<HTMLHeadingElement>(null),workspaceIdRef=useRef(''),snapshot=useRef<TeamWorkspace|null>(null),notificationTarget=useRef<{workspaceId:string;projectId?:string;environment?:Environment}|null>(null);
 const project=workspace?.projects.find(p=>p.id===projectId)||workspace?.projects[0];
 const isPreview=!!window.SNAPKIT_PREVIEW;
 const can=(permission:string,env?:Environment)=>!!workspace?.membership.permissions.includes(permission)&&(!env||workspace.membership.environments.includes(env))&&(permission!=='blueprint.write'||workspace.membership.serviceLayers?.length!==0);
 function changeMode(next:'personal'|'teams'){setSharedPage(null);setMode(next);}
 useEffect(()=>{const button=document.getElementById('guide-open-teams');const open=()=>{setMode('teams');setPage('tasks');};button?.addEventListener('click',open);return()=>button?.removeEventListener('click',open);},[]);
 useEffect(()=>{document.body.dataset.productMode=mode;try{if(!window.SNAPKIT_PREVIEW)localStorage.setItem('snapkit-product-mode',mode);}catch{}document.dispatchEvent(new CustomEvent('snapkit:product-mode',{detail:mode}));},[mode]);
 useEffect(()=>{const switchMode=(e:Event)=>{const m=(e as CustomEvent).detail;if(m==='teams'||m==='personal')setMode(m);};document.addEventListener('snapkit:select-product',switchMode);return()=>document.removeEventListener('snapkit:select-product',switchMode);},[]);
 const install=useCallback((value:TeamWorkspace,notify=true)=>{const next=reconcileSnapshot(snapshot.current,value);snapshot.current=next;setWorkspace(next);if(notify)document.dispatchEvent(new Event('snapkit:teams-updated'));setWorkspaceId(value.id);workspaceIdRef.current=value.id;const target=notificationTarget.current;notificationTarget.current=null;setProjectId(current=>{const preferred=target?.workspaceId===value.id?target.projectId:current;return value.projects.some(p=>p.id===preferred)?preferred!:value.projects[0]?.id||'';});setEnvironment(current=>{const preferred=target?.workspaceId===value.id?target.environment:current;return preferred&&value.membership.environments.includes(preferred)?preferred:value.membership.environments[0]||'development';});},[]);
 const refresh=useCallback(async(preferred?:string,quiet=false)=>{
  const current=++epoch.current;if(!quiet)setLoading(true);setError('');
  try{
   const result=await api('/api/teams') as TeamListing;if(current!==epoch.current)return;setListing(previous=>reconcileSnapshot(previous,result));
   let remembered='';try{remembered=localStorage.getItem('snapkit-team-workspace:'+result.userId)||'';}catch{}
   const id=[preferred,workspaceIdRef.current,remembered,result.workspaces[0]?.id].find(candidate=>candidate&&result.workspaces.some(w=>w.id===candidate));
   if(id){const value=await api('/api/teams/'+id) as TeamWorkspace;if(current!==epoch.current)return;install(value,!quiet);try{localStorage.setItem('snapkit-team-workspace:'+result.userId,id);}catch{}}
   else{snapshot.current=null;setWorkspace(null);setWorkspaceId('');workspaceIdRef.current='';}
  }catch(e){if(current!==epoch.current)return;if([401,403,404].includes(Number((e as {status?:number})?.status))||/sign in|access revoked/i.test(e instanceof Error?e.message:String(e))){snapshot.current=null;setWorkspace(null);setLocalSession(null);}setError(e instanceof Error?e.message:String(e));}
  finally{if(current===epoch.current)setLoading(false);}
 },[install]);
 useEffect(()=>{if(mode==='teams')void refresh();else{epoch.current++;setLoading(false);}},[mode,refresh]);
 useEffect(()=>{
  if(mode!=='teams'||busy||form)return;
  const poll=()=>{if(!document.hidden)void refresh(undefined,true);};
  const timer=setInterval(poll,30000);document.addEventListener('visibilitychange',poll);
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',poll);};
 },[mode,busy,form,refresh]);
 useEffect(()=>{setLocalSession(null);},[workspaceId,project?.id]);
 useEffect(()=>{
  if(mode!=='teams'||!workspace||!project||!workspace.membership.permissions.includes('sessions.prepare')||!workspace.membership.environments.includes('development'))return;
  let active=true;void api('/api/teams/local-session?workspaceId='+encodeURIComponent(workspace.id)+'&projectId='+encodeURIComponent(project.id)).then((result:{session:LocalSession|null})=>{if(active)setLocalSession(result.session);}).catch(()=>{});
  return()=>{active=false;};
 },[mode,workspace?.id,project?.id,workspace?.membership.role]);
 useEffect(()=>{if(mode==='teams')heading.current?.focus();},[page,mode]);
 function open(kind:FormState['kind'],extra:Partial<FormState>={}){if(isPreview)return;setFormError('');setForm({kind,...extra});}
 async function perform(route:string,data:unknown){if(busy)return;setBusy(true);setLoading(false);setError('');setMessage('');epoch.current++;try{const value=await api('/api/teams'+route,data) as TeamWorkspace;install(value);setMessage(t('Team changes saved.'));}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
 async function submit(data:FormData){
  if(!form||busy)return;setBusy(true);setLoading(false);setFormError('');setMessage('');epoch.current++;
  const value=(key:string)=>String(data.get(key)||'').trim();const base=workspace?'/'+workspace.id:'';
  try{
   let route=base,payload:unknown={},local=false;
   switch(form.kind){
    case'workspace':route='';payload={name:value('name')};break;
    case'project':case'project-edit':route+=form.kind==='project'?'/projects':'/projects/'+project!.id+'/identity';payload={name:value('name'),description:value('description'),icon:value('icon')};break;
    case'invite':case'member':route+=form.kind==='invite'?'/invitations':'/members/'+encodeURIComponent(form.member!.userId);payload={email:value('email'),role:value('role'),projectIds:data.has('allProjects')?null:data.getAll('projectIds'),environments:data.getAll('environments'),serviceLayers:data.getAll('serviceLayers')};break;
    case'remove-member':route+='/members/'+encodeURIComponent(form.member!.userId)+'/remove';break;
    case'service':{
     if(!project)throw Error('Select a team project.');const services=[...project.blueprint.services];const service={name:value('name'),kind:value('kind')==='__custom__'?value('customKind').normalize('NFKC'):value('kind'),repository:value('repository'),runtime:value('runtime'),ownerId:value('ownerId')} as Service;
     if(form.serviceIndex!==undefined)services[form.serviceIndex]=service;else services.push(service);
     route+='/projects/'+project.id+'/blueprint';payload={version:project.blueprint.version,services};break;}
    case'device':route+='/devices';payload={name:value('name'),platform:value('platform'),host:value('host'),projectId:project?.id};break;
    case'handoff':route+='/handoffs';payload={title:value('title'),commit:value('commit'),buildUrl:value('buildUrl'),artifactSha256:value('artifactSha256'),fixture:value('fixture'),steps:value('steps'),projectId:project?.id,environment,blueprintVersion:project?.blueprint.version,taskId:form.task?.id,taskVersion:form.task?.version};break;
    case'local':route='/local-session';payload={workspaceId:workspace?.id,projectId:project?.id,environment,path:value('path')};local=true;break;
   }
   const result=await api('/api/teams'+route,payload);
   if(local){setLocalSession(result.session);setMessage(t('Local binding prepared. No services were started.'));}
   else{install(result as TeamWorkspace);const invitation=form.kind==='invite'?(result as TeamWorkspace).invitations.find(i=>i.email===value('email').toLowerCase()):null;setMessage(t(invitation?(invitation.delivery?.status==='sent'?'Invitation email sent':invitation.delivery?.status==='not_configured'?'Invitation created. Email delivery is not configured.':'Invitation created. Email could not be sent; retry in Members & access.'):'Team changes saved.'));if(form.kind==='workspace')await refresh(result.id);}
   setForm(null);
  }catch(e){setFormError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
 }
 async function selectWorkspace(id:string){if(busy)return;setWorkspace(null);setLocalSession(null);setMessage('');workspaceIdRef.current=id;setWorkspaceId(id);await refresh(id);}
 async function saveTask(route:string,data:unknown){if(isPreview||busy)throw Error(t('Changes unavailable.'));setMessage('');setBusy(true);setLoading(false);setPendingTaskId(route.match(/\/tasks\/([^/]+)\//)?.[1]||'new');setError('');epoch.current++;try{install(await api('/api/teams'+route,data,true));}catch(e){setError(e instanceof Error?e.message:String(e));throw e;}finally{setBusy(false);setPendingTaskId('');}}
 const go=(next:Page)=>{setSharedPage(null);setPage(next);setMessage('');};
 const productSwitch=(compact=false)=><div className={'product-mode-switch'+(compact?' compact':'')} role="group" aria-label={t('Snapkit product')}><button type="button" aria-label={t('Personal')} aria-pressed={mode==='personal'} onClick={()=>changeMode('personal')}><Icon name="laptop"/><span>{t('Personal')}</span></button><button type="button" aria-label="Teams" aria-pressed={mode==='teams'} onClick={()=>changeMode('teams')}><Icon name="group"/><span>Teams</span></button></div>;
 const callButton=(label:string,click:()=>void,primary=false,disabled=false)=><button type="button" className={'button'+(primary?' primary':'')} disabled={busy||disabled} onClick={click}>{t(label)}</button>;
 function empty(title:string,description:string,action?:React.ReactNode){return <section className="teams-empty"><Icon name="layers"/><h2>{t(title)}</h2><p>{t(description)}</p>{action}</section>;}
 function overview(){if(!workspace)return null;return <>
  {workspace.tasks?.length? <section className="teams-card"><h2>{t('Your next step')}</h2><p>{workspace.tasks.filter(x=>x.assigneeId===workspace.membership.userId&&!['done','cancelled'].includes(x.status)).length} {t('active assignments')}</p><button className="button primary" onClick={()=>go('tasks')}>{t('Open task board')}</button></section>:null}
  {(!project||!(project.blueprint.hasServices??project.blueprint.services.length)||workspace.members.length<2)?<SetupJourney workspace={workspace} project={project} localSession={localSession} preview={isPreview} can={can} onAction={action=>{if(action==='members')go('members');else open(action);}}/>:<WorkspaceOverview workspace={workspace} project={project} go={go} onInvite={()=>open('invite')} canInvite={can('members.manage')} preview={isPreview}/>}

  {project&&!isPreview&&<div className="teams-overview-actions">{can('sessions.prepare','development')&&callButton(localSession?'Local folder connected':'Prepare local session',()=>open('local'))}{can('handoffs.create',environment)&&callButton('Create QA handoff',()=>open('handoff'),true)}</div>}
  {localSession&&<section className="teams-session"><Icon name="folder-code"/><div><strong>{t('Local project prepared')}</strong><code>{localSession.path}</code><small>{t('Prepared configuration only. Launch your project from your IDE or terminal.')}</small></div></section>}

  <section className="teams-section"><h2>{t('Recent activity')}</h2>{workspace.audit.length?<div className="teams-events">{workspace.audit.slice(0,4).map(a=><div key={a.id}><Icon name="logs"/><span><strong><MemberIdentity userId={a.actorId} name={a.actorName}/></strong> · {t(actions[a.action]||a.action)}</span><time>{time(a.at)}</time></div>)}</div>:<p className="teams-help">{t('No activity yet.')}</p>}</section>
 </>;}
 function projects(){if(!workspace)return null;return <>
 {project&&<TeamStartKit key={project.id+':'+(project.startKit?.version||0)} workspaceId={workspace.id} project={project} manager={can('projects.edit','development')} canUse={can('sessions.prepare','development')} preview={isPreview} busy={busy} save={data=>perform('/'+workspace.id+'/projects/'+project.id+'/start-kit',data)}/>}
  <div className="teams-sectionbar"><h2>{t('Project structure')}</h2>{can('projects.create')&&(workspace.membership.role==='owner'||workspace.membership.projectIds===null)&&callButton('Create team project',()=>open('project'),true)}</div>
  <div className="teams-project-grid">{workspace.projects.map(p=><button className="teams-project" key={p.id} aria-pressed={p.id===project?.id} onClick={()=>setProjectId(p.id)}><ProjectIcon value={p.icon}/><strong>{p.name}</strong><span>{p.blueprint.services.length} {t('services')} · v{p.blueprint.version}</span></button>)}</div>
  {project?<><div className="teams-sectionbar"><div className="teams-project-title"><ProjectIcon value={project.icon}/><div><h2>{project.name}</h2>{project.description&&<p className="teams-help">{project.description}</p>}</div></div><div className="teams-inline">{can('projects.edit')&&callButton('Edit project',()=>open('project-edit'))}{can('blueprint.write','development')&&callButton('Add service',()=>open('service'),true)}</div></div><div className="teams-service-list">{project.blueprint.services.map((s,index)=><article className="teams-service" key={index}><span className="teams-avatar"><Icon name={s.kind==='data'?'hard-drive':s.kind==='mobile'?'smartphone':'code-xml'}/></span><div><h3>{s.name} <span className="teams-badge">{t(s.kind)}</span></h3><p>{s.runtime||t('Runtime not specified')}{s.ownerId&&<> · {t('Service owner')}: <MemberIdentity userId={s.ownerId}/></>}</p>{s.repository&&<a href={s.repository} target="_blank" rel="noopener noreferrer">{s.repository}<Icon name="arrow-up-right"/></a>}</div>{can('blueprint.write','development')&&<div className="teams-inline">{callButton('Edit',()=>open('service',{service:s,serviceIndex:index}))}{callButton('Remove service',()=>void perform('/'+workspace.id+'/projects/'+project.id+'/blueprint',{version:project.blueprint.version,services:project.blueprint.services.filter((_,i)=>i!==index)}))}</div>}</article>)}</div>{!project.blueprint.services.length&&empty('Define your project layers','Add mobile, frontend, backend, data or mock services to this blueprint.',can('blueprint.write','development')?callButton('Add service',()=>open('service')):undefined)}<details className="teams-history"><summary>{t('Blueprint history')} · {project.history.length+1} {t('versions')}</summary><div className="teams-events">{[...project.history,project.blueprint].slice().reverse().map(b=><div key={b.version}><strong>v{b.version}</strong><span>{b.services.length} {t('services')} · <MemberIdentity userId={b.updatedBy}/></span><time>{time(b.updatedAt)}</time></div>)}</div></details></>:empty('No team projects yet','Create a project to define its services, blueprint and shared resources.')}
 </>;}
 function devices(){const devices=workspace?.devices.filter(d=>d.projectId===project?.id)||[];return <>
  <div className="teams-sectionbar"><h2>{t('Shared device bookings')}</h2>{project&&can('devices.manage','development')&&callButton('Register team device',()=>open('device'),true)}</div>
  <p className="teams-help">{t('Book a shared device for your testing session.')}</p>
  <div className="teams-card-grid">{devices.map(d=>{const reservation=d.reservation&&d.reservation.expiresAt>Date.now()?d.reservation:null;return <article className="teams-card" key={d.id}><div className="teams-sectionbar"><Icon name="smartphone"/><span className="teams-badge">{d.platform==='ios'?'iOS':'Android'}</span></div><h2>{d.name}</h2><p>{d.host||t('Host not specified')}</p><span className="teams-badge">{t(d.hostPresence?.online?'Host online':d.hostPresence?'Host offline':'Host not connected')}</span>{!isPreview&&can('devices.manage','development')&&<DeviceHost workspaceId={workspace!.id} deviceId={d.id} platform={d.platform} refresh={()=>void refresh(undefined,true)}/>}<div className="teams-sectionbar"><span className={'teams-badge'+(reservation?' pending':' ready')}>{reservation?<><MemberIdentity userId={reservation.userId} name={reservation.name}/> · {time(reservation.expiresAt)}</>:t('Available to book')}</span>{reservation?(reservation.userId===workspace?.membership.userId||can('devices.manage','development'))&&callButton('Release booking',()=>void perform('/'+workspace!.id+'/devices/'+d.id+'/release',{})):callButton('Book 30 minutes',()=>void perform('/'+workspace!.id+'/devices/'+d.id+'/reserve',{minutes:30}),false,!can('devices.reserve','development')||environment==='production')}</div></article>;})}</div>
  {!devices.length&&empty('No team devices registered','Register a booking resource for this project. Your personal device list stays separate.')}
 </>;}
 function handoffs(){const handoffs=workspace?.handoffs.filter(h=>h.projectId===project?.id&&h.environment===environment)||[];return <>
  <div className="teams-sectionbar"><h2>{t('Dev → QA → Release')}</h2>{project&&can('handoffs.create',environment)&&callButton('Create QA handoff',()=>open('handoff'),true)}</div>
  <p className="teams-help">{t('Submit a build → QA checks → Lead approves.')}</p>
  <div className="teams-handoff-list">{handoffs.slice().reverse().map(h=><article className="teams-card" key={h.id}><div className="teams-sectionbar"><span className={'teams-badge '+(h.status==='approved'?'ready':'pending')}>{t(statuses[h.status])}</span><span className="teams-help">{time(h.createdAt)}</span></div><h2>{h.title}</h2><p><MemberIdentity userId={h.createdBy}/> · {envLabel(h.environment)} · Blueprint v{h.blueprintVersion} · <code>{h.commit}</code></p>{h.buildUrl&&<a className="teams-artifact" href={h.buildUrl} target="_blank" rel="noopener noreferrer">{t('Open build artifact')}<Icon name="arrow-up-right"/></a>}<p className="teams-digest" hidden={isPreview}>SHA-256: <code>{h.artifactSha256}</code><small>{t('Provided by the author. Verify the downloaded artifact before testing.')}</small></p>{h.fixture&&<p>{t('Fixture reference')}: {h.fixture}</p>}{h.steps&&<details><summary>{t('Test steps')}</summary><pre>{h.steps}</pre></details>}<details><summary>{t('Handoff blueprint snapshot')} · v{h.blueprint.version}</summary><div className="teams-events">{h.blueprint.services.map((s,i)=><div key={i}><strong>{s.name}</strong><span>{t(s.kind)} · {s.runtime}</span></div>)}</div></details>{h.qa&&<p className="teams-help">QA: <MemberIdentity userId={h.qa.userId}/> · {time(h.qa.at)} {h.qa.note}</p>}{h.approval&&<p className="teams-help">{t('Approved by')}: <MemberIdentity userId={h.approval.userId}/> · {time(h.approval.at)}</p>}<div className="teams-inline">{h.status==='pending'&&(can('qa.confirm',h.environment)||workspace?.tasks?.some(x=>x.handoffId===h.id&&x.testerId===workspace.membership.userId))&&h.createdBy!==workspace?.membership.userId&&<>{callButton('Confirm QA passed',()=>void perform('/'+workspace!.id+'/handoffs/'+h.id+'/review',{decision:'pass'}),true)}{callButton('Request changes',()=>void perform('/'+workspace!.id+'/handoffs/'+h.id+'/review',{decision:'changes'}))}</>}{h.status==='qa-approved'&&can('release.approve',h.environment)&&h.createdBy!==workspace?.membership.userId&&h.qa?.userId!==workspace?.membership.userId&&callButton('Approve release',()=>void perform('/'+workspace!.id+'/handoffs/'+h.id+'/review',{decision:'approve'}),true)}</div></article>)}</div>
  {!handoffs.length&&empty('No handoffs in this environment','Create a handoff with a commit, artifact URL, fixture reference and test steps.')}
 </>;}
 function members(){if(!workspace)return null;return <>
  <div className="teams-sectionbar"><h2>{t('Team members')}</h2>{can('members.manage')&&callButton('Invite team member',()=>open('invite'),true)}</div><div className="teams-table-wrap"><table className="teams-table"><thead><tr><th>{t('Member')}</th><th>{t('Team role')}</th><th>{t('Scope')}</th><th>{t('Actions')}</th></tr></thead><tbody>{workspace.members.map(m=><tr key={m.userId}><td><strong><MemberIdentity userId={m.userId}/></strong><small>{m.email}</small></td><td>{roleLabel(m.role)}</td><td><small>{m.projectIds===null?t('All projects'):m.projectIds.map(id=>workspace.projects.find(p=>p.id===id)?.name).filter(Boolean).join(', ')||t('No projects')}</small><small>{m.environments.map(envLabel).join(' · ')}</small><small>{(m.serviceLayers||['mobile','frontend','backend','data','mock']).map(layer=>t(layer)).join(' · ')}</small></td><td>{m.role!=='owner'&&can('members.manage')&&<div className="teams-inline">{callButton('Edit',()=>open('member',{member:m}))}{callButton('Remove',()=>open('remove-member',{member:m}))}</div>}</td></tr>)}</tbody></table></div>
  {workspace.invitations.length>0&&<section className="teams-section"><h2>{t('Pending invitations')}</h2><div className="teams-events">{workspace.invitations.map(i=><div key={i.id}><span>{i.email} · {roleLabel(i.role)}<small>{t('Expires')}: {time(i.expiresAt)}</small><small role="status">{t(({sent:'Invitation email sent',failed:'Email failed. Try sending again.',not_configured:'Email delivery is not configured. Contact your administrator.',sending:'Email submission pending. Refresh to check.',not_sent:'Email has not been sent.'} as Record<string,string>)[i.delivery?.status||'not_sent'])}</small></span><div className="teams-inline">{callButton('Resend email',()=>void perform('/'+workspace.id+'/invitations/'+i.id+'/resend',{}))}{callButton('Revoke',()=>void perform('/'+workspace.id+'/invitations/'+i.id+'/revoke',{}))}</div></div>)}</div></section>}
  <details className="teams-section teams-permissions"><summary>{t('Role permissions')}</summary><p className="teams-help">{t('Actions also require project and environment scope. Workspace ownership does not grant release approval or production secrets.')}</p><div className="teams-table-wrap"><table className="teams-table"><thead><tr><th>{t('Function')}</th>{['owner','lead','pm','developer','qa','devops','designer','viewer'].map(r=><th key={r}>{roleLabel(r)}</th>)}</tr></thead><tbody>{rolePermissions.map(([label,roles])=><tr key={label}><th>{t(label)}</th>{['owner','lead','pm','developer','qa','devops','designer','viewer'].map(r=><td key={r}>{roles.includes(r)?t('Allowed'):t('Not allowed')}</td>)}</tr>)}</tbody></table></div></details>
 </>;}
 function audit(){return <div className="teams-table-wrap"><table className="teams-table"><thead><tr><th>{t('Time')}</th><th>{t('Member')}</th><th>{t('Action')}</th><th>{t('Scope')}</th></tr></thead><tbody>{workspace?.audit.map(a=><tr key={a.id}><td>{time(a.at)}</td><td><MemberIdentity userId={a.actorId} name={a.actorName}/></td><td>{t(actions[a.action]||a.action)}</td><td>{a.projectId?workspace.projects.find(p=>p.id===a.projectId)?.name:t('Workspace')}<small>{a.environment?envLabel(a.environment):''}</small></td></tr>)}</tbody></table></div>;}
 useEffect(()=>{
  const navigate=(event:Event)=>{
    const target=(event as CustomEvent).detail;
    if(!target||!navigation.some(([id])=>id===target.page)||typeof target.workspaceId!=='string')return;
    if(target.taskId)setSelectedTask(target.taskId);notificationTarget.current=target;workspaceIdRef.current=target.workspaceId;setMode('teams');go(target.page);
    if(mode==='teams')void refresh(target.workspaceId);
  };
  document.addEventListener('snapkit:notification-open',navigate);return()=>document.removeEventListener('snapkit:notification-open',navigate);
 },[refresh,mode]);
 const selectedTitle=navigation.find(([id])=>id===page)?.[2]||'Overview';
 return <MemberProvider members={workspace?.members||[]}>
  {createPortal(productSwitch(),personalHost)}
  {mode==='teams'&&<div className="teams-application">
   <aside className="teams-sidebar"><a className="teams-brand" aria-label="Snapkit Teams" href="#" onClick={e=>{e.preventDefault();go('home');}}><span><Icon name="scan-line"/></span>Snapkit <small>TEAMS</small></a>{productSwitch(true)}
    <label className="teams-workspace-label"><span>{t('Team workspace')}</span><Select aria-label={t('Team workspace')} value={workspaceId} disabled={busy||loading||!listing.workspaces.length} onChange={e=>void selectWorkspace(e.target.value)}>{!listing.workspaces.length&&<option value="">{t('Choose a workspace')}</option>}{listing.workspaces.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</Select></label>
    {!isPreview&&<button className="teams-create-workspace" disabled={busy} onClick={()=>open('workspace')} aria-label={t('Create team workspace')}><Icon name="plus"/><span>{t('Create workspace')}</span></button>}
    <nav aria-label={t('Teams navigation')}>{navigation.map(([id,icon,label])=><button key={id} aria-label={t(label)} title={t(label)} aria-current={!sharedPage&&page===id?'page':undefined} onClick={()=>go(id)}><Icon name={icon}/><span>{t(label)}</span></button>)}<button aria-current={sharedPage==='profile'?'page':undefined} aria-label={t('My profile')} title={t('My profile')} onClick={()=>document.dispatchEvent(new Event('snapkit:open-profile'))}><Icon name="user-round"/><span>{t('My profile')}</span></button></nav><button className="teams-updates" aria-label={t('Updates')} title={t('Updates')} aria-current={sharedPage==='updates'?'page':undefined} onClick={()=>showProductPage('updates')}><Icon name="refresh-cw"/><span>{t('Updates')}</span>{updateAvailable&&<span className="teams-update-indicator">{t('New')}</span>}</button><div className="teams-sidebar-foot"><Icon name="shield-check"/><span>{t('Team data is isolated from Personal.')}</span></div>
   </aside>
   <div className="teams-shell"><header className="teams-topbar"><span>Teams <span aria-hidden="true">/</span> <strong>{workspace?.name||t('Your team')}</strong></span><label className="teams-mobile-workspace"><span>{t('Team workspace')}</span><Select aria-label={t('Switch team workspace')} value={workspaceId} disabled={busy||loading||!listing.workspaces.length} onChange={e=>void selectWorkspace(e.target.value)}>{!listing.workspaces.length&&<option value="">{t('Choose a workspace')}</option>}{listing.workspaces.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</Select></label><div><span id="teams-notifications-slot"/><Select aria-label={t('Language')} value={window.SnapkitI18n.language} onChange={e=>window.SnapkitI18n.setLanguage(e.target.value)}><option value="en">EN</option><option value="vi">VI</option></Select><button className="icon-button" aria-label={t('Appearance')} onClick={()=>applyAppearance(getAppearance()==='light'?'dark':'light')}><Icon name="sun"/></button><button className="button" onClick={()=>changeMode('personal')}>{t('Personal account')}</button></div></header>
    <main className="teams-main" aria-busy={loading&&!workspace}>
     <div ref={sharedHost} hidden={!sharedPage}/><div hidden={!!sharedPage}>
     {isPreview&&<p className="teams-info teams-sample-banner" role="status"><Icon name="flask-conical"/>{t('Flutter sample · 11 fictional teammates · Read only')}</p>}
     <div className="teams-context"><div>{workspace&&!isPreview&&<><span className="teams-badge purple">{roleLabel(workspace.membership.role)}</span></>}</div><div>{workspace&&<><label>{t('Project')}<Select aria-label={t('Team project')} value={project?.id||''} disabled={!workspace.projects.length} onChange={e=>setProjectId(e.target.value)}>{!workspace.projects.length&&<option value="">{t('No projects')}</option>}{workspace.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</Select></label><label>{t('Environment')}<Select aria-label={t('Team environment')} value={environment} onChange={e=>setEnvironment(e.target.value as Environment)}>{workspace.membership.environments.map(env=><option key={env} value={env}>{envLabel(env)}</option>)}</Select></label></>}<button type="button" className="button teams-refresh" aria-label={t('Refresh')} disabled={busy||loading} onClick={()=>void refresh()}><Icon name="refresh-cw"/><span>{t('Refresh')}</span></button></div></div>
     <div className="teams-page-heading"><div><h1 ref={heading} tabIndex={-1}>{t(selectedTitle)}</h1></div></div>
     {!isPreview&&page==='home'&&<a className="teams-sample-link" href="https://snapkit.vn/demo/?product=teams&lang=vi" target="_blank" rel="noopener noreferrer"><Icon name="flask-conical"/>{t('Explore the Flutter team sample')}<Icon name="arrow-up-right"/></a>}{error&&<div className={"teams-error"+(workspace?" teams-save-status":"")} role="alert">{t(error)}</div>}
     {!!listing.invitations.length&&<section className="teams-section"><h2>{t('Your team invitations')}</h2><div className="teams-events">{listing.invitations.map(i=><div key={i.id}><span><strong>{i.workspaceName}</strong> · {roleLabel(i.role)}</span>{callButton('Accept invitation',()=>{if(busy)return;setBusy(true);void api('/api/teams/invitations/'+i.id+'/accept',{}).then((w:TeamWorkspace)=>refresh(w.id)).catch((e:Error)=>setError(e.message)).finally(()=>setBusy(false));},true)}</div>)}</div></section>}
     {workspace?({home:overview,projects,devices,handoffs,members,audit,tasks:()=> <TaskBoard workspace={workspace} project={project} environment={environment} busy={busy&&(!pendingTaskId||pendingTaskId==='new'||pendingTaskId===selectedTask)} preview={isPreview} selectedId={selectedTask} select={setSelectedTask} save={saveTask} debug={task=>{setDebugTask(task);go('sessions');}} handoff={task=>open('handoff',{task})}/>,sessions:()=> <TeamDebug workspace={workspace} project={project} environment={environment} preview={isPreview} bindingRevision={localSession?.preparedAt} task={workspace.tasks?.find(x=>x.id===debugTask?.id&&x.projectId===project?.id&&x.environment===environment&&x.assigneeId===workspace.membership.userId&&x.status==='in-progress')||null} connect={()=>open('local')} refresh={()=>void refresh(undefined,true)}/>})[page]():!loading&&!error?empty('Set up your team workspace','Create your workspace, then follow the 4 setup steps.',callButton('Create team workspace',()=>open('workspace'),true)):loading?<p className="teams-help" role="status">{t('Loading team workspace…')}</p>:null}
    </div></main>
   </div>
  </div>}
  {form&&<TeamForm key={form.kind+(form.member?.userId||'')} form={form} emailConfigured={listing.emailDeliveryConfigured} workspace={workspace} project={project} busy={busy} error={formError} close={()=>{if(!busy)setForm(null);}} submit={submit}/>}
 </MemberProvider>;
}
export function mountTeams(){
 const host=document.createElement('div');host.id='teams-root';document.body.append(host);
 const personalHost=document.createElement('div');personalHost.className='personal-product-switch';document.querySelector('.sidebar .brand')!.after(personalHost);
 const root=createRoot(host);flushSync(()=>root.render(<Teams personalHost={personalHost}/>));
 return()=>{root.unmount();host.remove();personalHost.remove();delete document.body.dataset.productMode;};
}
