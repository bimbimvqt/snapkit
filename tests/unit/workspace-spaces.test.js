import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WorkspaceSpaces} from '../../apps/agent/src/modules/workspace/spaces.js';

test('workspaces preserve independent project configurations and migrate the current setup', () => {
  let settings = {workspace:'/work/old', framework:'flutter', targetIds:['ios'], flavor:'staging', target:'lib/staging.dart', defineFile:'env.json', selectedSetId:'phones', ideEnabled:false};
  let spaces = new WorkspaceSpaces([], settings);
  assert.equal(spaces.list(settings).workspaces[0].name,'old');
  const rn=spaces.create({name:'Native team',type:'react-native'});
  settings=spaces.activate(rn,settings);
  assert.equal(settings.workspace,''); assert.deepEqual(settings.targetIds,[]); assert.equal(settings.ideEnabled,true);
  settings={...settings,workspace:'/work/native',targetIds:['android']};
  const backend=spaces.create({name:'Services',type:'backend'});
  settings=spaces.activate(backend,settings);
  assert.equal(settings.ideEnabled,false); assert.deepEqual(settings.targetIds,[]);
  spaces=new WorkspaceSpaces(JSON.parse(JSON.stringify(spaces.entries)),settings);
  settings=spaces.activate('legacy',settings);
  assert.equal(settings.flavor,'staging'); assert.equal(settings.target,'lib/staging.dart'); assert.equal(settings.defineFile,'env.json');
  assert.equal(settings.selectedSetId,'phones'); assert.equal(settings.ideEnabled,false); assert.deepEqual(settings.targetIds,['ios']);
  settings=spaces.activate(rn,settings);
  assert.equal(settings.workspace,'/work/native'); assert.deepEqual(settings.targetIds,['android']);
  assert.equal(settings.flavor,'');
});

test('workspace validation and recovery preserve the existing setup', () => {
  const settings={spaceId:'recovered',spaceName:'My Native app',framework:'react-native',workspace:'/work/native',targetIds:['phone']};
  const spaces=new WorkspaceSpaces([null,{id:'bad'}],settings);
  assert.equal(spaces.get('recovered').name,'My Native app');
  for(const input of [{name:'',type:'flutter'},{name:'x',type:'react'},{name:'x\ny',type:'backend'}, {name:'x'.repeat(81),type:'flutter'}]) {
    assert.throws(()=>spaces.create(input));
  }
  spaces.create({name:' Team ',type:'flutter'});
  assert.throws(()=>spaces.create({name:'team',type:'backend'}),/already exists/);
  assert.throws(()=>spaces.activate('missing',settings),/not found/);
  assert.deepEqual(spaces.get('recovered').setup.targetIds,['phone']);
});
