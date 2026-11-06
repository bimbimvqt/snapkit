import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createCloud } from '../../apps/cloud/src/index.js';
import { LocalAccount } from '../../apps/agent/src/modules/accounts/local-account.js';

test('Google OAuth binds browser, verifies nonce/email, enforces admin, CSRF, revisions and revocation', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'snapkit-accounts-')); t.after(() => rm(dir, { recursive:true, force:true }));
  let claims;
  const env = { SNAPKIT_CLOUD_DATA:dir, GOOGLE_CLIENT_ID:'test-client', GOOGLE_CLIENT_SECRET:'test-secret', SNAPKIT_ADMIN_EMAILS:'admin@example.com', SNAPKIT_PUBLIC_URL:'https://snapkit.example.com' };
  const app = createCloud({env, fetcher:async () => new Response(JSON.stringify({id_token:'signed-token'})), verifyGoogle:async () => claims });
  const server = app.listen(0,'127.0.0.1'); await new Promise(r => server.once('listening',r)); t.after(() => server.close());
  const origin = 'http://127.0.0.1:' + server.address().port;
  const request = (route, opts = {}) => fetch(origin + route, {redirect:'manual', ...opts});
  const post = (route, body, cookie, csrf = true) => request(route,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie || '',...(csrf ? {Origin:env.SNAPKIT_PUBLIC_URL,'X-Snapkit-Request':'1'} : {})},body:JSON.stringify(body)});
  async function login(email, extra = {}, desktop) {
    const start = await request('/auth/google/start' + (desktop ? '?desktop=' + desktop : '')); const google = new URL(start.headers.get('location'));
    claims = {sub:email,email,email_verified:true,name:'Test user',nonce:google.searchParams.get('nonce'),...extra};
    const route = '/auth/google/callback?state=' + google.searchParams.get('state') + '&code=test';
    const response = await request(route,{headers:{Cookie:start.headers.get('set-cookie').split(';')[0]}});
    return {response, cookie:response.headers.get('set-cookie')?.split(';')[0], route};
  }
  assert.equal((await request('/v1/admin/overview')).status,401);
  assert.equal((await request('/auth/google/callback?state=bad&code=bad')).status,400);
  const bad = await login('bad@example.com',{nonce:'incorrect'}); assert.match(bad.response.headers.get('location'),/failed/);
  const unverified = await login('bad@example.com',{email_verified:false}); assert.match(unverified.response.headers.get('location'),/failed/);
  const admin = await login('admin@example.com'); assert.equal(admin.response.headers.get('location'),'/admin/');
  assert.equal((await request(admin.route,{headers:{Cookie:admin.cookie}})).status,400);
  const member = await login('member@example.com');
  assert.equal((await request('/v1/admin/overview',{headers:{Cookie:member.cookie}})).status,403);
  const feedback = { type:'feature', message:'Please add device grouping by project.', email:'reply@example.com', name:'Developer', rating:null };
  assert.equal((await post('/v1/feedback',feedback,null,false)).status,403);
  assert.equal((await post('/v1/feedback',{...feedback,message:'short'})).status,400);
  assert.equal((await post('/v1/feedback',{...feedback,type:'review',rating:0})).status,400);
  assert.equal((await post('/v1/feedback',{...feedback,type:'review'})).status,400);
  assert.equal((await post('/v1/feedback',{...feedback,website:'spam.test'})).status,400);
  const submitted = await post('/v1/feedback',feedback); assert.equal(submitted.status,201);
  const receipt = await submitted.json(); assert.ok(receipt.id); assert.equal(receipt.email,undefined);
  assert.equal((await request('/v1/admin/feedback')).status,401);
  assert.equal((await request('/v1/admin/feedback',{headers:{Cookie:member.cookie}})).status,403);
  const inbox = await (await request('/v1/admin/feedback',{headers:{Cookie:admin.cookie}})).json();
  assert.equal(inbox.total,1); assert.equal(inbox.entries[0].email,feedback.email);
  assert.equal((await post('/v1/admin/feedback/status',{id:receipt.id,status:'done'},admin.cookie,false)).status,403);
  assert.equal((await post('/v1/admin/feedback/status',{id:receipt.id,status:'invalid'},admin.cookie)).status,400);
  assert.equal((await post('/v1/admin/feedback/status',{id:receipt.id,status:'reviewing'},admin.cookie)).status,200);
  const persisted = JSON.parse(await readFile(path.join(dir,'accounts.json'),'utf8'));
  assert.equal(persisted.feedback[0].status,'reviewing');
  for (let index = 0; index < 4; index++) assert.equal((await post('/v1/feedback',{...feedback,type:'review',rating:5})).status,201);
  assert.equal((await post('/v1/feedback',feedback)).status,429);
  const overview = await (await request('/v1/admin/overview',{headers:{Cookie:admin.cookie}})).json(); assert.equal(overview.users,2);
  const content = overview.content; content.landing.vi.headline = 'Nội dung mới';
  assert.equal((await post('/v1/admin/content',content,admin.cookie,false)).status,403);
  assert.equal((await post('/v1/admin/content',content,admin.cookie)).status,200);
  assert.equal((await post('/v1/admin/content',content,admin.cookie)).status,409);
  assert.equal((await (await request('/v1/public/content')).json()).landing.vi.headline,'Nội dung mới');
  assert.equal((await post('/v1/admin/users/access',{id:'google:member@example.com',disabled:true},admin.cookie)).status,200);
  assert.equal((await request('/v1/account',{headers:{Cookie:member.cookie}})).status,401);
  assert.equal((await post('/v1/admin/users/access',{id:'google:admin@example.com',disabled:true},admin.cookie)).status,400);
  const flow = await (await post('/v1/auth/desktop/start',{})).json();
  assert.equal((await post('/v1/auth/desktop/poll',{flowId:flow.flowId,pollToken:'wrong'})).status,410);
  assert.equal((await (await post('/v1/auth/desktop/poll',flow)).json()).pending,true);
  await login('desktop@example.com',{},flow.flowId);
  const completed = await (await post('/v1/auth/desktop/poll',flow)).json(); assert.ok(completed.token);
  assert.equal((await post('/v1/auth/desktop/poll',flow)).status,410);
  assert.equal((await request('/v1/account',{headers:{Authorization:'Bearer ' + completed.token}})).status,200);
  const current = await (await request('/v1/public/content')).json(); current.registrationOpen = false;
  await post('/v1/admin/content',current,admin.cookie);
  assert.match((await login('new@example.com')).response.headers.get('location'),/failed/);
  await post('/v1/auth/logout',{},admin.cookie);
  assert.equal((await request('/v1/admin/overview',{headers:{Cookie:admin.cookie}})).status,401);
});

