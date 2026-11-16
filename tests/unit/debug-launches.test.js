import test from 'node:test';
import assert from 'node:assert/strict';
import { DebugLaunches } from '../../apps/agent/src/modules/ide/debug-launches.js';
import { IDESessions } from '../../apps/agent/src/modules/ide/ide-sessions.js';
import { mkdtemp, rm, realpath } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const { createSessionControl } = createRequire(import.meta.url)('../../apps/ide-extension/session-control.cjs');

test('launches require one matching live IDE, retain immutable configuration, acknowledge by owner, deduplicate and expire', () => {
 let now = 0;
 const broker = new DebugLaunches({now:()=>now}), plan = {workspace:'/app',status:'ready',configurations:[{program:'/app/main_dev.dart'}]};
 assert.throws(()=>broker.start(plan),/Open this project/);
 broker.exchange('one',['/app']); broker.exchange('other',['/other']);
 const job=broker.start(plan);plan.configurations[0].program='/app/main_prod.dart';
 assert.throws(()=>broker.start(plan),/already starting/);
 assert.deepEqual(broker.exchange('other',['/other']),[]);
 assert.equal(broker.exchange('one',['/app'])[0].plan.configurations[0].program,'/app/main_dev.dart');
 broker.exchange('other',['/other'],[{id:job.id,status:'started'}]);assert.equal(broker.status(job.id).status,'queued');
 broker.exchange('one',['/app'],[{id:job.id,status:'started'}]);assert.equal(broker.status(job.id).status,'started');
 broker.exchange('two',['/app']);assert.throws(()=>broker.start(plan),/multiple IDE/);
 now=10001;assert.throws(()=>broker.start(plan),/Open this project/);
 broker.exchange('one',['/app']);const timed=broker.start(plan);now+=120001;assert.equal(broker.status(timed.id).status,'failed');
});

test('reload/restart commands are scoped to selected session owners and acknowledged once', () => {
 const sessions=new IDESessions();
 const report=(owner,id,results=[])=>sessions.exchange({ownerId:owner,sessions:[{id,deviceId:id,name:id}],actionResults:results});
 report('one','s1');report('two','s2');
 assert.equal(sessions.requestAction(['s1'],'hotReload'),1);sessions.requestAction(['s1'],'hotReload');
 assert.equal(report('two','s2').actions.length,0);
 const actions=report('one','s1').actions;assert.equal(actions.length,1);assert.equal(actions[0].command,'hotReload');
 assert.equal(report('one','s1',[actions[0].id]).actions.length,0);
 assert.throws(()=>sessions.requestAction(['s1'],'exec'),/Invalid/);
});

