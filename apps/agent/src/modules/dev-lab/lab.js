import {mkdir,readFile,writeFile,rename,rm} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {workspaceFlows,maestroExecutable,targetDevice} from './flows.js';
import {controlledRun,cleanLog} from './process.js';
import {measureApp} from './performance.js';
import {compareMeasurements} from '../../../../../packages/domain/dev-lab.js';
export class DevLab {
 constructor({store,getSettings,getDevices,conflict=()=>false,demo=false,run=controlledRun}){Object.assign(this,{store,getSettings,getDevices,conflict,demo,run});this.jobs=[];this.active=null;this.writes=Promise.resolve();this.closing=false;}
 async restore(){try{const rows=JSON.parse(await readFile(path.join(this.store,'dev-lab.json'),'utf8'));if(Array.isArray(rows))this.jobs=rows.slice(0,60).map(j=>j.status==='running'?{...j,status:'interrupted',error:'Snapkit stopped before this run finished'}:j);}catch{} }
 project(workspace=this.getSettings().workspace){return createHash('sha256').update(workspace||'').digest('hex').slice(0,24);}
 history(){return this.jobs.filter(j=>j.project===this.project());}
 async save(){if(this.demo)return;const data=JSON.stringify(this.jobs);this.writes=this.writes.catch(()=>{}).then(async()=>{await mkdir(this.store,{recursive:true});const file=path.join(this.store,'dev-lab.json');await writeFile(file+'.tmp',data,{mode:0o600});await rename(file+'.tmp',file);});await this.writes;}
 async status(){const workspace=this.getSettings().workspace;const found=this.demo?{flows:[],fingerprint:''}:await workspaceFlows(workspace);return {demo:this.demo,workspace:workspace||'',...found,devices:this.getDevices().filter(d=>{try{targetDevice(d);return true;}catch{return false;}}).map(d=>({id:d.id,name:d.name,platform:d.platform})),jobs:this.history().map(j=>({...j,logs:j.logs.slice(-4000),results:j.results.map(({junit,...result})=>result)})),active:this.active?.id||null};}
 async check(){if(this.demo)return {available:false,demo:true,version:''};try{return {available:true,version:(await this.run(maestroExecutable(),['--version'],{timeout:15000})).slice(-500)};}catch(e){return {available:false,error:cleanLog(e.message),help:'Install Maestro from https://docs.maestro.dev/getting-started/installing-maestro'};}}
 async start(kind,input={}){
  if(this.demo)throw Error('Demo only. Open Snapkit Desktop to run on your devices');
  if(this.closing||this.active||this.conflict())throw Error('Stop active builds, debug sessions, recordings and kit tasks before running Dev Lab');
  if(!['test','performance'].includes(kind))throw Error('Unknown Dev Lab task');
  // Reserve before any asynchronous validation, including discovery.
  const reservation={id:randomUUID(),controller:new AbortController()};let ready;reservation.ready=new Promise(resolve=>{ready=resolve;});reservation.done=reservation.ready.then(()=>reservation.execution);this.active=reservation;
  try{
   const workspace=this.getSettings().workspace;if(!workspace)throw Error('Connect a workspace first');
   const ids=[...new Set(input.deviceIds||[])];if(!ids.length||ids.length>4||kind==='performance'&&ids.length!==1)throw Error('Choose 1–4 devices, or one for performance');
   const devices=ids.map(id=>targetDevice(this.getDevices().find(d=>d.id===id)));
   const found=await workspaceFlows(workspace),flow=found.flows.find(f=>f.id===input.flowId);
   if((kind==='test'||input.flowId)&&!flow)throw Error('Choose an entry flow from the workspace .maestro folder');
   const seconds=Number(input.seconds??5);if(!Number.isInteger(seconds)||seconds<1||seconds>60)throw Error('Observation duration must be 1–60 seconds');
   const appId=String(input.appId||'');if(kind==='performance'&&!/^[a-zA-Z][a-zA-Z0-9_]*(?:[.][a-zA-Z0-9_-]+)+$/.test(appId))throw Error('Enter a valid package or bundle identifier');
   if(reservation.controller.signal.aborted)throw Error('Cancelled');
   const job={id:reservation.id,kind,project:this.project(workspace),createdAt:new Date().toISOString(),status:'running',label:cleanLog(String(input.label||'')).slice(0,100),appId,flowId:flow?.id||'',workload:(flow?found.fingerprint+':'+flow.id:'idle')+':'+seconds,deviceId:devices[0].id,os:devices[0].os||devices[0].version||devices[0].runtime||devices[0].platform,logs:'',results:[]};
   this.jobs.unshift(job);this.jobs=this.jobs.slice(0,60);await this.save();
   reservation.execution=this.execute(job,{workspace,devices,flow,fingerprint:found.fingerprint,seconds,signal:reservation.controller.signal}).catch(e=>{job.status=reservation.controller.signal.aborted?'cancelled':'failed';job.error=cleanLog(e.message).slice(-4000);}).finally(async()=>{job.finishedAt=new Date().toISOString();try{await this.save();}catch(e){job.status='failed';job.error='Could not save run history: '+cleanLog(e.message);}finally{if(this.active===reservation)this.active=null;}});
   return job;
  }catch(error){if(this.active===reservation)this.active=null;throw error;}finally{ready();}
 }
 async execute(job,{workspace,devices,flow,fingerprint,seconds,signal}){
  const run=(name,args,options={})=>{const prior=job.logs;return this.run(name,args,{cwd:workspace,signal,...options,onOutput:out=>{job.logs=cleanLog((prior+'\n'+out).slice(-128*1024));}});};
  if(signal.aborted)throw Error('Cancelled');
  const directory=path.join(this.store,'dev-lab-runs',job.id);await mkdir(directory,{recursive:true,mode:0o700});
  try{
   const test=async(device,index)=>{
    const current=await workspaceFlows(workspace);if(current.fingerprint!==fingerprint)throw Error('Workspace Maestro files changed. Start a new run');if(!current.flows.some(f=>f.id===flow.id))throw Error('Flow no longer exists');
    const report=path.join(directory,index+'.xml');
    let failure;try{await run(maestroExecutable(),['--device',device.connection,'test','--format','JUNIT','--output',report,path.join(workspace,flow.id)],{timeout:300000});}catch(e){failure=e;}
    let junit='';try{const value=await readFile(report,'utf8');junit=cleanLog(value.slice(0,128*1024));}catch{}
    if(failure){failure.junit=junit;throw failure;}return junit;
   };
   if(job.kind==='test')for(const [index,device]of devices.entries()){
    try{const junit=await test(device,index);job.results.push({deviceId:device.id,name:device.name,status:'succeeded',junit});}catch(e){job.results.push({deviceId:device.id,name:device.name,status:signal.aborted?'cancelled':'failed',error:cleanLog(e.message),junit:e.junit||''});if(signal.aborted)throw e;}
    await this.save();
   }else Object.assign(job,await measureApp({device:devices[0],appId:job.appId,run,signal,workload:async()=>{if(flow)await test(devices[0],0);await delay(seconds*1000,undefined,{signal});}}));
   job.status=job.results.some(r=>r.status==='failed')?'failed':'succeeded';
  }finally{await rm(directory,{recursive:true,force:true});}
 }
 async cancel(){const active=this.active;if(!active)return;active.controller.abort();await active.done;}
 async close(){this.closing=true;await this.cancel();await this.writes;}
 compare(a,b){return compareMeasurements(this.history().find(j=>j.id===a),this.history().find(j=>j.id===b));}
}
