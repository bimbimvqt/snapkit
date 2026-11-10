import {Icon} from '../../shared/ui/icons';
import {t} from '../../shared/ui/use-language';
import type {TeamWorkspace,Project,LocalSession} from './types';
type Action='project'|'service'|'invite'|'local'|'device'|'members';
export function SetupJourney({workspace,project,localSession,preview,can,onAction}:{workspace:TeamWorkspace;project:Project|undefined;localSession:LocalSession|null;preview:boolean;can:(permission:string,env?:'development')=>boolean;onAction:(action:Action)=>void}){
 const relevant=(scope:string[]|null)=>scope===null||!!project&&scope.includes(project.id);
 const teammates=workspace.members.filter(m=>m.userId!==workspace.membership.userId&&relevant(m.projectIds));
 const pending=workspace.invitations.filter(i=>i.expiresAt>Date.now()&&relevant(i.projectIds)).length;
 const configured=project?.blueprint.hasServices??!!project?.blueprint.services.length;
 const scopedOut=workspace.membership.serviceLayers?.length===0||(configured&&!project?.blueprint.services.length);
 const steps=[
  {title:'Team workspace',done:true,detail:workspace.name,action:null,permission:true},
  {title:'Project',done:!!project,detail:project?.name||t('Add the project your team will work on.'),action:'project' as Action,permission:can('projects.create')&&(workspace.membership.role==='owner'||workspace.membership.projectIds===null)},
  {title:'Services',done:configured,detail:scopedOut?t('Outside your access scope.'):project?.blueprint.services.length?t('Project layers are configured.'):t('Add a mobile app, website or backend service.'),action:'service' as Action,permission:!!project&&can('blueprint.write','development')},
  {title:'Teammates',done:teammates.length>0,detail:teammates.length?t('A teammate has joined this project.'):pending?t('Invitation sent. Waiting for your teammate to accept.'):t('Invite a teammate and ask them to accept in Teams.'),action:'invite' as Action,permission:can('members.manage')}
 ];
 const completed=steps.filter(s=>s.done).length,current=steps.findIndex(s=>!s.done),next=steps[current];
 const labels:Record<Action,string>={project:'Create team project',service:'Add service',invite:'Invite team member',local:'Prepare local session',device:'Register team device',members:'View invitations'};
 return <section className="teams-setup" aria-labelledby="teams-setup-title">
  <header><div><h2 id="teams-setup-title">{t(current<0?'Workspace ready':'Set up your team workspace')}</h2><p>{t('Completed {0} of {1} steps',[completed,steps.length])}{project?' · '+project.name:''}</p></div><span className="teams-badge">{completed}/{steps.length}</span></header>
  <progress max={steps.length} value={completed} aria-label={t('Workspace setup progress')}/>
  <ol>{steps.map((step,index)=><li key={step.title} data-status={step.done?'done':index===current?'current':'upcoming'} aria-current={index===current?'step':undefined}><span className="teams-step-number">{step.done?<Icon name="check"/>:index+1}</span><div><strong>{t(step.title)}</strong><small>{step.detail}</small></div><span className="teams-step-status">{t(step.done?'Complete':index===current?'Current step':'Next')}</span></li>)}</ol>
  {next&&<div className="teams-next-step"><div><strong>{t('Next: {0}',[t(next.title)])}</strong>{!next.permission&&<p>{t('Ask your workspace Owner to complete this step.')}</p>}</div>{next.permission&&!preview&&<button type="button" className="button primary" onClick={()=>onAction(current===3&&pending?'members':next.action!)}>{t(labels[current===3&&pending?'members':next.action!])}</button>}</div>}
  {current<0&&!preview&&(can('sessions.prepare','development')||can('devices.manage','development'))&&<div className="teams-setup-options"><p>{t('Optional · Add what your project needs')}</p><div>{can('sessions.prepare','development')&&!preview&&<button type="button" className="button" onClick={()=>onAction('local')}><Icon name={localSession?'check':'folder-code'}/>{t(localSession?'Local folder connected':'Prepare local session')}</button>}{can('devices.manage','development')&&!preview&&<button type="button" className="button" onClick={()=>onAction('device')}><Icon name="smartphone"/>{t('Register team device')}</button>}</div></div>}
 </section>;
}
