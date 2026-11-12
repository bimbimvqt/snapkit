import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {initialFocus,restoreFocus,changeFocus,settleFocus,gardenProgress} from '../../packages/domain/focus-garden.js';
test('pausing, changing space and resuming preserves the full session reward and credits once',()=>{
 let state=changeFocus(initialFocus(),{type:'toggle'},1000);
 state=changeFocus(state,{type:'toggle'},61000);
 assert.equal(state.timer.remaining,1440);
 state=changeFocus(state,{type:'space',value:'rain'},100000);
 state=changeFocus(state,{type:'toggle'},200000);
 assert.equal(settleFocus(state,201000).completed,0);
 state=settleFocus(state,1640000);
 assert.equal(state.completed,1);assert.equal(state.totalSeconds,1500);
 assert.equal(settleFocus(state,99999999),state);
 assert.equal(state.space,'rain');
});
test('resetting abandons the unfinished session and changing duration starts fresh',()=>{
 let state=changeFocus(initialFocus(),{type:'toggle'},1000);
 assert.throws(()=>changeFocus(state,{type:'duration',seconds:300},1001));
 state=changeFocus(state,{type:'reset',seconds:300},100000);
 assert.equal(state.completed,0);assert.equal(state.totalSeconds,0);
 state=changeFocus(state,{type:'toggle'},200000);
 state=settleFocus(state,500000);
 assert.equal(state.totalSeconds,300);
 assert.throws(()=>changeFocus(state,{type:'space',value:'invalid'}));
});
test('garden stages and trees use completed minutes, with no day-based decay',()=>{
 for(const [minutes,stage,trees] of [[0,0,0],[5,1,0],[25,2,0],[60,3,0],[100,0,1],[125,2,1]]){
  const state={...initialFocus(),totalSeconds:minutes*60};
  assert.deepEqual(gardenProgress(state),{minutes,trees,growth:minutes%100,stage,remaining:100-minutes%100});
  assert.equal(settleFocus(state,Date.now()+365*86400000),state);
 }
 assert.deepEqual(restoreFocus({space:'unknown',completed:-1,totalSeconds:NaN,timer:{remaining:-1,deadline:null}}),initialFocus());
});
test('native garden survives restarts and completes while both renderer windows are absent',async()=>{
 const {createFocusStore}=createRequire(import.meta.url)('../../apps/desktop/src/kit/focus-store.cjs');
 const directory=mkdtempSync(path.join(tmpdir(),'snapkit-garden-'));
 const changes=[],options={app:{getPath:()=>directory},setDeadline:()=>{},onChange:value=>changes.push(value)};
 let store;
 try{
  store=await createFocusStore(options);
  store.action({type:'theme:save',theme:{id:'custom-00000000-0000-4000-8000-000000000001',name:'Persistent studio',scene:'gradient',accent:'#ff7799',background:'#552233'}});
  store.action({type:'space',value:'night'});store.action({type:'plant',value:'pine'});
  store.action({type:'toggle'});store.action({type:'toggle'});
  store.legacyTimer({remaining:1500,deadline:Date.now()-10});
  assert.equal(store.state().completed,1);store.dispose();
  store=await createFocusStore(options);
  assert.equal(store.state().completed,1);assert.equal(store.state().totalSeconds,1500);
  assert.equal(store.state().space,'night');assert.equal(store.state().plant,'pine');
  assert.equal(store.state().themes.at(-1).name,'Persistent studio');
  store.action({type:'space',value:'custom-00000000-0000-4000-8000-000000000001'});
  assert.equal(store.state().space,'custom-00000000-0000-4000-8000-000000000001');
  assert.equal(store.state().timer.deadline,null);
 }finally{store?.dispose();rmSync(directory,{recursive:true,force:true});}
});
