import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
const {installKit}=createRequire(import.meta.url)('../../apps/desktop/src/kit/kit.cjs');
function setup(t,language='vi'){
 t.mock.timers.enable({apis:['Date','setTimeout'],now:10000});
 const shown=[],navigation=[],handlers=new Map();
 class Notification extends EventEmitter{
  static isSupported(){return true;}
  constructor(options){super();this.options=options;}
  show(){shown.push(this);}
 }
 const window={isDestroyed:()=>false,isMinimized:()=>true,restore(){navigation.push('restore');},show(){navigation.push('show');},focus(){navigation.push('focus');},webContents:{send:(...args)=>navigation.push(args)}};
 const kit=installKit({app:new EventEmitter(),ipcMain:{handle:(name,handler)=>handlers.set(name,handler)},globalShortcut:{register:()=>true},Notification,fromApp:()=>true,getWindow:()=>window,language:()=>language});
 return {kit,shown,navigation};
}
test('focus expiry announces the duration once and opens Focus Kit on click',t=>{
 const {kit,shown,navigation}=setup(t);
 kit.setFocusDeadline(Date.now()+300000,300);t.mock.timers.tick(300000);
 assert.equal(shown.length,1);assert.equal(shown[0].options.title,'Đã hoàn thành phiên tập trung');
 assert.match(shown[0].options.body,/5 phút/);assert.equal(shown[0].options.silent,false);
 kit.setFocusDeadline(null,300);assert.equal(shown.length,1);
 shown[0].emit('click');assert.deepEqual(navigation,['restore','show','focus',['snapkit:mini-navigate',{page:'kit',tool:'focus'}]]);
});
test('settling before the timeout runs still sends one completion notification',t=>{
 const {kit,shown}=setup(t,'en');kit.setFocusDeadline(Date.now()+300000,300);
 t.mock.timers.setTime(Date.now()+300001);kit.setFocusDeadline(null,300);t.mock.timers.tick(1);
 assert.equal(shown.length,1);assert.equal(shown[0].options.title,'Focus session complete');assert.match(shown[0].options.body,/5 minutes/);
});
test('pausing or resetting before expiry cancels the notification',t=>{
 const {kit,shown}=setup(t);kit.setFocusDeadline(Date.now()+300000,300);
 t.mock.timers.tick(1000);kit.setFocusDeadline(null,300);t.mock.timers.tick(300000);assert.equal(shown.length,0);
});
