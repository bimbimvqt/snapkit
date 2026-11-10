import {teamCan,teamProjectVisible} from './team-access.js';
export const taskStates=['draft','todo','in-progress','review','testing','approval','done','cancelled'];
export const taskVisible=(member,task)=>teamProjectVisible(member,task.projectId)&&member.environments.includes(task.environment)&&(member.serviceLayers===undefined||member.serviceLayers.includes(task.layer));
export const taskManager=member=>['owner','lead','pm'].includes(member.role);
export function canTaskTransition(member,task,to){
 const self=member.userId===task.assigneeId,manager=taskManager(member);
 if(['viewer','designer'].includes(member.role)||!taskVisible(member,task))return false;
 if(to==='cancelled')return manager&&task.status!=='done';
 if(to==='todo')return manager&&['draft','cancelled','done'].includes(task.status);
 if(to==='in-progress')return (self&&task.status==='todo')||(['review','testing','approval'].includes(task.status)&&(manager||member.userId===task.reviewerId||member.userId===task.testerId));
 if(to==='review')return self&&task.status==='in-progress';
 if(to==='testing')return task.status==='review'&&!self&&(member.userId===task.reviewerId||teamCan(member,'release.approve',task.projectId,task.environment));
 if(to==='approval')return task.status==='testing'&&!self&&(member.userId===task.testerId||(!task.testerId&&teamCan(member,'qa.confirm',task.projectId,task.environment)));
 if(to==='done')return task.status==='approval'&&!self&&task.testedBy!==member.userId&&(!task.approverId||task.approverId===member.userId)&&teamCan(member,'release.approve',task.projectId,task.environment);
 return false;
}
