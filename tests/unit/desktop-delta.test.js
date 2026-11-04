import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, readFile, rm, stat, readdir } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {scan,validateMap,planBlocks}=require('../../apps/desktop/src/updates/blocks.cjs');
const {smartDownload,seedBaseline,packageName}=require('../../apps/desktop/src/updates/delta.cjs');
const {selectRelease}=require('../../apps/desktop/src/updates/policy.cjs');
const {DesktopUpdater}=require('../../apps/desktop/src/updates/updater.cjs');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function data(size){const bytes=Buffer.alloc(size);let seed=0x7127ab;for(let i=0;i<size;i++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;bytes[i]=seed&255;}return bytes;}
async function fixture(t){
  const root=await mkdtemp(path.join(os.tmpdir(),'snapkit-delta-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const version='0.2.0-beta.27',platform='win32',arch='x64',cache=path.join(root,'cache');
  const old=data(3*1024*1024),target=Buffer.concat([old.subarray(0,80000),Buffer.from('changed release content'),old.subarray(80000)]);
  const source=path.join(root,'old.exe'),current={version,name:packageName(version,platform,arch),size:old.length,sha256:hash(old)};
  await writeFile(source,old);await seedBaseline({cache,file:source,asset:current,version,platform,arch});
  const full=path.join(root,'target.exe');await writeFile(full,target);const map=await scan(full),raw=Buffer.from(JSON.stringify(map));
  const asset={version:'0.2.0-beta.28',name:'Snapkit-0.2.0-beta.28-win-x64.exe',size:target.length,sha256:hash(target),blockmap:{size:raw.length,sha256:hash(raw)}};
  let ranges=0,transferred=0,fulls=0;
  const adapters={cache,version,platform,arch,
    mapDownload:async(_asset,file,signal)=>{signal.throwIfAborted();await writeFile(file,raw);},
    rangeDownload:async(_asset,start,size,signal,progress)=>{signal.throwIfAborted();ranges++;transferred+=size;progress(size);return target.subarray(start,start+size);},
    fullDownload:async(_asset,file,signal,progress)=>{signal.throwIfAborted();fulls++;await writeFile(file,target);progress(target.length);}};
  return {root,cache,old,target,map,asset,current,source,adapters,counts:()=>({ranges,transferred,fulls})};
}
test('content-defined maps reuse unchanged data after insertions and reconstruct a byte-identical update',async t=>{
  const f=await fixture(t),file=path.join(f.root,'download.exe'),progress=[];
  const info=await smartDownload(f.asset,file,new AbortController().signal,(bytes,detail)=>progress.push({bytes,...detail}),f.adapters);
  assert.equal(info.mode,'delta');assert.ok(info.size<f.target.length*.2);assert.ok(info.reused>f.target.length*.8);
  assert.deepEqual(await readFile(file),f.target);assert.equal(f.counts().fulls,0);assert.equal(f.counts().transferred,info.size);
  assert.equal(progress.at(-1).bytes,info.size);assert.equal(await stat(file+'.map').catch(()=>null),null);
});
test('corrupt cache, invalid maps, ignored ranges and corrupt range data fall back to a complete verified download',async t=>{
  for(const issue of ['cache','map','range','corrupt-range','no-savings']){
    await t.test(issue,async t=>{
      const f=await fixture(t),file=path.join(f.root,'download.exe');
      if(issue==='cache')await writeFile(path.join(f.cache,'baseline/package.bin'),'corrupt');
      if(issue==='map')f.adapters.mapDownload=async(_a,file)=>writeFile(file,JSON.stringify({...f.map,sha256:'0'.repeat(64)}));
      if(issue==='range')f.adapters.rangeDownload=async()=>{throw Error('server ignores range');};
      if(issue==='corrupt-range')f.adapters.rangeDownload=async(_a,_start,size)=>Buffer.alloc(size);
      if(issue==='no-savings'){const changed=Buffer.alloc(f.target.length,3),full=path.join(f.root,'all-new');await writeFile(full,changed);const map=await scan(full);f.adapters.mapDownload=async(_a,file)=>writeFile(file,JSON.stringify(map));f.asset.sha256=hash(changed);f.adapters.fullDownload=async(_a,file,_s,progress)=>{await writeFile(file,changed);progress(changed.length);};}
      const info=await smartDownload(f.asset,file,new AbortController().signal,()=>{},f.adapters);
      assert.equal(info.mode,'full');assert.equal(hash(await readFile(file)),f.asset.sha256);
      if(issue!=='no-savings')assert.equal(f.counts().fulls,1);
    });
  }
});
test('cancellation never triggers full fallback; no matching baseline or missing metadata uses one full download',async t=>{
  const f=await fixture(t),controller=new AbortController();
  f.adapters.rangeDownload=async()=>{controller.abort();throw Error('cancelled');};
  await assert.rejects(smartDownload(f.asset,path.join(f.root,'cancel.exe'),controller.signal,()=>{},f.adapters));assert.equal(f.counts().fulls,0);
  const wrong=await smartDownload(f.asset,path.join(f.root,'wrong.exe'),new AbortController().signal,()=>{},{...f.adapters,version:'0.2.0-beta.1'});assert.equal(wrong.mode,'full');
  const noMap=await smartDownload({...f.asset,blockmap:undefined},path.join(f.root,'legacy.exe'),new AbortController().signal,()=>{},f.adapters);assert.equal(noMap.mode,'full');assert.equal(f.counts().fulls,2);
});
test('delta map policy rejects mismatched target data, malformed blocks and untrusted metadata assets',async()=>{
  const asset={size:1,sha256:'a'.repeat(64)},valid={algorithm:'snapkit-gear32-v1',...asset,blocks:[{size:1,sha256:'b'.repeat(64)}]};
  assert.equal(validateMap(valid,asset),valid);
  for(const map of [{...valid,algorithm:'other'},{...valid,size:2},{...valid,blocks:[{size:-1,sha256:'a'}]},{...valid,blocks:[]},{...valid,blocks:[{size:2,sha256:'b'.repeat(64)}]}])assert.throws(()=>validateMap(map,asset));
  const name='Snapkit-0.2.0-beta.28-win-x64.exe',url='https://github.com/bimbimvqt/snapkit/releases/download/v0.2.0-beta.28/'+name;
  const release={tag_name:'v0.2.0-beta.28',assets:[{name,size:1,digest:'sha256:'+'a'.repeat(64),browser_download_url:url},{name:name+'.blockmap.json',size:100,digest:'sha256:'+'b'.repeat(64),browser_download_url:url+'.blockmap.json'}]};
  assert.ok(selectRelease([release],'0.2.0-beta.27','win32','x64').blockmap);
  release.assets[1].browser_download_url='https://evil.example/map';assert.equal(selectRelease([release],'0.2.0-beta.27','win32','x64').blockmap,undefined);
});
test('baseline promotion bootstraps old update journals and only retains the successfully installed matching version',async t=>{
  const f=await fixture(t),version='0.2.0-beta.28',token=randomUUID();
  const updater=new DesktopUpdater({version,platform:'win32',arch:'x64',packaged:true,userData:f.root,releases:async()=>[{tag_name:'v'+version,assets:[{name:f.asset.name,size:f.asset.size,digest:'sha256:'+f.asset.sha256,browser_download_url:'https://github.com/bimbimvqt/snapkit/releases/download/v'+version+'/'+f.asset.name}]}]});
  const work=path.join(updater.cache,token);await mkdir(work,{recursive:true});await writeFile(path.join(work,f.asset.name),f.target);
  await writeFile(path.join(updater.cache,'download.json'),JSON.stringify({token}));await updater.seedCurrent();
  const metadata=JSON.parse(await readFile(path.join(updater.cache,'baseline/metadata.json')));assert.equal(metadata.version,version);assert.equal(metadata.sha256,f.asset.sha256);
  await updater.cleanup();assert.deepEqual(await readFile(path.join(updater.cache,'baseline/package.bin')),f.target);
  assert.equal(await stat(work).catch(()=>null),null);assert.ok(!(await readdir(updater.cache)).includes('baseline-next'));
  assert.equal(await seedBaseline({cache:updater.cache,file:f.source,asset:f.current,version,platform:'win32',arch:'x64'}),false);
  assert.equal(JSON.parse(await readFile(path.join(updater.cache,'baseline/metadata.json'))).version,version);
});