test('idle IDE bridge launches only a trusted matching folder once while maintaining heartbeats, then reloads the exact session', async () => {
 const dir=await mkdtemp(path.join(os.tmpdir(),'snapkit-ide-launch-')),root=await realpath(dir);
 let launched=0,finish,commands=[],lastReport,requestResult={};
 const vscode={workspace:{isTrusted:true,workspaceFolders:[{uri:{fsPath:dir}}],getConfiguration:()=>({get:(_key,fallback)=>fallback})},debug:{startDebugging:async(_folder,config)=>{launched++;assert.equal(config.__snapkitLaunchPlan.workspace,root);return new Promise(resolve=>finish=resolve);},stopDebugging:async()=>{}}};
 const control=createSessionControl(vscode,{request:async(_base,route,body)=>{
  if(route==='/api/state')return {token:'token'};lastReport=body;return requestResult;
 }});
 try{
  requestResult={launches:[{id:'launch',plan:{workspace:root,status:'ready'}}]};
  await control.tick();assert.equal(launched,1);assert.deepEqual(lastReport.workspaces,[root]);
  await control.tick();assert.equal(launched,1,'A repeated delivery during build cannot start twice');
  requestResult={};finish(true);await new Promise(resolve=>setImmediate(resolve));
  for(let attempt=0;attempt<50&&!lastReport.launchResults?.length;attempt++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(lastReport.launchResults[0].status,'started');
  const session={id:'s1',name:'dev',type:'dart',configuration:{deviceId:'device'},customRequest:async command=>commands.push(command)};
  control.started(session);await new Promise(resolve=>setImmediate(resolve));
  requestResult={actions:[{id:'reload',sessionId:'s1',command:'hotReload'}]};
  for(let attempt=0;attempt<50&&!commands.length;attempt++){await control.tick();await new Promise(resolve=>setTimeout(resolve,10));}
  await control.tick();assert.deepEqual(commands,['hotReload']);
  vscode.workspace.isTrusted=false;requestResult={launches:[{id:'untrusted',plan:{workspace:root,status:'ready'}}]};await control.tick();assert.equal(launched,1);
 }finally{control.dispose();await rm(dir,{recursive:true,force:true});}
});

test('Run from Snapkit uses its captured build profile even when IDE settings prefer IDE profiles and dashboard targets are paused', async()=>{
 const {createDashboardDebug}=createRequire(import.meta.url)('../../apps/ide-extension/dashboard-debug.cjs');
 const root=path.resolve('flutter-project'),launches=[];
 const plan={protocol:1,status:'ready',workspace:root,configurations:[1,2].map(id=>({type:'dart',request:'launch',flutterMode:'debug',name:'Device '+id,cwd:root,deviceId:String(id),program:path.join(root,'lib/main_prod.dart'),toolArgs:['--flavor','prod']}))};
 const vscode={workspace:{isTrusted:true,getConfiguration:()=>({get:(key,fallback)=>key==='useDashboardTargets'?false:fallback})},window:{showErrorMessage(){},showWarningMessage(){}},debug:{startDebugging:async(_folder,config)=>{launches.push(config);return true;},stopDebugging:async()=>{}}};
 const debug=createDashboardDebug(vscode,{canonical:async p=>p,flutterProject:async()=>true,readPlan:async()=>{throw Error('Captured button launch must not re-read mutable settings');}});
 try{
  const first=await debug.provider.resolveDebugConfiguration({uri:{fsPath:root}},{type:'dart',request:'launch',__snapkitLaunchPlan:plan});
  assert.equal(first.program,path.join(root,'lib/main_prod.dart'));assert.deepEqual(first.toolArgs,['--flavor','prod']);assert.equal(first.__snapkitLaunchPlan,undefined);
  await debug.started({id:'first',configuration:first});assert.equal(launches.length,1);assert.equal(launches[0].program,first.program);
 }finally{debug.dispose();}
});

test('named IDE Run profile keeps all launch arguments and environment when Snapkit fans out selected devices',async()=>{
 const {createDashboardDebug}=createRequire(import.meta.url)('../../apps/ide-extension/dashboard-debug.cjs');
 const root=path.resolve('flutter-project'),launches=[];
 const plan={protocol:1,status:'ready',workspace:root,ideProfile:{name:'Dev'},configurations:[1,2].map(id=>({type:'dart',request:'launch',flutterMode:'debug',name:'Device '+id,cwd:root,deviceId:String(id),program:path.join(root,'lib/main.dart'),toolArgs:['--flavor','prod']}))};
 const vscode={workspace:{isTrusted:true,getConfiguration:()=>({get:(_key,fallback)=>fallback})},window:{showErrorMessage(){},showWarningMessage(){}},debug:{startDebugging:async(_folder,config)=>{launches.push(config);return true;},stopDebugging:async()=>{}}};
 const debug=createDashboardDebug(vscode,{canonical:async p=>p,flutterProject:async()=>true});
 try{
  const original={type:'dart',request:'launch',name:'Dev',program:'lib/main_dev.dart',args:['--flavor','dev','--dart-define=ENV=dev'],toolArgs:['--verbose'],env:{LOCAL_ENV:'dev'},__snapkitLaunchPlan:plan};
  const first=await debug.provider.resolveDebugConfiguration({uri:{fsPath:root}},original);
  for(const key of ['program','args','toolArgs','env'])assert.deepEqual(first[key],original[key]);
  await debug.started({id:'first',configuration:first});assert.equal(launches.length,1);
  for(const key of ['program','args','toolArgs','env'])assert.deepEqual(launches[0][key],original[key]);
 }finally{debug.dispose();}
});

test('bridge loads exactly the named trusted IDE profile and fails clearly when it no longer exists',async()=>{
 const root=await realpath(process.cwd()),configs=[{type:'dart',request:'launch',name:'Dev',program:'lib/main_dev.dart',env:{LOCAL_ENV:'dev'},args:['--flavor','dev']}],launched=[],reports=[];
 let command={id:'chosen',plan:{workspace:root,status:'ready',ideProfile:{name:'Dev'}}};
 const vscode={workspace:{isTrusted:true,workspaceFolders:[{uri:{fsPath:root}}],getConfiguration:section=>({get:(key,fallback)=>section==='launch'&&key==='configurations'?configs:fallback})},debug:{startDebugging:async(_folder,config)=>{launched.push(config);return true;}}};
 const control=createSessionControl(vscode,{request:async(_base,route,body)=>{if(route==='/api/state')return {token:'test'};reports.push(body);return {launches:[command]};}});
 try{
  await control.tick();await new Promise(resolve=>setImmediate(resolve));assert.equal(launched[0].program,'lib/main_dev.dart');assert.deepEqual(launched[0].env,{LOCAL_ENV:'dev'});
  configs.splice(0);command={...command,id:'deleted'};await control.tick();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(launched.length,1);
  for(let i=0;i<50&&!reports.flatMap(r=>r.launchResults).some(r=>r.id==='deleted'&&r.status==='failed');i++){await control.tick();await new Promise(resolve=>setTimeout(resolve,10));}
  assert.ok(reports.flatMap(r=>r.launchResults).some(r=>r.id==='deleted'&&r.status==='failed'));
 }finally{control.dispose();}
});
