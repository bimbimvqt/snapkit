import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,rm,readFile,realpath} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('workspace API persists activation across restart, rejects mismatched projects and protects debug sessions',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'snapkit-spaces-'));
  const account=createServer((_req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({user:{id:'fixture'}}));});
  const probe=createServer();let agent,origin,token;
  async function stop(){if(agent&&agent.exitCode===null){const ended=new Promise(resolve=>agent.once('exit',resolve));agent.kill();await ended;}}
  async function start(){
    agent=spawn(process.execPath,['apps/agent/src/main.js'],{env:{...process.env,PORT:new URL(origin).port,SNAPKIT_DATA_ROOT:root,SNAPKIT_ACCOUNT_SERVER:`http://127.0.0.1:${account.address().port}`,SNAPKIT_ADB:process.execPath,SNAPKIT_EMULATOR:process.execPath,SNAPKIT_XCRUN:process.execPath},stdio:['ignore','pipe','pipe']});
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),10000);agent.once('error',reject);agent.once('exit',code=>{clearTimeout(timer);reject(Error('Agent exited '+code));});agent.stdout.on('data',data=>{if(data.toString().includes('http://')){clearTimeout(timer);resolve();}});});
    token=(await fetch(origin+'/api/state').then(r=>r.json())).token;
  }
  async function post(route,data){return fetch(origin+route,{method:'POST',headers:{'Content-Type':'application/json','X-Snapkit-Token':token},body:JSON.stringify(data)});}
  try{
    await new Promise(resolve=>account.listen(0,'127.0.0.1',resolve));await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${probe.address().port}`;await new Promise(resolve=>probe.close(resolve));
    await mkdir(path.join(root,'state'),{recursive:true});
    await writeFile(path.join(root,'state/account-session.json'),JSON.stringify({token:'test-only-fixture'}));
    const project=path.join(root,'native');await mkdir(path.join(project,'android'),{recursive:true});await writeFile(path.join(project,'package.json'),JSON.stringify({dependencies:{'react-native':'0.82.0'}}));
    await start();
    const created=await post('/api/workspaces/create',{name:'Native',type:'react-native'}).then(r=>r.json());
    const nativeId=created.settings.spaceId;
    assert.equal(created.settings.framework,'react-native');assert.equal(created.settings.workspace,'');
    assert.equal((await post('/api/workspace',{path:project})).status,200);
    const backend=await post('/api/workspaces/create',{name:'Services',type:'backend'}).then(r=>r.json());
    assert.equal(backend.settings.ideEnabled,false);
    assert.equal((await post('/api/targets',{ids:[]})).status,409);
    assert.equal((await post('/api/workspace',{path:project})).status,400);
    await post('/api/workspaces/activate',{id:nativeId});
    // A failed registry commit must neither add a space nor change the active
    // setup after restart, even when compatibility settings were already written.
    await mkdir(path.join(root,'state/spaces.json.tmp'));
    assert.equal((await post('/api/workspaces/create',{name:'Failed save',type:'backend'})).status,400);
    assert.equal((await fetch(origin+'/api/state').then(r=>r.json())).settings.spaceId,nativeId);
    await rm(path.join(root,'state/spaces.json.tmp'),{recursive:true});
    await stop();await start();
    const saved=await fetch(origin+'/api/state').then(r=>r.json());assert.equal(saved.settings.spaceId,nativeId);assert.equal(saved.settings.workspace,await realpath(project));
    assert.equal((await fetch(origin+'/api/workspaces').then(r=>r.json())).workspaces.length,3);
    await post('/api/ide/sessions',{ownerId:'test',sessions:[{id:'debug',deviceId:'phone',name:'Native debug'}]});
    assert.equal((await post('/api/workspaces/activate',{id:backend.settings.spaceId})).status,409);
    assert.equal((await post('/api/workspaces/create',{name:'Blocked',type:'flutter'})).status,409);
    await post('/api/ide/sessions',{ownerId:'test',sessions:[]});
    assert.equal((await post('/api/workspaces/create',{name:'native',type:'flutter'})).status,400);
    assert.equal((await fetch(origin+'/api/state').then(r=>r.json())).settings.spaceId,nativeId);
    const registry=JSON.parse(await readFile(path.join(root,'state/spaces.json'),'utf8'));assert.equal(registry.settings.spaceId,nativeId);assert.equal(registry.entries.length,3);
  }finally{await stop();await new Promise(resolve=>account.close(resolve));await rm(root,{recursive:true,force:true});}
});
