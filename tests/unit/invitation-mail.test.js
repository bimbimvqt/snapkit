import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {createCloud} from '../../apps/cloud/src/index.js';
import {defaultContent} from '../../apps/cloud/src/accounts.js';
import {invitationMailer} from '../../apps/cloud/src/infrastructure/invitation-mail.js';

test('invitation email is persisted before sending, scoped, retryable, throttled, and never accepts membership by GET',async t=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'snapkit-invitation-mail-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 let clock=Date.now(),reject=false;const calls=[];t.mock.method(Date,'now',()=>clock);
 await writeFile(path.join(directory,'accounts.json'),JSON.stringify({users:Object.fromEntries(['owner','guest','other'].map(id=>[id,{id,name:id,email:id+'@example.com'}])),sessions:Object.fromEntries(['owner','guest','other'].map(id=>[createHash('sha256').update(id).digest('hex'),{userId:id,expires:clock+86400000}])),content:defaultContent(),audit:[]}));
 const env={SNAPKIT_CLOUD_DATA:directory,SNAPKIT_PUBLIC_URL:'https://snapkit.vn',RESEND_API_KEY:'private-mail-key',SNAPKIT_MAIL_FROM:'teams@snapkit.vn'};
 const fetcher=async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');const stored=JSON.parse(await readFile(path.join(directory,'teams.json'),'utf8'));assert.ok(stored.workspaces[0].invitations.some(i=>i.delivery.status==='sending'),'save before outbound request');calls.push({options,body:JSON.parse(options.body)});return reject?new Response('sensitive provider error',{status:500}):Response.json({id:'mail-id'});};
 const server=createCloud({env,fetcher}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
 const origin='http://127.0.0.1:'+server.address().port;
 const request=(user,route,body)=>fetch(origin+'/v1/teams'+route,{headers:{Authorization:'Bearer '+user,'Content-Type':'application/json'},...(body===undefined?{}:{method:'POST',body:JSON.stringify(body)})});
 const workspace=await(await request('owner','',{name:'Studio <script>alert(1)</script>'})).json(),base='/'+workspace.id;
 const input={email:'guest@example.com',role:'viewer',projectIds:null,environments:['development']};
 let result=await(await request('owner',base+'/invitations',input)).json(),invitation=result.invitations[0];
 assert.equal(invitation.delivery.status,'sent');assert.equal(calls.length,1);assert.deepEqual(calls[0].body.to,['guest@example.com']);assert.ok(calls[0].body.html.includes('Studio &lt;script&gt;'));assert.ok(!calls[0].body.html.includes('<script>'));assert.ok(calls[0].body.text.includes('https://snapkit.vn/join/#'+invitation.id));assert.ok(!JSON.stringify(result).includes('private-mail-key'));assert.ok(!JSON.stringify(result).includes('team-invitation-'));
 assert.equal((await request('owner',base+'/invitations/'+invitation.id+'/resend',{})).status,429);
 assert.equal((await request('other',base+'/invitations/'+invitation.id+'/resend',{})).status,404);assert.equal(calls.length,1);
 clock+=61000;reject=true;result=await(await request('owner',base+'/invitations/'+invitation.id+'/resend',{})).json();assert.equal(result.invitations[0].delivery.status,'failed');assert.ok(!JSON.stringify(result).includes('sensitive provider error'));
 const retryKey=calls.at(-1).options.headers['Idempotency-Key'];clock+=61000;reject=false;
 result=await(await request('owner',base+'/invitations/'+invitation.id+'/resend',{})).json();assert.equal(result.invitations[0].delivery.status,'sent');assert.equal(calls.at(-1).options.headers['Idempotency-Key'],retryKey,'uncertain delivery retries use the same provider key');assert.equal(result.invitations[0].expiresAt,invitation.expiresAt);
 assert.equal((await request('other','/invitations/'+invitation.id+'/accept',{})).status,404);
 assert.equal((await request('guest','/invitations/'+invitation.id+'/accept')).status,404);
 assert.equal((await request('guest','/invitations/'+invitation.id+'/accept',{})).status,200);
 clock+=61000;assert.equal((await request('owner',base+'/invitations/'+invitation.id+'/resend',{})).status,404);
 // No email leaves the server if saving the invitation fails.
 const count=calls.length;await mkdir(path.join(directory,'teams.json.tmp'));assert.equal((await request('owner',base+'/invitations',{...input,email:'other@example.com'})).status,503);assert.equal(calls.length,count);
});

test('missing mail credentials and invalid sender fail closed without contacting a provider',async()=>{
 let calls=0;for(const env of [{},{RESEND_API_KEY:'key',SNAPKIT_MAIL_FROM:'bad\nfrom@example.com'}]){const mailer=invitationMailer({env,fetcher:async()=>{calls++;}});assert.equal(mailer.configured,false);await assert.rejects(()=>mailer.send({}),/not configured/);}assert.equal(calls,0);
});
