import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {WebSocket, WebSocketServer} from 'ws';
const require = createRequire(import.meta.url);
const {createInspectorBridge, inspectorURL} = require('../../apps/ide-extension/react-native-transport.cjs');
const {execute} = require('../../apps/ide-extension/react-native-runtime.cjs');

test('inspector transport rejects nonlocal URLs, wrong ports and other endpoints', () => {
  for (const url of ['ws://example.com:8081/inspector/debug','ws://127.0.0.1:9000/inspector/debug','ws://127.0.0.1:8081/other','ws://user@127.0.0.1:8081/inspector/debug','wss://127.0.0.1:8081/inspector/debug']) assert.throws(()=>inspectorURL(url,8081));
  assert.equal(inspectorURL('ws://127.0.0.1:8081/inspector/debug?device=a&page=1',8081).hostname,'127.0.0.1');
});
test('bridge sends Metro Origin, preserves text protocol, and rejects foreign browser origins', async () => {
  const upstream = new WebSocketServer({host:'127.0.0.1',port:0});
  await new Promise(r=>upstream.once('listening',r));
  const port=upstream.address().port;
  let origin;
  upstream.on('connection',(socket,req)=>{origin=req.headers.origin;socket.on('message',(data,binary)=>{assert.equal(binary,false);socket.send(data.toString());});});
  const bridge=await createInspectorBridge({webSocketDebuggerUrl:`ws://127.0.0.1:${port}/inspector/debug?device=one&page=1`},port);
  let client;
  try {
    const denied=await fetch(`http://127.0.0.1:${bridge.port}/json/list`,{headers:{Origin:'https://example.com'}});assert.equal(denied.status,403);
    const http=require('node:http');
    const discovery=await new Promise((resolve,reject)=>{http.get({hostname:'127.0.0.1',port:bridge.port,path:'/json/list',headers:{Host:'localhost'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));}).on('error',reject);});assert.equal(discovery,200);
    const [target]=await fetch(`http://127.0.0.1:${bridge.port}/json/list`).then(r=>r.json());
    client=new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{client.once('error',reject);client.once('open',()=>client.send('{"id":1,"method":"Runtime.enable"}'));client.once('message',data=>{assert.equal(JSON.parse(data).id,1);resolve();});});
    assert.equal(origin,`http://localhost:${port}`);
  } finally {client?.terminate();bridge.dispose();await new Promise(r=>upstream.close(r));}
});
test('cancelling a native build stops its owned process', async () => {
  const abort=new AbortController();
  const child=execute(process.execPath,['-e','setInterval(()=>{},1000)'],{signal:abort.signal});
  abort.abort();await assert.rejects(child.promise,/cancelled/);
});

const {createNativeDebug} = require('../../apps/ide-extension/react-native-debug.cjs');
const {realpath} = require('node:fs/promises');
test('native launch fans out once and stopping one device preserves the peer bridge', async () => {
  const root=await realpath('.'), disposed=[], launched=[], starts=[], errors=[];
  const folder={uri:{fsPath:root}};
  const configs=['ios','android'].map((platform,i)=>({name:platform,type:'reactnative',request:'launch',cwd:root,platform,deviceId:'device'+i}));
  const vscode={workspace:{isTrusted:true,getConfiguration:()=>({get:(_key,fallback)=>fallback})},ProgressLocation:{Notification:1},window:{showErrorMessage:s=>errors.push(s),withProgress:(_options,fn)=>fn({report(){}},{onCancellationRequested:()=>({dispose(){}})})},debug:{startDebugging:async(_folder,config)=>{starts.push(config);return true;}}};
  const native=createNativeDebug(vscode,{readPlan:async()=>({protocol:1,framework:'react-native',workspace:root,status:'ready',configurations:configs}),resolveCli:async()=>'/cli',runtime:{ensureMetro:async()=>{},launch:async(_root,device)=>{launched.push(device.deviceId);return device;},dispose(){}},makeBridge:async target=>({port:12345,dispose:()=>disposed.push(target.deviceId)})});
  try {
    const config=await native.provider.resolveDebugConfiguration(folder,{});
    assert.equal(config.type,'pwa-node');assert.equal(config.deviceId,'device0');assert.equal(launched.length,2);
    const first={id:'first',configuration:config};await native.started(first);assert.equal(starts.length,1);
    const second={id:'second',configuration:starts[0]};await native.started(second);assert.equal(starts.length,1);
    native.terminated(first);assert.deepEqual(disposed,['device0']);
    assert.equal(await native.provider.resolveDebugConfiguration(folder,{}),undefined);assert.match(errors[0],/already debugging/);
    native.terminated(second);assert.deepEqual(disposed,['device0','device1']);
  } finally {native.dispose();}
});
test('a failed second native launch cleans prepared transports and never starts partial debug', async()=>{
  const root=await realpath('.');let disposed=0;
  const vscode={workspace:{isTrusted:true,getConfiguration:()=>({get:(_key,fallback)=>fallback})},ProgressLocation:{Notification:1},window:{showErrorMessage(){},withProgress:(_o,fn)=>fn({report(){}},{onCancellationRequested:()=>({dispose(){}})})}};
  const native=createNativeDebug(vscode,{resolveCli:async()=>'/cli',readPlan:async()=>({protocol:1,framework:'react-native',workspace:root,status:'ready',configurations:['one','two'].map(deviceId=>({deviceId,name:deviceId,platform:'android',type:'reactnative',request:'launch',cwd:root}))}),runtime:{ensureMetro:async()=>{},launch:async(_r,c)=>{if(c.deviceId==='two')throw Error('Build failed');return c;},dispose(){}},makeBridge:async()=>({port:12345,dispose:()=>disposed++})});
  assert.equal(await native.provider.resolveDebugConfiguration({uri:{fsPath:root}},{}),undefined);assert.equal(disposed,1);native.dispose();
});

test('Metro belonging to another project is never reused or stopped', async()=>{
  const http=require('node:http');
  const server=http.createServer((_req,res)=>{res.setHeader('X-React-Native-Project-Root',require('node:os').tmpdir());res.end('packager-status:running');});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let spawned=0;
  const runtime=require('../../apps/ide-extension/react-native-runtime.cjs').createRuntime({run:()=>{spawned++;throw Error('Should not spawn');}});
  try {await assert.rejects(runtime.ensureMetro(await realpath('.'),server.address().port,'/cli',process.execPath,new AbortController().signal),/different Metro project/);assert.equal(spawned,0);}
  finally {runtime.dispose();await new Promise(r=>server.close(r));}
});