test('local account caches verified identity, fails closed, clears expired sessions and persists desktop login', async () => {
  let stored = {token:'old'}, calls = 0, mode = 'ok';
  const account = new LocalAccount({storage:async (action,value) => action === 'read' ? stored : (stored = value),fetcher:async (url,opts) => {
    calls++; if (mode === 'network') throw Error('offline'); if (mode === 'expired') return new Response('{"error":"Expired"}',{status:401});
    if (url.endsWith('/start')) return Response.json({flowId:'flow',pollToken:'secret',browserUrl:'https://snapkit.vn/auth/google/start?desktop=flow',expiresIn:600});
    if (url.endsWith('/poll')) return Response.json({token:'new'});
    assert.match(opts.headers.Authorization,/Bearer /); return Response.json({user:{id:'user',name:'User',role:'user'}});
  }});
  const initial = await Promise.all([account.status(),account.status()]); assert.ok(initial.every(s => s.authenticated)); assert.equal(calls,1);
  assert.equal(JSON.stringify(initial).includes('old'),false);
  await account.status(); assert.equal(calls,1);
  mode = 'network'; assert.equal((await account.status(true)).authenticated,false); assert.equal(stored.token,'old');
  mode = 'expired'; assert.equal((await account.status(true)).authenticated,false); assert.equal(stored,null);
  mode = 'ok'; const start = await account.start(); assert.equal(start.pollToken,undefined);
  assert.equal((await account.poll()).authenticated,true); assert.equal(stored.token,'new');
  await account.logout(); assert.equal(stored,null); assert.equal((await account.status()).authenticated,false);
});

