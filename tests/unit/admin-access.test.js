import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createCloud} from '../../apps/cloud/src/index.js';

test('four console roles enforce API permissions, preserve roles on login, protect owners and revoke immediately',async t=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'snapkit-rbac-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  let claims;
  const env={SNAPKIT_CLOUD_DATA:directory,GOOGLE_CLIENT_ID:'test',GOOGLE_CLIENT_SECRET:'test',SNAPKIT_ADMIN_EMAILS:'owner@example.com',SNAPKIT_PUBLIC_URL:'https://snapkit.test'};
  const server=createCloud({env,fetcher:async()=>Response.json({id_token:'test'}),verifyGoogle:async()=>claims}).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>server.close());
  const base='http://127.0.0.1:'+server.address().port;
  const request=(route,body,cookie)=>fetch(base+route,{redirect:'manual',method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:env.SNAPKIT_PUBLIC_URL,'X-Snapkit-Request':'1',Cookie:cookie||''},...(body===undefined?{}:{body:JSON.stringify(body)})});
  async function login(email){const start=await request('/auth/google/start');const url=new URL(start.headers.get('location'));claims={sub:email,email,email_verified:true,name:email.split('@')[0],nonce:url.searchParams.get('nonce')};const response=await request('/auth/google/callback?code=ok&state='+url.searchParams.get('state'),undefined,start.headers.get('set-cookie').split(';')[0]);assert.equal(response.status,302);return response.headers.get('set-cookie').split(';')[0];}
  const owner=await login('owner@example.com');const sessions={};
  for(const role of ['admin','editor','moderator','viewer']){sessions[role]=await login(role+'@example.com');assert.equal((await request('/v1/admin/users/role',{id:'google:'+role+'@example.com',role},owner)).status,200);const account=await(await request('/v1/account',undefined,sessions[role])).json();assert.equal(account.user.role,role);assert.ok(account.permissions.includes('overview.read'));}
  const expected={admin:[200,200,200,200,200,200],editor:[200,403,200,403,403,403],moderator:[200,403,403,200,403,403],viewer:[200,200,200,200,403,200]};
  const endpoints=['overview','users','content','feedback','roles','audit'];
  for(const [role,statuses] of Object.entries(expected))for(let index=0;index<endpoints.length;index++)assert.equal((await request('/v1/admin/'+endpoints[index],undefined,sessions[role])).status,statuses[index],role+' GET '+endpoints[index]);
  for(const role of ['editor','moderator','viewer'])assert.equal((await request('/v1/admin/users/role',{id:'google:'+role+'@example.com',role:'admin'},sessions[role])).status,403,'cannot escalate role');
  for(const role of ['editor','viewer'])assert.equal((await request('/v1/admin/feedback/moderation',{id:'anything',moderation:'approved'},sessions[role])).status,403);
  for(const role of ['editor','moderator','viewer'])assert.equal((await request('/v1/admin/users/access',{id:'google:viewer@example.com',disabled:true},sessions[role])).status,403);
  const content=(await(await request('/v1/admin/content',undefined,sessions.editor)).json()).content;
  for(const role of ['moderator','viewer'])assert.equal((await request('/v1/admin/content',content,sessions[role])).status,403);
  assert.equal((await request('/v1/admin/content',{...content,registrationOpen:!content.registrationOpen},sessions.editor)).status,403,'editor cannot change account admission');
  content.landing.vi.headline='Nội dung của biên tập viên';assert.equal((await request('/v1/admin/content',content,sessions.editor)).status,200);
  sessions.editor=await login('editor@example.com');assert.equal((await(await request('/v1/account',undefined,sessions.editor)).json()).user.role,'editor','role persists through another Google login');
  const receipt=await(await request('/v1/feedback',{type:'review',rating:4,name:'Developer',message:'An actual integration review.',publishConsent:true})).json();
  assert.equal((await request('/v1/admin/feedback/moderation',{id:receipt.id,moderation:'approved'},sessions.moderator)).status,200);
  const publicReviews=await(await request('/v1/public/reviews')).json();assert.equal(publicReviews.total,1);
  const moderatorOverview=await(await request('/v1/admin/overview',undefined,sessions.moderator)).json();assert.equal(moderatorOverview.content,undefined);assert.equal(moderatorOverview.audit,undefined);assert.equal(moderatorOverview.feedback.published,1);
  assert.equal((await request('/v1/admin/users/role',{id:'google:owner@example.com',role:'viewer'},sessions.admin)).status,403);
  assert.equal((await request('/v1/admin/users/access',{id:'google:owner@example.com',disabled:true},sessions.admin)).status,400);
  assert.equal((await request('/v1/admin/users/role',{id:'google:admin@example.com',role:'viewer'},sessions.admin)).status,403,'cannot demote own active account');
  assert.equal((await request('/v1/admin/users/role',{id:'google:moderator@example.com',role:'viewer'},owner)).status,200);
  assert.equal((await request('/v1/admin/feedback/moderation',{id:receipt.id,moderation:'pending'},sessions.moderator)).status,403,'existing session loses write permission immediately');
  assert.equal((await request('/v1/admin/users/access',{id:'google:viewer@example.com',disabled:true},owner)).status,200);
  assert.equal((await request('/v1/admin/overview',undefined,sessions.viewer)).status,401,'locked account loses existing session');
  const audit=await(await request('/v1/admin/audit',undefined,owner)).json();assert.ok(audit.entries.some(entry=>entry.action==='assign-role:viewer'));
});
