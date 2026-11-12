import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createCloud} from '../../apps/cloud/src/index.js';
import {defaultContent} from '../../apps/cloud/src/accounts.js';
test('focus audio requires content write and CSRF, persists files, serves byte ranges, and removes safely',async t=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'snapkit-focus-audio-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const users={},sessions={};
 for(const role of ['admin','editor','viewer','moderator']){users[role]={id:role,email:role+'@example.com',name:role,adminRole:role};sessions[createHash('sha256').update(role).digest('hex')]={userId:role,expires:Date.now()+3600000};}
 await writeFile(path.join(directory,'accounts.json'),JSON.stringify({users,sessions,content:defaultContent(),audit:[]}));
 const env={SNAPKIT_CLOUD_DATA:directory,SNAPKIT_PUBLIC_URL:'https://snapkit.example.com'};
 const app=createCloud({env}),server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>server.close());
 const base='http://127.0.0.1:'+server.address().port;
 const request=(route,role,body,csrf=true)=>fetch(base+route,{method:body?'POST':'GET',headers:{...(role?{Cookie:'snapkit_session='+role}:{}),'Content-Type':'application/json',...(csrf?{Origin:env.SNAPKIT_PUBLIC_URL,'X-Snapkit-Request':'1'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const wav=Buffer.alloc(16044);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(16000,40);
 const body={title:'Gentle rain',data:wav.toString('base64')},route='/v1/admin/focus-audio/rain';
 assert.equal((await request(route,null,body)).status,401);
 for(const role of ['viewer','moderator'])assert.equal((await request(route,role,body)).status,403);
 assert.equal((await request(route,'admin',body,false)).status,403);
 assert.equal((await request(route,'admin',{title:'bad',data:Buffer.from('<html>not audio'.repeat(10)).toString('base64')})).status,400);
 assert.equal((await request(route,'admin',{title:'bad',data:Buffer.alloc(2*1024*1024+1).toString('base64')})).status,400);
 assert.equal((await request(route,'editor',body)).status,200);
 const listing=await (await request('/v1/focus/audio')).json();assert.equal(listing.tracks.rain.title,'Gentle rain');
 const media=await fetch(base+listing.tracks.rain.url,{headers:{Range:'bytes=0-43'}});assert.equal(media.status,206);assert.equal(media.headers.get('content-type'),'audio/wav');assert.equal((await media.arrayBuffer()).byteLength,44);
 // A new app instance reads the existing catalog rather than starting empty.
 const second=createCloud({env}).listen(0,'127.0.0.1');await new Promise(resolve=>second.once('listening',resolve));t.after(()=>second.close());
 assert.equal((await (await fetch('http://127.0.0.1:'+second.address().port+'/v1/focus/audio')).json()).tracks.rain.title,'Gentle rain');
 assert.equal((await request('/v1/admin/focus-audio/rain/remove','viewer',{})).status,403);
 assert.equal((await request('/v1/admin/focus-audio/rain/remove','admin',{})).status,200);
 assert.deepEqual(await (await request('/v1/focus/audio')).json(),{tracks:{}});
 assert.equal((await fetch(base+listing.tracks.rain.url)).status,404);
});
