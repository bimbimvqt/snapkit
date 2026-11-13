import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink,realpath} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {kitRoutes,validateRecipe,hashFile} from '../../apps/agent/src/modules/kit/kit.js';
import {sharedStartKit} from '../../packages/domain/start-kit.js';

test('start kits carry bounded data, never arbitrary commands or local team paths',()=>{
 for(const ports of [[80],[65536],['3000;rm -rf'],[NaN],Array.from({length:9},(_,n)=>3000+n)])assert.throws(()=>validateRecipe({ports}));
 assert.deepEqual(validateRecipe({ports:[3000,3000],command:'evil'}),{openEditor:true,compose:false,ports:[3000],deviceIds:[]});
 assert.deepEqual(sharedStartKit({openEditor:true,compose:false,ports:[8080],path:'/private',command:'bad',token:'secret'}),{openEditor:true,compose:false,ports:[8080]});
 assert.throws(()=>sharedStartKit({openEditor:'yes',compose:false,ports:[]}));
});
async function fixture(options={}){
 const root=await mkdtemp(path.join(os.tmpdir(),'snapkit-kit-')),project=path.join(root,'project'),store=path.join(root,'store');await mkdir(project);const calls=[];const settings={workspace:project,framework:'flutter',targetIds:['avd-id']};
 const app=express();app.use(express.json());app.use((req,_res,next)=>{if(req.headers['x-test-remote'])req.remoteToken='remote';next();});
 const router=kitRoutes({store,getSettings:()=>settings,getDevices:()=>[{id:'avd-id',name:'Pixel',platform:'android',flutterId:'emulator-5554',state:'online'}],getEditor:()=> 'vscode',boot:async d=>calls.push(['boot',d.id]),diagnostics:async()=>({checks:[]}),command:async(name,args)=>{calls.push([name,args]);if(name==='git')return args.includes('symbolic-ref')?'feature/test\n':'';return '';},...options});app.use('/api/kit',router);app.use((e,_req,res,_next)=>res.status(e.status||400).json({error:e.message}));const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const request=async(route='',body,headers={})=>{const response=await fetch(`http://127.0.0.1:${server.address().port}/api/kit${route}`,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,data:await response.json()};};
 return {root,store,project,calls,settings,router,request,close:async()=>{await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});}};
}
async function finished(f){for(let i=0;i<30;i++){const {data}=await f.request('/run');if(data.job?.status!=='running')return data.job;await new Promise(resolve=>setTimeout(resolve,10));}throw Error('Kit did not finish');}

test('resume is a visible job, prevents duplicate starts and reports each failed step',async()=>{
 let release;const gate=new Promise(resolve=>{release=resolve;});let called=0;const f=await fixture({command:async(name)=>{if(name==='open'||name.endsWith('.cmd')||name==='code'){called++;await gate;throw Error('private path must not appear');}return '';}});
 try{await f.request('/recipe',{openEditor:true,compose:false,ports:[3000],deviceIds:['removed']});const first=await f.request('/resume',{});assert.equal(first.status,202);assert.equal(f.router.busy(),true);assert.equal((await f.request('/run')).data.job.currentStep,'Editor');assert.equal((await f.request('/run',undefined,{'x-test-remote':'yes'})).status,403);assert.equal((await f.request('/resume',{})).status,409);release();const job=await finished(f);assert.equal(called,1);assert.equal(job.status,'attention');assert.equal(job.results.length,2);assert.doesNotMatch(JSON.stringify(job),/private path/);assert.equal(f.router.busy(),false);assert.ok((await f.request()).data.lastStartedAt);assert.equal((await f.request('',undefined,{'x-test-remote':'yes'})).status,403);}finally{release();await f.close();}
});

test('file hashes persist locally, install uses the ADB serial and tampered APKs are rejected',async()=>{
 const f=await fixture();try{const file=path.join(f.root,'test.apk'),content='sample fixture, not an executable';await writeFile(file,content);const resolved=await realpath(file);const expected=createHash('sha256').update(content).digest('hex');assert.equal((await hashFile(file)).sha256,expected);assert.equal((await f.request('/files',{paths:[f.root]})).status,400);
 const added=await f.request('/files',{paths:[file]});assert.equal(added.status,200);const item=added.data.files[0];assert.equal(item.sha256,expected);assert.equal('path' in item,false);assert.equal((await f.request('/files/'+item.id+'/link',{taskId:'workspace / #10'})).status,200);assert.equal(JSON.parse(await readFile(path.join(f.store,'kit.json'),'utf8')).files[0].taskId,'workspace / #10');
 assert.equal((await f.request('/files/'+item.id+'/install',{})).status,202);assert.equal((await finished(f)).status,'complete');assert.ok(f.calls.some(([name,args])=>name==='adb'&&args[1]==='emulator-5554'&&args.at(-1)===resolved));await writeFile(file,'changed');const tampered=await f.request('/files/'+item.id+'/install',{});assert.equal(tampered.status,400);assert.match(tampered.data.error,/changed/);await f.request('/files/'+item.id+'/remove',{});assert.equal(await readFile(file,'utf8'),'changed');assert.deepEqual((await f.request()).data.files,[]);
 }finally{await f.close();}
});

test('machine scans do not follow build symlinks and shared kits require the bound project',async()=>{
 const f=await fixture({getTeamPlan:async()=>({path:os.tmpdir(),plan:{openEditor:true,compose:false,ports:[]}})});try{await writeFile(path.join(f.root,'private'),'outside');await symlink(f.root,path.join(f.project,'build'));const machine=(await f.request('/machine')).data;assert.equal(machine.caches.find(c=>c.name==='build').bytes,0);assert.equal((await f.request('/team-plan',{workspaceId:'w',projectId:'p'})).status,409);assert.equal((await f.request('/machine',undefined,{'x-test-remote':'1'})).status,403);}finally{await f.close();}
});

test('Antigravity launches the IDE bundle or IDE CLI rather than the other application',async()=>{
 const f=await fixture({getEditor:()=> 'antigravity'});try{await f.request('/resume',{});assert.equal((await finished(f)).status,'complete');const launch=f.calls.find(([name])=>name==='open'||name.startsWith('antigravity'));assert.deepEqual(launch,process.platform==='darwin'?['open',['-b','com.google.antigravity-ide',f.project]]:[process.platform==='win32'?'antigravity-ide.cmd':'antigravity-ide',['--reuse-window',f.project]]);}finally{await f.close();}
});

test('saved device recipes discover on resume while ordinary startup and editor-only kits stay passive',async()=>{
 let scans=0,booted=false;const devices=[];
 const f=await fixture({getDevices:()=>devices,discoverDevices:async()=>{scans++;devices.push({id:'saved',name:'Saved phone',state:'offline'});},boot:async()=>{booted=true;}});
 try{
  await f.request();assert.equal(scans,0);
  await f.request('/recipe',{openEditor:false,deviceIds:[]});await f.request('/resume',{});await finished(f);assert.equal(scans,0);
  await f.request('/recipe',{openEditor:false,deviceIds:['saved']});await f.request('/resume',{});const job=await finished(f);assert.equal(scans,1);assert.equal(booted,true);assert.equal(job.status,'complete');
 }finally{await f.close();}
});
