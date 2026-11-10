import {randomUUID} from 'node:crypto';
import {taskStates,taskVisible,taskManager,canTaskTransition} from './domain/team-tasks.js';
import {teamCan,teamProjectVisible,teamLayers} from './domain/team-access.js';
export function installTaskRoutes({mutate,fail,text,note,audit,projectOf,now}){
 const events=(workspace,task,user,type,extra={})=>{
  const recipients=[task.assigneeId,task.reviewerId,task.testerId,task.approverId,...workspace.members.filter(m=>['lead','pm'].includes(m.role)).map(m=>m.userId),...(extra.mentionIds||[])].filter(id=>id&&id!==user.id);
  task.history.push({id:randomUUID(),at:now(),type,actorId:user.id,recipients:[...new Set(recipients)],...extra});task.history=task.history.slice(-100);task.version++;task.updatedAt=now();audit(workspace,user,'task.'+type,task.projectId,task.environment);
 };
 const find=(workspace,member,id)=>{const task=workspace.tasks?.find(t=>t.id===id&&taskVisible(member,t));if(!task)fail(404,'Task not found.');return task;};
 const version=(task,input)=>{if(input.version!==task.version)fail(409,'This task changed. Refresh before saving.');};
 const participant=(workspace,task,id,kind)=>{
  if(!id)return '';
  const m=workspace.members.find(m=>m.userId===id);
  if(!m||!taskVisible(m,task)||['viewer','designer'].includes(m.role))fail(400,'Choose a member with access to this task.');
  if(kind==='assignee'&&!(m.serviceLayers??teamLayers).includes(task.layer))fail(400,'The assignee needs access to this project layer.');
  if(kind==='approver'&&!teamCan(m,'release.approve',task.projectId,task.environment))fail(400,'Choose a Lead or DevOps approver.');
  if(['reviewer','tester','approver'].includes(kind)&&id===task.assigneeId)fail(400,'Choose an independent reviewer.');
  return id;
 };
 const payload=(workspace,member,user,input,current)=>{
  const project=projectOf(workspace,input.projectId,member);if(current&&(current.projectId!==input.projectId||current.environment!==input.environment))fail(400,'Task project and environment cannot change.');
  if(!['development','staging'].includes(input.environment)||!member.environments.includes(input.environment))fail(400,'Choose a development or staging environment.');
  if(!(member.serviceLayers??teamLayers).includes(input.layer))fail(400,'Choose a project layer.');
  const task={...current,projectId:project.id,environment:input.environment,layer:input.layer,title:text(input.title,160),description:note(input.description,4000),priority:input.priority||'normal',dueAt:input.dueAt||'',blocked:note(input.blocked,500),serviceName:text(input.serviceName,80,true)};
  if(!['low','normal','high','urgent'].includes(task.priority))fail(400,'Choose a valid priority.');
  if(task.dueAt&&(typeof task.dueAt!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(task.dueAt)||!Number.isFinite(Date.parse(task.dueAt))||new Date(task.dueAt).toISOString().slice(0,10)!==task.dueAt))fail(400,'Choose a valid due date.');
  if(!Array.isArray(input.criteria)||input.criteria.length>30)fail(400,'Add up to 30 acceptance criteria.');
  task.criteria=input.criteria.map((c,i)=>({id:current?.criteria?.[i]?.id||randomUUID(),text:text(typeof c==='string'?c:c.text,300),done:current?.criteria?.[i]?.text===(typeof c==='string'?c:c.text)&&!!current.criteria[i].done}));
  task.assigneeId=participant(workspace,task,input.assigneeId,'assignee');task.reviewerId=participant(workspace,task,input.reviewerId,'reviewer');task.testerId=participant(workspace,task,input.testerId,'tester');task.approverId=participant(workspace,task,input.approverId,'approver');
  if(!Array.isArray(input.dependencies)||input.dependencies.length>30)fail(400,'Choose valid dependencies.');
  task.dependencies=[...new Set(input.dependencies)];
  for(const id of task.dependencies){const dep=find(workspace,member,id);if(id===current?.id||dep.projectId!==task.projectId||dep.environment!==task.environment)fail(400,'Dependencies must belong to the same project and environment.');
   const visited=new Set();const cycle=t=>{if(t.id===current?.id)return true;if(visited.has(t.id))return false;visited.add(t.id);return t.dependencies.some(d=>{const found=workspace.tasks.find(t=>t.id===d);return found&&cycle(found);});};if(cycle(dep))fail(400,'Task dependencies cannot form a cycle.');
  }
  task.parentId=input.parentId||'';if(task.parentId&&current?.id&&workspace.tasks.some(t=>t.parentId===current.id))fail(400,'A task with children must remain a top-level task.');if(task.parentId){const p=find(workspace,member,task.parentId);if(p.id===current?.id||p.projectId!==task.projectId||p.environment!==task.environment||p.parentId)fail(400,'Choose a top-level parent task in this project.');}
  return task;
 };
 mutate('/tasks',null,(w,m,u,input)=>{
  if(!taskManager(m))fail(403,'Only the Lead, PM or Owner can assign work.');w.tasks||=[];if(w.tasks.length>=500)fail(409,'Workspace task limit reached.');
  const task=payload(w,m,u,{dependencies:[],criteria:[],...input});task.id=randomUUID();task.number=(w.taskSequence||0)+1;w.taskSequence=task.number;
  task.status=input.draft?'draft':'todo';task.version=0;task.createdBy=u.id;task.createdAt=now();task.comments=[];task.history=[];task.acceptedAt=null;task.handoffId='';task.testedBy='';task.approvedBy='';
  w.tasks.push(task);events(w,task,u,'assigned');
 });
 mutate('/tasks/:taskId/update',null,(w,m,u,input,p)=>{
  const task=find(w,m,p.taskId);version(task,input);if(!taskManager(m))fail(403,'Only the Lead, PM or Owner can edit assignments.');if(['done','cancelled'].includes(task.status))fail(409,'Reopen this task before editing it.');
  const old=task.assigneeId,updated=payload(w,m,u,input,task);Object.assign(task,updated);task.criteria.forEach(c=>c.done=false);task.status=task.status==='draft'?'draft':'todo';task.acceptedAt=null;task.reviewedBy='';task.testedBy='';task.approvedBy='';task.handoffId='';events(w,task,u,'updated',{mentionIds:old?[old]:[]});
 });
 mutate('/tasks/:taskId/accept',null,(w,m,u,input,p)=>{const task=find(w,m,p.taskId);version(task,input);if(['viewer','designer'].includes(m.role)||task.assigneeId!==u.id||task.status!=='todo')fail(403,'Only the assigned member can accept this task.');task.acceptedAt=now();events(w,task,u,'accepted');});
 mutate('/tasks/:taskId/checklist',null,(w,m,u,input,p)=>{
  const task=find(w,m,p.taskId);version(task,input);if(['viewer','designer'].includes(m.role)||task.assigneeId!==u.id||!['todo','in-progress'].includes(task.status))fail(403,'Only the assignee can complete this checklist.');
  if(!Array.isArray(input.completed)||input.completed.some(id=>!task.criteria.some(c=>c.id===id)))fail(400,'Choose valid checklist items.');task.criteria.forEach(c=>c.done=input.completed.includes(c.id));events(w,task,u,'checklist');
 });
 mutate('/tasks/:taskId/blocked',null,(w,m,u,input,p)=>{const task=find(w,m,p.taskId);version(task,input);if(!taskManager(m)&&task.assigneeId!==u.id)fail(403,'You cannot change this task.');if(['done','cancelled'].includes(task.status))fail(409,'Reopen this task first.');task.blocked=note(input.reason,500);events(w,task,u,'blocked');});
 mutate('/tasks/:taskId/transition',null,(w,m,u,input,p)=>{
  const task=find(w,m,p.taskId);version(task,input);if(!taskStates.includes(input.status)||!canTaskTransition(m,task,input.status))fail(403,'This task transition is not allowed for your role.');
  const eligible=id=>{const member=w.members.find(m=>m.userId===id);return member&&taskVisible(member,task)&&!['viewer','designer'].includes(member.role);};
  if(!['cancelled','todo'].includes(input.status)){
   if(!eligible(task.assigneeId))fail(409,'Assign an active member before continuing.');
   if(task.blocked||task.dependencies.some(id=>w.tasks.find(t=>t.id===id)?.status!=='done'))fail(409,'Resolve blockers and dependencies first.');
  }
  if(input.status==='in-progress'&&task.status==='todo'&&(!task.acceptedAt||!task.criteria.length))fail(409,'Accept the task and add acceptance criteria before starting.');
  if(input.status==='review'&&(!task.criteria.length||task.criteria.some(c=>!c.done)))fail(409,'Complete the acceptance checklist before review.');
  if(input.status==='review'&&(!eligible(task.reviewerId)||task.reviewerId===task.assigneeId))fail(409,'Assign an independent reviewer before review.');
  if(input.status==='testing'&&(!eligible(task.testerId)||task.testerId===task.assigneeId))fail(409,'Assign an independent tester before testing.');
  if(input.status==='approval'&&(!eligible(task.approverId)||task.approverId===u.id))fail(409,'Assign a different Lead or DevOps approver.');
  if(input.status==='done'&&(!eligible(task.testedBy)||!eligible(task.reviewedBy)))fail(409,'The reviewer or tester no longer has access. Return the task for review.');
  if(input.status==='done'&&!task.testedBy)fail(409,'A tester must confirm this task first.');
  if(input.status==='done'&&task.handoffId&&w.handoffs.find(h=>h.id===task.handoffId)?.status!=='approved')fail(409,'Approve the linked build before completing this task.');
  if(input.status==='testing')task.reviewedBy=u.id;
  if(input.status==='approval')task.testedBy=u.id;
  if(input.status==='done')task.approvedBy=u.id;
  if(input.status==='in-progress'&&task.status!=='todo'&&task.handoffId){const build=w.handoffs.find(h=>h.id===task.handoffId);if(build){build.status='changes-requested';build.qa=null;build.approval=null;}}
  if(['in-progress','todo'].includes(input.status)){task.reviewedBy='';task.testedBy='';task.approvedBy='';}
  if(input.status==='todo'){task.criteria.forEach(c=>c.done=false);task.acceptedAt=null;task.handoffId='';}
  task.status=input.status;events(w,task,u,'status',{status:input.status});
  if(task.status==='done')for(const dependent of w.tasks.filter(t=>t.dependencies.includes(task.id)&&t.status==='todo'))events(w,dependent,u,'unblocked');
 });
 mutate('/tasks/:taskId/comments',null,(w,m,u,input,p)=>{
  const task=find(w,m,p.taskId);if(['viewer','designer'].includes(m.role))fail(403,'Your role cannot comment on work.');if(task.comments.length>=300)fail(409,'Comment limit reached.');
  const mentionIds=Array.isArray(input.mentionIds)?[...new Set(input.mentionIds)]:[];if(mentionIds.length>10||mentionIds.some(id=>!w.members.some(m=>m.userId===id&&taskVisible(m,task))))fail(400,'Mention members with access to this task.');
  task.comments.push({id:randomUUID(),at:now(),userId:u.id,text:note(input.text,2000)});if(!task.comments.at(-1).text)fail(400,'Enter a comment.');events(w,task,u,'comment',{mentionIds});
 });
}
