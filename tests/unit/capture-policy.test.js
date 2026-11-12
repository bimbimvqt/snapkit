import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {supportsSystemPicker,installCapturePermissions}=createRequire(import.meta.url)('../../apps/desktop/src/kit/capture-policy.cjs');
test('system picker is available only on macOS 15 and newer',()=>{
 for(const release of ['24.0.0','25.3.0'])assert.equal(supportsSystemPicker('darwin',release),true);
 for(const [platform,release] of [['darwin','23.6.0'],['darwin','unknown'],['win32','25.0.0'],['linux','25.0.0']])assert.equal(supportsSystemPicker(platform,release),false);
});
test('display capture permission is scoped to the app main frame and cannot grant microphone or camera access',()=>{
 const handlers={},session={setPermissionRequestHandler:fn=>handlers.request=fn,setPermissionCheckHandler:fn=>handlers.check=fn,setDisplayMediaRequestHandler:(fn,options)=>{handlers.display=fn;handlers.options=options;}};
 const webContents={},origin='http://127.0.0.1:4310';installCapturePermissions({session,webContents,origin,systemPicker:true});
 assert.deepEqual(handlers.options,{useSystemPicker:true});let fallback;handlers.display({},result=>{fallback=result;});assert.deepEqual(fallback,{});
 for(const [contents,permission,url,isMainFrame,expected] of [[webContents,'display-capture',origin+'/',true,true],[{},'display-capture',origin,true,false],[webContents,'media',origin,true,false],[webContents,'display-capture','https://example.com',true,false],[webContents,'display-capture',origin,false,false],[webContents,'display-capture','invalid',true,false]]){
  let granted;handlers.request(contents,permission,result=>{granted=result;},{requestingUrl:url,isMainFrame});assert.equal(granted,expected);assert.equal(handlers.check(contents,permission,url,{isMainFrame}),expected);
 }
 installCapturePermissions({session,webContents,origin,systemPicker:false});assert.equal(handlers.check(webContents,'display-capture',origin,{isMainFrame:true}),false);
});
