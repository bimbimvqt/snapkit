import {randomUUID} from 'node:crypto';
import {teamCan} from './domain/team-access.js';
import {taskVisible} from './domain/team-tasks.js';
export function installTeamRuntimeRoutes({mutate,fail,text,audit,projectOf,now}){
 mutate('/debug-sessions',null,(w,m,u,input)=>{
  const project=projectOf(w,input.projectId,m);if(!['development','staging'].includes(input.environment)||!teamCan(m,'sessions.prepare',project.id,input.environment))fail(403,'Debugging requires project and environment access.');
  if(!project.blueprint.services.some(s=>s.kind==='mobile'))fail(400,'Debug Sync requires a mobile project component.');
  const task=(w.tasks||[]).find(t=>t.id===input.taskId&&taskVisible(m,t));if(!task||task.assigneeId!==u.id||task.status!=='in-progress'||task.blocked||task.projectId!==project.id||task.environment!==input.environment)fail(409,'Start your assigned mobile task before debugging.');
  if(task.layer!=='mobile')fail(400,'Debug Sync is available for mobile tasks.');
  w.debugSessions||=[];const existing=w.debugSessions.find(s=>s.userId===u.id&&s.clientId===input.clientId&&s.status!=='ended');
  if(existing?.status==='running'&&Date.now()-existing.seenAt<45000)fail(409,'End the current debug session before preparing another one.');
  const devices=Array.isArray(input.devices)?input.devices:[];if(!devices.length||devices.length>8||devices.some(d=>!['android','ios'].includes(d.platform)))fail(400,'Choose up to eight Android or iOS targets.');
  const session={id:existing?.id||randomUUID(),projectId:project.id,taskId:task.id,userId:u.id,clientId:text(input.clientId,80),environment:input.environment,devices:devices.map(d=>({id:text(d.id,100),name:text(d.name,80),platform:d.platform})),status:'preparing',startedAt:now(),seenAt:Date.now(),endedAt:null,stopRequestedAt:null};
  if(existing)Object.assign(existing,session);else{w.debugSessions=w.debugSessions.filter(s=>s.status!=='ended'||Date.now()-s.seenAt<7*86400000).slice(-199);w.debugSessions.push(session);}audit(w,u,'debug.prepared',project.id,input.environment);
 });
 mutate('/debug-sessions/:sessionId/heartbeat',null,(w,m,u,input,p)=>{
  const s=(w.debugSessions||[]).find(s=>s.id===p.sessionId&&s.userId===u.id);if(!s)fail(404,'Debug session not found.');projectOf(w,s.projectId,m);
  if(!teamCan(m,'sessions.prepare',s.projectId,s.environment))fail(403,'Debug access was revoked.');
  const task=(w.tasks||[]).find(t=>t.id===s.taskId);if(input.status!=='ended'&&(!task||!taskVisible(m,task)||task.assigneeId!==u.id||task.status!=='in-progress'||task.blocked))fail(409,'Task access changed. End this debug session.');
  if(!['preparing','running','ended'].includes(input.status))fail(400,'Invalid debug session status.');if(s.status==='ended'&&input.status!=='ended')fail(409,'Start a new debug session.');
  s.status=input.status;s.seenAt=Date.now();if(s.status==='ended')s.endedAt=now();
 });
 mutate('/debug-sessions/:sessionId/request-stop',null,(w,m,u,_input,p)=>{
  const s=(w.debugSessions||[]).find(s=>s.id===p.sessionId);if(!s)fail(404,'Debug session not found.');projectOf(w,s.projectId,m);if(!['owner','lead','pm'].includes(m.role)&&s.userId!==u.id)fail(403,'Only the session owner or team coordinator can request a stop.');if(!m.environments.includes(s.environment))fail(403,'Environment access is required.');if(s.status==='ended')fail(409,'This debug session has ended.');s.stopRequestedAt=now();audit(w,u,'debug.stop-requested',s.projectId,s.environment);
 });
}
