import {MemberIdentity} from '../account/MemberIdentity';
import {Icon} from '../../shared/ui/icons';
import {t} from '../../shared/ui/use-language';
import {ProjectIcon} from './ProjectIcon';
import type {TeamWorkspace,Project,Page} from './types';
export function WorkspaceOverview({workspace,project,go,onInvite,canInvite,preview}:{workspace:TeamWorkspace;project:Project|undefined;go:(page:Page)=>void;onInvite:()=>void;canInvite:boolean;preview:boolean}){
 const scoped=(ids:string[]|null)=>ids===null||!!project&&ids.includes(project.id);
 const members=workspace.members.filter(m=>scoped(m.projectIds));
 const mobile=members.filter(m=>m.role==='developer'&&m.serviceLayers?.includes('mobile')&&!m.serviceLayers?.includes('backend')),backend=members.filter(m=>m.role==='developer'&&m.serviceLayers?.includes('backend'));
 const coordination=members.filter(m=>['owner','lead','pm'].includes(m.role)),other=members.filter(m=>![...mobile,...backend,...coordination].includes(m));
 const groups:[string,string,typeof members][]=[['smartphone','Mobile developers',mobile],['code-xml','Backend developers',backend],['group','Coordination',coordination],['flask-conical','QA & specialists',other]];
 const handoffs=workspace.handoffs.filter(h=>h.projectId===project?.id),qa=handoffs.filter(h=>h.status==='pending').length,lead=handoffs.filter(h=>h.status==='qa-approved').length;
 const services=project?.blueprint.services||[];
 const modules:[Page,string,string,number,string][]=[['tasks','list','Tasks',(workspace.tasks||[]).filter(x=>x.projectId===project?.id&&!['done','cancelled'].includes(x.status)).length,'active'],['sessions','radio','Team Debug Sync',(workspace.debugSessions||[]).filter(x=>x.projectId===project?.id&&x.status==='running').length,'running'],['projects','layers','Projects & services',services.length,'services'],['handoffs','package','Handoffs & approvals',qa+lead,'waiting'],['members','group','Members & access',members.length,'teammates']];
 return <>
  <section className="teams-workspace-summary"><ProjectIcon value={project?.icon}/><div><h2>{project?.name||workspace.name}</h2><p>{project?.description||t('Your shared workspace')}</p></div><span className="teams-badge ready"><Icon name="check"/>{t('Workspace ready')}</span></section>
  <div className="teams-card-grid teams-overview-modules">{modules.map(([page,icon,label,count,unit])=><button type="button" className="teams-module" key={page} onClick={()=>go(page)}><Icon name={icon}/><h3>{t(label)}</h3><strong>{count}<small>{t(unit)}</small></strong><span>{t('Open')}<Icon name="arrow-right"/></span></button>)}</div>
  <section className="teams-workflow"><div className="teams-sectionbar"><h2>{t('Build → Review → Approve')}</h2><button type="button" className="button" onClick={()=>go('handoffs')}>{t('View handoffs')}<Icon name="arrow-right"/></button></div><ol>{[['code-xml','Submitted builds',handoffs.length],['flask-conical','Waiting for QA',qa],['shield-check','Release approval',lead]].map(([icon,label,count])=><li key={label}><Icon name={String(icon)}/><div><strong>{t(String(label))}</strong><small>{count} {t('builds')}</small></div></li>)}</ol>{qa>0&&!members.some(m=>m.role==='qa')&&!handoffs.filter(h=>h.status==='pending').every(h=>workspace.tasks?.some(x=>x.handoffId===h.id&&x.testerId))&&<div className="teams-next-action"><Icon name="circle-alert"/><div><strong>{t('Add a QA reviewer')}</strong><p>{t('Pending builds need an independent QA reviewer before Lead approval.')}</p></div>{canInvite&&!preview&&<button type="button" className="button primary" onClick={onInvite}>{t('Invite QA')}</button>}</div>}</section>
  <section className="teams-section"><div className="teams-sectionbar"><h2>{t('Your team')}</h2><button type="button" className="button" onClick={()=>go('members')}>{t('View team')}<Icon name="arrow-right"/></button></div><div className="teams-team-groups">{groups.filter(([, ,group])=>group.length>0).map(([icon,label,group])=><div key={label}><Icon name={icon}/><strong>{t(label)}</strong><span>{group.length}</span><small>{group.map(m=><MemberIdentity key={m.userId} userId={m.userId}/>)}</small></div>)}</div></section>
 </>;
}
