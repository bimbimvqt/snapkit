import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const {debugSummary}=createRequire(import.meta.url)('../../apps/desktop/src/mini/data.cjs');
test('widget debug data keeps device and build status but excludes local tokens, paths and logs',()=>{const value=debugSummary({token:'secret-token',settings:{workspace:'/private/project'},devices:[{id:'device',name:'iPhone',platform:'ios',state:'online',secret:'private-device'}],debugSessions:[{deviceId:'device',name:'private-session'}]}, {active:{id:'build'},jobs:[{id:'build',workspace:'/private/project',log:'secret-log',plan:{format:'ipa',signing:'secret-key'},status:'building'}]});assert.equal(value.sessions,1);assert.deepEqual(value.devices,[{name:'iPhone',platform:'iOS',debugging:true}]);assert.deepEqual(value.build,{format:'IPA',status:'building',upload:false});const json=JSON.stringify(value);for(const secret of ['secret','/private','private-session','private-device','percent','token'])assert.equal(json.includes(secret),false);});
test('widget distinguishes unavailable release data from no active build and reports uploads honestly',()=>{assert.equal(debugSummary({devices:[]},null).releaseUnavailable,true);assert.equal(debugSummary({devices:[]},{jobs:[]}).build,null);const value=debugSummary({devices:[]},{jobs:[{plan:{format:'ipa'},status:'succeeded',uploadStatus:'uploading'}]});assert.equal(value.build.upload,true);assert.equal(debugSummary({authRequired:true},{}).unavailable,true);});

test('floating debug controls scope reload and stop to selected sessions and gate run on online Flutter targets',()=>{
 const {debugControls}=createRequire(import.meta.url)('../../apps/desktop/src/mini/data.cjs');
 const state={settings:{workspace:'/project',framework:'flutter',targetIds:['one'],flavor:'dev',target:'lib/main_dev.dart'},devices:[{id:'one',flutterId:'flutter-one',state:'online'}],debugSessions:[]};
 assert.equal(debugControls(state).canRun,true);assert.equal(debugControls(state).canControl,false);
 state.debugSessions=[{id:'s',deviceId:'other'}];assert.equal(debugControls(state).canRun,true);
 state.debugSessions=[{id:'s',deviceId:'flutter-one'}];assert.equal(debugControls(state).canRun,false);assert.equal(debugControls(state).canControl,true);
 state.debugSessions=[];assert.equal(debugControls(state,{status:'queued'}).canRun,false);
 state.devices[0].state='offline';assert.equal(debugControls(state).canRun,false);
 state.devices[0].state='online';state.authRequired=true;assert.equal(debugControls(state).canRun,false);
});
