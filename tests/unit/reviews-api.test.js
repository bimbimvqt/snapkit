import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';

test('authenticated local review endpoint validates input and proxies to the cloud with no account token attached',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'snapkit-review-api-'));
  const delivered=[];
  const cloud=createServer(async(req,res)=>{
    res.setHeader('Content-Type','application/json');
    if(req.url==='/v1/feedback') {
      let body='';for await(const chunk of req) body+=chunk;
      delivered.push({headers:req.headers,input:JSON.parse(body)});res.end(JSON.stringify({received:true,id:'receipt'}));
    } else res.end(JSON.stringify({user:{id:'fixture'}}));
  });
  const probe=createServer();let agent;
  try {
    await new Promise(r=>cloud.listen(0,'127.0.0.1',r));await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
    await mkdir(path.join(root,'state'),{recursive:true});await writeFile(path.join(root,'state/account-session.json'),JSON.stringify({token:'fixture-account-token'}));
    agent=spawn(process.execPath,['apps/agent/src/main.js'],{env:{...process.env,PORT:String(port),SNAPKIT_DATA_ROOT:root,SNAPKIT_ACCOUNT_SERVER:`http://127.0.0.1:${cloud.address().port}`,SNAPKIT_ADB:process.execPath,SNAPKIT_EMULATOR:process.execPath,SNAPKIT_XCRUN:process.execPath},stdio:['ignore','pipe','pipe']});
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),10000);agent.once('error',reject);agent.once('exit',code=>{clearTimeout(timer);reject(Error('Agent exited '+code));});agent.stdout.on('data',data=>{if(data.toString().includes('http://')){clearTimeout(timer);resolve();}});});
    const base=`http://127.0.0.1:${port}`,token=(await fetch(base+'/api/state').then(r=>r.json())).token;
    const post=(input,key=token)=>fetch(base+'/api/reviews',{method:'POST',headers:{'Content-Type':'application/json','X-Snapkit-Token':key},body:JSON.stringify(input)});
    const input={rating:2,message:'Setup could be faster.',name:'Dev',publishConsent:false,submissionId:randomUUID(),logs:['private'],email:'account@example.com'};
    assert.equal((await post(input,'invalid')).status,403);
    assert.equal((await post({...input,rating:6})).status,400);assert.equal(delivered.length,0);
    const result=await post(input);assert.equal(result.status,201);assert.deepEqual(await result.json(),{received:true,id:'receipt'});
    assert.equal(delivered.length,1);assert.equal(delivered[0].headers.authorization,undefined);assert.equal(delivered[0].headers['x-snapkit-request'],'1');
    assert.equal(delivered[0].input.email,undefined);assert.equal(delivered[0].input.logs,undefined);assert.equal(delivered[0].input.rating,2);assert.equal(delivered[0].input.type,'review');
  } finally {
    if(agent&&agent.exitCode===null){const ended=new Promise(r=>agent.once('exit',r));agent.kill();await ended;}
    await new Promise(r=>cloud.close(r));await rm(root,{recursive:true,force:true});
  }
});
