import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {Readable} from 'node:stream';
import {EventEmitter} from 'node:events';
import {createCloud} from '../../apps/cloud/src/index.js';
const require=createRequire(import.meta.url),https=require('node:https');
const network=require('../../apps/desktop/src/updates/network.cjs');
const {selectRelease}=require('../../apps/desktop/src/updates/policy.cjs');
const {version}=JSON.parse(await readFile(new URL('../../package.json',import.meta.url),'utf8'));
const asset=extension=>({name:`Snapkit-${version}-mac-arm64.${extension}`,size:100,digest:'sha256:'+'a'.repeat(64),browser_download_url:`https://github.com/bimbimvqt/snapkit/releases/download/v${version}/Snapkit-${version}-mac-arm64.${extension}`});
const release={tag_name:'v'+version,published_at:'2026-11-06T00:00:00Z',prerelease:true,assets:[asset('zip'),asset('dmg')],internal:'not needed by updater'};

test('desktop feed coalesces concurrent checks, shares the website cache and preserves asset integrity metadata',async()=>{
  let calls=0;
  const app=createCloud({env:{},fetcher:async()=>{calls++;await new Promise(r=>setTimeout(r,20));return Response.json([release,{...release,tag_name:'draft',draft:true}]);}});
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
  try {
    const responses=await Promise.all(Array.from({length:10},()=>fetch(base+'/v1/releases/desktop').then(r=>r.json())));
    assert.equal(calls,1);assert.equal(responses[0].length,1);assert.equal(responses[0][0].internal,undefined);
    const selected=selectRelease(responses[0],'0.0.0-beta.0','darwin','arm64');assert.equal(selected.version,version);assert.equal(selected.sha256,'a'.repeat(64));
    assert.equal((await fetch(base+'/v1/releases/latest?platform=darwin&arch=arm64').then(r=>r.json())).version,version);assert.equal(calls,1);
  } finally {await new Promise(r=>server.close(r));}
});
test('upstream rate limits return a retryable failure without reporting latest or hammering GitHub',async()=>{
  let calls=0;
  const server=createCloud({env:{},fetcher:async()=>{calls++;return Response.json({message:'rate limit'},{status:403});}}).listen(0,'127.0.0.1');
  await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
  try {for(let i=0;i<3;i++) assert.equal((await fetch(base+'/v1/releases/desktop')).status,503);assert.equal(calls,1);}
  finally {await new Promise(r=>server.close(r));}
});
test('desktop checks use Snapkit HTTPS, reject failures/redirects and keep existing digest checks',async()=>{
  const original=https.get;let code=200;
  https.get=(url,options,callback)=>{
    assert.equal(String(url),'https://snapkit.vn/v1/releases/desktop');assert.equal(options.headers.Authorization,undefined);
    const req=new EventEmitter();
    queueMicrotask(()=>{const response=Readable.from([Buffer.from(JSON.stringify([release]))]);response.statusCode=code;response.headers=code===302?{location:'https://evil.example/feed'}:{};callback(response);});
    return req;
  };
  try {
    const list=await network.releaseList(AbortSignal.timeout(2000));assert.equal(selectRelease(list,'0.0.0-beta.0','darwin','arm64').version,version);
    code=503;await assert.rejects(network.releaseList(),/Could not check/);
    code=302;await assert.rejects(network.releaseList(),/Unexpected update metadata redirect/);
    const tampered=structuredClone(list);delete tampered[0].assets[0].digest;assert.equal(selectRelease(tampered,'0.0.0-beta.0','darwin','arm64'),null);
  } finally {https.get=original;}
});
