import {test} from 'node:test';
import assert from 'node:assert/strict';
import {restoreSDKPreferences} from '../../apps/agent/src/modules/diagnostics/diagnostics.js';
test('explicit tools checks remember missing SDK paths and preserve existing choices on subsequent checks',async()=>{
 const preferences={flutterSDK:'/chosen/flutter',androidSDK:''};let scans=0,saves=0;
 const options={read:()=>preferences,discover:input=>{assert.equal(input.includeExternal,true);scans++;return {flutterSDK:'/external/flutter',androidSDK:'/external/android'};},save:async update=>{saves++;Object.assign(preferences,update);}};
 assert.equal(scans,0);assert.equal(await restoreSDKPreferences(options),true);assert.deepEqual(preferences,{flutterSDK:'/chosen/flutter',androidSDK:'/external/android'});
 assert.equal(await restoreSDKPreferences(options),false);assert.equal(scans,1);assert.equal(saves,1);
});
test('unavailable SDKs do not erase paths or write empty configuration',async()=>{
 const preferences={flutterSDK:'',androidSDK:'/chosen/android'};
 assert.equal(await restoreSDKPreferences({read:()=>preferences,discover:()=>({flutterSDK:'',androidSDK:''}),save:()=>{throw Error('Must not save');}}),false);
 assert.equal(preferences.androidSDK,'/chosen/android');
});
