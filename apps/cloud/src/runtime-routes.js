import {randomUUID} from 'node:crypto';
import {teamCan} from './domain/team-access.js';
import {taskVisible} from './domain/team-tasks.js';
export function installTeamRuntimeRoutes({mutate,fail,text,audit,projectOf,now}){
 mutate('/devices/:deviceId/host',null,(w,m,u,input,p)=>{
  const d=w.devices.find(d=>d.id===p.deviceId);if(!d)fail(404,'Team device not found.');projectOf(w,d.projectId,m);if(!teamCan(m,'devices.manage',d.projectId,'development'))fail(403,'Device management access is required.');if(input.platform!==d.platform||typeof input.online!=='boolean'||!/^[a-f0-9]{64}$/.test(input.targetHash||''))fail(400,'Choose a matching local device.');const clientId=text(input.clientId,80);if(d.hostPresence&&d.hostPresence.clientId!==clientId&&Date.now()-d.hostPresence.seenAt<45000)fail(409,'This device is connected to another active host.');d.hostPresence={userId:u.id,clientId,targetHash:input.targetHash,online:input.online,seenAt:Date.now()};
 });
 mutate('/debug-sessions',null,(w,m,u,input)=>{
  const project=projectOf(w,input.projectId,m);if(!['development','staging'].includes(input.environment)||!teamCan(m,'sessions.prepare',project.id,input.environment))fail(403,'Debugging requires project and environment access.');
  if(!project.blueprint.services.some(s=>s.kind==='mobile'))fail(400,'Debug Sync requires a mobile project component.');
  const task=(w.tasks||[]).find(t=>t.id===input.taskId&&taskVisible(m,t));if(!task||task.assigneeId!==u.id||task.status!=='in-progress'||task.blocked||task.projectId!==project.id||task.environment!==input.environment)fail(409,'Start your assigned mobile task before debugging.');
  if(task.layer!=='mobile')fail(400,'Debug Sync is available for mobile tasks.');
  w.debugSessions||=[];const existing=w.debugSessions.find(s=>s.userId===u.id&&s.clientId===input.clientId&&s.status!=='ended');
  if(existing?.status==='running'&&Date.now()-existing.seenAt<45000)fail(409,'End the current debug session before preparing another one.');
  const devices=Array.isArray(input.devices)?input.devices:[];if(!devices.length||devices.length>8||devices.some(d=>!['android','ios'].includes(d.platform)))fail(400,'Choose up to eight Android or iOS targets.');
  const teamDeviceIds=input.teamDeviceIds||[];if(!Array.isArray(teamDeviceIds)||teamDeviceIds.length>8)fail(400,'Choose valid team devices.');for(const id of teamDeviceIds){const d=w.devices.find(d=>d.id===id&&d.projectId===project.id);if(!d||d.reservation?.userId!==u.id||d.reservation.expiresAt<=Date.now())fail(409,'Book this shared device before debugging.');if(!d.hostPresence?.online||d.hostPresence.userId!==u.id||Date.now()-d.hostPresence.seenAt>45000)fail(409,'The shared device host is offline or belongs to another member.');if(w.debugSessions.some(s=>s.id!==existing?.id&&s.status!=='ended'&&Date.now()-s.seenAt<45000&&s.teamDeviceIds?.includes(id)))fail(409,'This shared device already has an active debug session.');}
  const session={teamDeviceIds,id:existing?.id||randomUUID(),projectId:project.id,taskId:task.id,userId:u.id,clientId:text(input.clientId,80),environment:input.environment,devices:devices.map(d=>({id:text(d.id,100),name:text(d.name,80),platform:d.platform})),status:'preparing',startedAt:now(),seenAt:Date.now(),endedAt:null,stopRequestedAt:null};
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