test('release lookup includes a published tag while GitHub release list is stale', async t => {
  const {readFile} = await import('node:fs/promises');
  const {version} = JSON.parse(await readFile(new URL('../../package.json',import.meta.url),'utf8'));
  const release = {tag_name:'v'+version,published_at:'2026-11-02T10:36:49Z',prerelease:true,html_url:'https://github.com/bimbimvqt/snapkit/releases/tag/v'+version,assets:[{name:`Snapkit-${version}-mac-arm64.dmg`,browser_download_url:'https://github.com/download.dmg',size:100}]};
  const server = createCloud({env:{},fetcher:async url => Response.json(url.includes('/tags/') ? release : [])}).listen(0,'127.0.0.1');
  await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
  const response=await fetch(`http://127.0.0.1:${server.address().port}/v1/releases/latest?platform=darwin&arch=arm64`);
  const result=await response.json();assert.equal(result.version,version);assert.equal(result.available,true);
});

test('changing the admin allowlist removes old admin privileges from existing sessions', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'snapkit-admin-change-')); t.after(() => rm(dir, {recursive:true,force:true}));
  const env = {SNAPKIT_CLOUD_DATA:dir,GOOGLE_CLIENT_ID:'client',GOOGLE_CLIENT_SECRET:'test',SNAPKIT_ADMIN_EMAILS:'old@example.com',SNAPKIT_PUBLIC_URL:'https://snapkit.example.com'};
  let claims;
  const options = {env,fetcher:async () => Response.json({id_token:'token'}),verifyGoogle:async () => claims};
  async function serve(config) { const server = createCloud(config).listen(0,'127.0.0.1'); await new Promise(r=>server.once('listening',r)); t.after(()=>server.close()); return 'http://127.0.0.1:'+server.address().port; }
  async function login(base,email) {
    const start=await fetch(base+'/auth/google/start',{redirect:'manual'}); const url=new URL(start.headers.get('location'));
    claims={sub:email,email,email_verified:true,nonce:url.searchParams.get('nonce')};
    const response=await fetch(base+'/auth/google/callback?state='+url.searchParams.get('state')+'&code=test',{redirect:'manual',headers:{Cookie:start.headers.get('set-cookie').split(';')[0]}});
    return response.headers.get('set-cookie').split(';')[0];
  }
  const first=await serve(options); const oldSession=await login(first,'old@example.com');
  const second=await serve({...options,env:{...env,SNAPKIT_ADMIN_EMAILS:'new@example.com'}});
  const old=await fetch(second+'/v1/account',{headers:{Cookie:oldSession}}); assert.equal((await old.json()).user.role,'user');
  assert.equal((await fetch(second+'/v1/admin/overview',{headers:{Cookie:oldSession}})).status,403);
  const newSession=await login(second,'new@example.com');
  assert.equal((await fetch(second+'/v1/admin/overview',{headers:{Cookie:newSession}})).status,200);
});


test('desktop login uses the canonical account server and reports network failures without leaking transport details', async () => {
  const account = new LocalAccount({storage:async()=>null,fetcher:async url=>{
    assert.equal(url, (process.env.SNAPKIT_ACCOUNT_SERVER || 'https://snapkit.vn') + '/v1/auth/desktop/start');
    throw new TypeError('fetch failed', {cause: Error('TLS transport details')});
  }});
  await assert.rejects(account.start(), {message:'Cannot connect to the Snapkit account service. Check your connection and try again.'});
  assert.equal(account.flow,null);
});
