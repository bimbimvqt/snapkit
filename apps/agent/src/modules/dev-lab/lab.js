import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {targetDevice} from './targets.js';
import {controlledRun,cleanLog} from './process.js';
import {measureApp} from './performance.js';
import {compareMeasurements} from '../../../../../packages/domain/dev-lab.js';
export class DevLab {
 constructor({store,getSettings,getDevices,conflict=()=>false,demo=false,run=controlledRun}){Object.assign(this,{store,getSettings,getDevices,conflict,demo,run});this.jobs=[];this.active=null;this.writes=Promise.resolve();this.closing=false;}
 async restore(){try{const rows=JSON.parse(await readFile(path.join(this.store,'dev-lab.json'),'utf8'));if(Array.isArray(rows))this.jobs=rows.filter(j=>j.kind==='performance'&&/^idle:/.test(j.workload||'')).slice(0,60).map(j=>j.status==='running'?{...j,status:'interrupted',error:'Snapkit stopped before this run finished'}:j);}catch{} }
 project(workspace=this.getSettings().workspace){return createHash('sha256').update(workspace||'').digest('hex').slice(0,24);}
 history(){return this.jobs.filter(j=>j.project===this.project());}
 async save(){if(this.demo)return;const data=JSON.stringify(this.jobs);this.writes=this.writes.catch(()=>{}).then(async()=>{await mkdir(this.store,{recursive:true});const file=path.join(this.store,'dev-lab.json');await writeFile(file+'.tmp',data,{mode:0o600});await rename(file+'.tmp',file);});await this.writes;}
 async status(){const workspace=this.getSettings().workspace;return {demo:this.demo,workspace:workspace||'',devices:this.getDevices().filter(d=>{try{targetDevice(d);return true;}catch{return false;}}).map(d=>({id:d.id,name:d.name,platform:d.platform})),jobs:this.history().map(j=>({...j,logs:j.logs.slice(-4000)})),active:this.active?.id||null};}
 async start(kind,input={}){
  if(this.demo)throw Error('Demo only. Open Snapkit Desktop to run on your devices');
  if(this.closing||this.active||this.conflict())throw Error('Stop active builds, debug sessions, recordings and kit tasks before running Dev Lab');
  if(kind!=='performance'||input.flowId)throw Error('Unknown Dev Lab task');
  // Reserve before persisting the job to prevent simultaneous runs.
  const reservation={id:randomUUID(),controller:new AbortController()};let ready;reservation.ready=new Promise(resolve=>{ready=resolve;});reservation.done=reservation.ready.then(()=>reservation.execution);this.active=reservation;
  try{
   const workspace=this.getSettings().workspace;if(!workspace)throw Error('Connect a workspace first');
   const ids=[...new Set(input.deviceIds||[])];if(!ids.length||ids.length!==1)throw Error('Choose one online device for performance');
   const devices=ids.map(id=>targetDevice(this.getDevices().find(d=>d.id===id)));
   const seconds=Number(input.seconds??5);if(!Number.isInteger(seconds)||seconds<1||seconds>60)throw Error('Observation duration must be 1–60 seconds');
   const appId=String(input.appId||'');if(kind==='performance'&&!/^[a-zA-Z][a-zA-Z0-9_]*(?:[.][a-zA-Z0-9_-]+)+$/.test(appId))throw Error('Enter a valid package or bundle identifier');
   if(reservation.controller.signal.aborted)throw Error('Cancelled');
   const job={id:reservation.id,kind,project:this.project(workspace),createdAt:new Date().toISOString(),status:'running',label:cleanLog(String(input.label||'')).slice(0,100),appId,workload:'idle:'+seconds,deviceId:devices[0].id,os:devices[0].os||devices[0].version||devices[0].runtime||devices[0].platform,logs:'',results:[]};
   this.jobs.unshift(job);this.jobs=this.jobs.slice(0,60);await this.save();
   reservation.execution=this.execute(job,{workspace,devices,seconds,signal:reservation.controller.signal}).catch(e=>{job.status=reservation.controller.signal.aborted?'cancelled':'failed';job.error=cleanLog(e.message).slice(-4000);}).finally(async()=>{job.finishedAt=new Date().toISOString();try{await this.save();}catch(e){job.status='failed';job.error='Could not save run history: '+cleanLog(e.message);}finally{if(this.active===reservation)this.active=null;}});
   return job;
  }catch(error){if(this.active===reservation)this.active=null;throw error;}finally{ready();}
 }
 async execute(job,{workspace,devices,seconds,signal}){
  const run=(name,args,options={})=>{const prior=job.logs;return this.run(name,args,{cwd:workspace,signal,...options,onOutput:out=>{job.logs=cleanLog((prior+'\n'+out).slice(-128*1024));}});};
  if(signal.aborted)throw Error('Cancelled');
  Object.assign(job,await measureApp({device:devices[0],appId:job.appId,run,signal,workload:()=>delay(seconds*1000,undefined,{signal})}));
  job.status='succeeded';
 }
 async cancel(){const active=this.active;if(!active)return;active.controller.abort();await active.done;}
 async close(){this.closing=true;await this.cancel();await this.writes;}
 compare(a,b){return compareMeasurements(this.history().find(j=>j.id===a),this.history().find(j=>j.id===b));}
}
