import {teamCan,teamProjectVisible} from './team-access.js';
// Derive notifications from live authorized records; revoked access removes them immediately.
export function teamNotifications(db,user,now=Date.now()) {
 const items=[];
 for(const workspace of db.workspaces){
  const member=workspace.members.find(m=>m.userId===user.id);
  const add=(id,type,title,at,page,extra={})=>items.push({id,type,title,at,workspaceId:workspace.id,workspaceName:workspace.name,page,...extra});
  if(!member){for(const invitation of workspace.invitations){if(invitation.email===user.email.toLowerCase()&&invitation.expiresAt>now)add('invite:'+invitation.id,'invitation','You have a team invitation',new Date(invitation.expiresAt-7*86400000).toISOString(),'home');}continue;}
  const visible=(projectId,environment)=>(!projectId||teamProjectVisible(member,projectId))&&(!environment||member.environments.includes(environment));
  for(const handoff of workspace.handoffs){
   if(!visible(handoff.projectId,handoff.environment)||handoff.createdBy===user.id)continue;
   const qa=handoff.status==='pending'&&teamCan(member,'qa.confirm',handoff.projectId,handoff.environment);
   const approve=handoff.status==='qa-approved'&&handoff.qa?.userId!==user.id&&teamCan(member,'release.approve',handoff.projectId,handoff.environment);
   if(qa||approve)add('handoff:'+handoff.id+':'+handoff.status,'handoff',qa?'QA review needed':'Release approval needed',handoff.qa?.at||handoff.createdAt,'handoffs',{projectId:handoff.projectId,environment:handoff.environment,detail:handoff.title});
  }
  if(teamCan(member,'members.manage'))for(const invitation of workspace.invitations){if(invitation.expiresAt>now&&['failed','not_configured'].includes(invitation.delivery?.status))add('mail:'+invitation.id+':'+(invitation.delivery.attemptedAt||0),'warning','Invitation email needs attention',new Date(invitation.delivery.attemptedAt||invitation.expiresAt-7*86400000).toISOString(),'members');}
  const titles={'invitation.accepted':'A teammate joined','project.updated':'Project updated','blueprint.updated':'Project configuration updated','handoff.approved':'Release approved','handoff.changes-requested':'Changes requested'};
  for(const event of workspace.audit){if(!titles[event.action]||event.actorId===user.id||event.at<member.joinedAt||!visible(event.projectId,event.environment))continue;
   add('event:'+event.id,event.action.startsWith('handoff.')?'handoff':'activity',titles[event.action],event.at,event.action==='invitation.accepted'?'members':['blueprint.updated','project.updated'].includes(event.action)?'projects':'handoffs',{projectId:event.projectId,environment:event.environment});
  }
 }
 const read=new Set(db.notificationReads?.[user.id]||[]);
 return items.sort((a,b)=>b.at.localeCompare(a.at)||a.id.localeCompare(b.id)).slice(0,100).map(item=>({...item,read:read.has(item.id)}));
}
