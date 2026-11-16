import test from 'node:test';
import assert from 'node:assert/strict';
import { debugProfiles } from '../../apps/agent/src/modules/ide/debug-profiles.js';
import { WorkspaceSpaces } from '../../apps/agent/src/modules/workspace/spaces.js';
import { DebugLaunches } from '../../apps/agent/src/modules/ide/debug-launches.js';
const readProfiles = async () => ({ profiles: [
  {name:'Merchant',flavor:'prod',target:'lib/main.dart'}, {name:'Merchant dev',flavor:'dev',target:'lib/main_dev.dart'},
  {name:'Duplicated',target:'lib/main.dart'}, {name:'Duplicated',target:'lib/main_dev.dart'},
  {name:'Tests',target:'integration_test/app_test.dart'}
] });
test('Run catalog exposes actual dev/prod profiles, keeps saved choices and never falls back when a selected profile disappears', async () => {
  const settings={workspace:'/project',framework:'flutter',flavor:'dev',target:'lib/main_dev.dart'};
  const saved=[{id:'abc',name:'Staging',framework:'flutter',flavor:'staging',target:'lib/staging.dart'}];
  const catalog=await debugProfiles(settings,saved,{readProfiles});
  assert.deepEqual(catalog.profiles.map(p=>p.name),['Snapkit project settings','Merchant','Merchant dev','Staging']);
  assert.equal(catalog.selected.flavor,'dev');
  const prod=catalog.profiles.find(p=>p.name==='Merchant');
  assert.equal((await debugProfiles({...settings,debugProfileId:prod.id},saved,{readProfiles})).selected.flavor,'prod');
  assert.equal((await debugProfiles({...settings,debugProfileId:prod.id},saved,{readProfiles:async()=>({profiles:[]})})).selected,null);
  assert.equal((await debugProfiles({...settings,debugProfileId:'saved:abc'},[],{readProfiles})).selected,null);
});
test('Run profile choice is remembered separately for workspaces',()=>{
  const settings={workspace:'/a',targetIds:['phone'],debugProfileId:'ide:dev'};
  const spaces=new WorkspaceSpaces([],settings),id=spaces.create({name:'Other',type:'flutter'});
  const other=spaces.activate(id,settings);assert.equal(other.debugProfileId,'workspace');
  const returned=spaces.activate('legacy',{...other,debugProfileId:'ide:prod'});
  assert.equal(returned.debugProfileId,'ide:dev');assert.deepEqual(returned.targetIds,['phone']);
});
test('IDE Run profiles require a capable bridge before launch; an older bridge cannot silently use dashboard defaults',()=>{
  const broker=new DebugLaunches(),plan={workspace:'/project',status:'ready',ideProfile:{name:'dev'}};
  broker.exchange('ide',['/project']);assert.throws(()=>broker.start(plan),/1.8.0/);
  broker.exchange('ide',['/project'],[],['ide-profiles']);assert.equal(broker.start(plan).status,'queued');
});
