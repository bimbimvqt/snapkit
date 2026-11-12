import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
const {installLifecycle,stopAgent}=createRequire(import.meta.url)('../../apps/desktop/src/lifecycle.cjs');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(options={}){
 const app=new EventEmitter();const calls={cleanup:0,show:0,relaunch:0,exit:0};
 app.quit=()=>{let prevented=false;app.emit('before-quit',{preventDefault(){prevented=true;}});if(!prevented)calls.exit++;};app.relaunch=()=>calls.relaunch++;
 const controller=installLifecycle({app,showMain(){calls.show++;},confirmQuit:async()=>true,cleanup:async()=>{calls.cleanup++;},...options});
 return {app,calls,controller};
}
test('ordinary quit cleans once and does not reopen; ordinary second launch focuses the window',async()=>{
 const {app,calls,controller}=fixture();app.emit('second-instance');assert.equal(calls.show,1);app.quit();app.quit();await tick();assert.equal(calls.cleanup,1);assert.equal(calls.exit,1);assert.equal(calls.relaunch,0);assert.equal(controller.exiting,true);
});
test('a macOS reopen arriving during shutdown is queued until cleanup completes',async()=>{
 let finish;const {app,calls}=fixture({cleanup:()=>new Promise(resolve=>{finish=resolve;})});app.quit();await tick();app.emit('second-instance');app.emit('activate');assert.equal(calls.relaunch,0);assert.equal(calls.exit,0);finish();await tick();assert.equal(calls.relaunch,1);assert.equal(calls.exit,1);
});
test('canceling quit clears a pending restart and leaves the app running',async()=>{
 let decide;const {app,calls,controller}=fixture({confirmQuit:()=>new Promise(resolve=>{decide=resolve;})});controller.restart();app.emit('second-instance');decide(false);await tick();assert.equal(calls.cleanup,0);assert.equal(calls.exit,0);assert.equal(calls.relaunch,0);app.quit();decide(true);await tick();assert.equal(calls.exit,1);assert.equal(calls.relaunch,0);
});
test('explicit restart relaunches only after cleanup and shutdown still finishes on cleanup failure',async()=>{
 let cleaned=false;const {app,calls,controller}=fixture({cleanup:async()=>{cleaned=true;throw Error('fixture cleanup error');}});app.relaunch=()=>{assert.equal(cleaned,true);calls.relaunch++;};controller.restart();await tick();assert.equal(calls.relaunch,1);assert.equal(calls.exit,1);
});
test('agent shutdown observes exit, handles an exited child and falls back on a lost IPC channel',async()=>{
 await stopAgent(null);await stopAgent({pid:undefined});
 const child=new EventEmitter();child.pid=42;let sent=0,killed=0;child.postMessage=message=>{assert.equal(message.type,'shutdown');sent++;};child.kill=()=>{killed++;};const stopping=stopAgent(child);assert.equal(sent,1);child.emit('exit',0);await stopping;assert.equal(killed,0);assert.equal(child.listenerCount('exit'),0);
 child.postMessage=()=>{throw Error('closed channel');};await stopAgent(child);assert.equal(killed,1);
 child.postMessage=()=>{};await stopAgent(child,{timeout:10});assert.equal(killed,2);assert.equal(child.listenerCount('exit'),0);
});

test('showing the active-task confirmation does not turn an ordinary quit into a restart',async()=>{
 let decide;const {app,calls}=fixture({confirmQuit:()=>new Promise(resolve=>{decide=resolve;})});app.quit();app.emit('activate');decide(true);await tick();assert.equal(calls.exit,1);assert.equal(calls.relaunch,0);
});
