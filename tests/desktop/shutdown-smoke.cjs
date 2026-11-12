'use strict';
// Exercise the real utility process and an open event stream, without user data.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
if(!process.versions.electron){
 const {spawn}=require('node:child_process');
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const child=spawn(require('electron'),[__filename],{stdio:'inherit',env});
 const timer=setTimeout(()=>{child.kill();process.exitCode=1;},30000);
 child.once('error',error=>{clearTimeout(timer);console.error(error);process.exitCode=1;});
 child.once('exit',code=>{clearTimeout(timer);process.exitCode=code===0?0:1;});
}else{
 const {app,utilityProcess}=require('electron');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'snapkit-shutdown-'));
 app.setPath('userData',path.join(root,'profile'));
 let agent;
 app.whenReady().then(async()=>{
  const probe=require('node:net').createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  for(let attempt=0;attempt<2;attempt++){
   agent=utilityProcess.fork(path.resolve(__dirname,'../../apps/agent/src/main.js'),['--demo'],{env:{...process.env,PORT:String(port),SNAPKIT_DATA_ROOT:root,SNAPKIT_DESKTOP:'1'},stdio:'pipe'});
   let errors='';agent.stderr.on('data',chunk=>{errors+=chunk;});
   const origin=`http://127.0.0.1:${port}`;let ready=false;
   for(let i=0;i<100;i++){try{ready=(await fetch(origin+'/api/health',{signal:AbortSignal.timeout(200)})).ok;}catch{}if(ready)break;await new Promise(resolve=>setTimeout(resolve,50));}
   assert.ok(ready,errors||'Agent did not start');
   const stream=await fetch(origin+'/api/events');assert.equal(stream.status,200);const reader=stream.body.getReader();await reader.read();
   const start=Date.now();let timer;
   try{
    const exited=new Promise(resolve=>agent.once('exit',resolve));agent.postMessage({type:'shutdown'});agent.postMessage({type:'shutdown'});
    const code=await Promise.race([exited,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Idle agent did not exit within 3 seconds: '+errors)),3000);})]);assert.equal(code,0,errors);
    console.log(`PASS: agent shutdown ${Date.now()-start}ms, event stream closed; same-port launch ${attempt+1}`);
   }finally{clearTimeout(timer);await reader.cancel().catch(()=>{});}
  }
  fs.rmSync(root,{recursive:true,force:true});app.quit();
 }).catch(error=>{console.error(error);agent?.kill();fs.rmSync(root,{recursive:true,force:true});app.exit(1);});
}
