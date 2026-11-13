import {spawn} from 'node:child_process';
import {launch} from '../../infrastructure/process/cli.js';
import {redactBuildLog} from '../../domain/release-plan.js';
export const cleanLog=value=>redactBuildLog(value).replace(/((?:password|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token|authorization|token)["']?\s*[:=]\s*["']?)[^\s,;"']+/gi,'$1[redacted]').replace(/((?:refresh[_-]?token|id[_-]?token)\s*[:=]\s*)[^\s,;]+/gi,'$1[redacted]');
export function controlledRun(name,args,{signal,timeout=30000,cwd,onOutput}={}){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted)return reject(Error('Cancelled'));
  let child;try{child=launch(name,args,{cwd,detached:process.platform!=='win32',stdio:['ignore','pipe','pipe']});}catch(error){reject(error);return;}
  let output='',finished=false,timer,termination;
  const terminate=()=>{
   if(!child.pid||finished||termination)return;
   termination=new Promise(done=>{
    if(process.platform==='win32'){
     const killer=spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
     const deadline=setTimeout(done,3000);killer.once('error',()=>{clearTimeout(deadline);done();});killer.once('close',()=>{clearTimeout(deadline);done();});
    }else{
     try{process.kill(-child.pid,'SIGTERM');}catch{done();return;}
     setTimeout(()=>{try{process.kill(-child.pid,'SIGKILL');}catch{}done();},1500);
    }
   });
  };
  const abort=()=>terminate();signal?.addEventListener('abort',abort,{once:true});
  const finish=async(error)=>{if(finished)return;finished=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);await termination;error?reject(error):resolve(cleanLog(output));};
  const append=chunk=>{output=(output+chunk.toString()).slice(-128*1024);onOutput?.(cleanLog(output));};
  child.stdout.on('data',append);child.stderr.on('data',append);
  let timedOut=false;timer=setTimeout(()=>{timedOut=true;terminate();},timeout);
  child.once('error',error=>void finish(Error(cleanLog(error.message))));
  child.once('close',code=>void finish(signal?.aborted?Error('Cancelled'):timedOut?Error('Command timed out'):code!==0?Error(cleanLog(output.trim()||name+' exited with '+code)):null));
 });
}
