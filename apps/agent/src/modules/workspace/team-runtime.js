import {randomUUID,createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {launchPlan,validateBuild} from './workspace.js';
export function createTeamRuntime({account,store,getDevices=()=>[],getSessions=()=>[],resources=async()=>[],binding}){
 let active=null,lastSeen=null,until=0,syncing=false,lastHeartbeat=0,clientId=randomUUID();
 const file=path.join(store,'team-runtime-client.json');const ready=readFile(file,'utf8').then(raw=>{const v=JSON.parse(raw);if(/^[a-f0-9-]{36}$/.test(v.id))clientId=v.id;}).catch(async e=>{if(e.code!=='ENOENT')throw e;await mkdir(store,{recursive:true});await writeFile(file,JSON.stringify({id:clientId}),{mode:0o600});});ready.catch(()=>{});
 const error=(message,status=409)=>Object.assign(Error(message),{status});
 async function verify(a){const w=await account.request('/v1/teams/'+a.workspaceId),task=(w.tasks||[]).find(t=>t.id===a.taskId),s=w.debugSessions?.find(s=>s.id===a.sessionId);if(!task||task.assigneeId!==w.membership.userId||task.status!=='in-progress'||task.blocked||!w.membership.permissions.includes('sessions.prepare')||!w.membership.environments.includes(a.environment)||!s||s.status==='ended')throw error('Your task or debug access changed. Reconnect in Teams.');return w;}
 async function options(input){await ready;const b=await binding(input);return {binding:b,devices:getDevices().filter(d=>['ios','android'].includes(d.platform)).map(d=>({id:d.id,name:d.name,platform:d.platform,state:d.state})),active:active?{...active,settings:undefined,path:undefined}:null,extensionConnected:!!active&&getSessions().some(s=>s.teamSessionId===active?.sessionId)};}
 async function start(input){
  await ready;if(active&&getSessions().some(s=>s.teamSessionId===active.sessionId))throw error('Stop your current debug session before changing tasks.');
  const b=await binding(input);if(!b)throw error('Connect this project folder first.');
  const root=b.path,profile=await validateBuild(root,{flavor:input.flavor,target:input.target,defineFile:input.defineFile}).catch(e=>{throw error(e.message,400);});
  const targetIds=input.targetIds;if(!Array.isArray(targetIds)||!targetIds.length||targetIds.length>8||targetIds.some(id=>typeof id!=='string'))throw error('Choose up to eight online mobile devices.',400);
  const settings={workspace:root,...profile,targetIds,ideEnabled:true};const plan=launchPlan(settings,getDevices());if(plan.status!=='ready')throw error(plan.reason||'Start the selected devices first.');
  const devices=targetIds.map(id=>getDevices().find(d=>d.id===id));
  const w=await account.request('/v1/teams/'+input.workspaceId+'/debug-sessions',{projectId:input.projectId,taskId:input.taskId,environment:input.environment,clientId,teamDeviceIds:await resources(input),devices:devices.map(d=>({id:createHash('sha256').update(clientId+':'+d.id).digest('hex'),name:d.platform==='ios'?'iOS target':'Android target',platform:d.platform}))});
  const session=w.debugSessions.find(s=>s.clientId===clientId&&s.userId===w.membership.userId&&s.status==='preparing');if(!session)throw error('Could not prepare the team debug session.');
  active={workspaceId:input.workspaceId,projectId:input.projectId,taskId:input.taskId,environment:input.environment,sessionId:session.id,path:root,settings,status:'preparing',preparedAt:Date.now()};lastSeen=w;until=Date.now()+5000;return {sessionId:session.id,path:root,status:'preparing'};
 }
 async function plan(){
  if(!active||active.disabled)return null;
  try{if(Date.now()>until){lastSeen=await verify(active);until=Date.now()+5000;}await validateBuild(active.path,active.settings);const p=launchPlan(active.settings,getDevices());return {...p,team:{workspaceId:active.workspaceId,projectId:active.projectId,taskId:active.taskId},configurations:p.configurations.map(c=>({...c,__snapkitTeamSession:active.sessionId}))};}catch{return {protocol:1,workspace:active.path,status:'invalid',reason:'Reconnect your task in Teams. Access or the local project may have changed.',configurations:[]};}
 }
 async function sync(){if(!active||syncing||Date.now()-lastHeartbeat<15000)return;syncing=true;lastHeartbeat=Date.now();try{
  const sessions=getSessions().filter(s=>s.teamSessionId===active.sessionId),status=sessions.length?'running':active.status==='running'||Date.now()-active.preparedAt>120000?'ended':'preparing';
  if(active.disabled&&status==='preparing')return;
  const w=await account.request('/v1/teams/'+active.workspaceId+'/debug-sessions/'+active.sessionId+'/heartbeat',{status});lastSeen=w;active.status=status;if(status==='ended')active.disabled=true;
 }catch{until=0;}finally{syncing=false;}}
 return {options,start,plan,sync,active:()=>active?{path:active.path,sessionId:active.sessionId}:null,deactivate:async()=>{if(active){active.disabled=true;if(!getSessions().some(s=>s.teamSessionId===active.sessionId)){try{await account.request('/v1/teams/'+active.workspaceId+'/debug-sessions/'+active.sessionId+'/heartbeat',{status:'ended'});}catch{}active=null;}}},confirmStop:async stop=>{if(!active)throw error('No active Teams debug session.');const ids=getSessions().filter(s=>s.teamSessionId===active.sessionId).map(s=>s.deviceId);if(ids.length)stop(ids);else await account.request('/v1/teams/'+active.workspaceId+'/debug-sessions/'+active.sessionId+'/heartbeat',{status:'ended'});active.disabled=true;return {requested:true};}};
}
