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
  const profile = {name:'Edited Member',jobTitle:'Flutter Developer',bio:'Build useful tools',role:'admin',email:'evil@example.com',id:'google:admin@example.com'};
  assert.equal((await post('/v1/account/profile',profile,null)).status,401);
  assert.equal((await post('/v1/account/profile',profile,member.cookie,false)).status,403);
  assert.equal((await post('/v1/account/profile',{...profile,name:' '},member.cookie)).status,400);
  assert.equal((await post('/v1/account/profile',{...profile,bio:'x'.repeat(501)},member.cookie)).status,400);
  const edited = await (await post('/v1/account/profile',profile,member.cookie)).json();
  assert.equal(edited.user.name,'Edited Member');assert.equal(edited.user.role,'user');assert.equal(edited.user.email,'member@example.com');assert.equal(edited.user.jobTitle,'Flutter Developer');
  const avatar={type:'preset',style:'lorelei',seed:'fixture-avatar'};
  const withAvatar=await (await post('/v1/account/profile',{...profile,avatar},member.cookie)).json();assert.deepEqual(withAvatar.user.avatar,avatar);
  const avatarUsers=await (await request('/v1/admin/users',{headers:{Cookie:admin.cookie}})).json();assert.match(avatarUsers.users.find(user=>user.email==='member@example.com').avatarImage,/^data:image\/svg\+xml/);
  for(const invalid of [{type:'preset',style:'unknown',seed:'x'},{type:'preset',style:'lorelei',seed:'<script>'},{type:'upload',data:'data:image/svg+xml;base64,PHN2Zz4='},{type:'upload',data:'data:image/png;base64,ZmFrZQ=='},{type:'upload',data:'x'.repeat(96001)}])assert.equal((await post('/v1/account/profile',{...profile,avatar:invalid},member.cookie)).status,400);
  const signedAgain = await login('member@example.com');
  const persistedProfile = await (await request('/v1/account',{headers:{Cookie:signedAgain.cookie}})).json();
  assert.deepEqual(persistedProfile.user.avatar,avatar);assert.equal(persistedProfile.user.name,'Edited Member');assert.equal(persistedProfile.user.bio,profile.bio);
  const image={type:'upload',data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9sAAAAASUVORK5CYII='};
  const uploaded=await (await post('/v1/account/profile',{...profile,avatar:image},member.cookie)).json();assert.deepEqual(uploaded.user.avatar,image);
  assert.equal((await post('/v1/account/profile',{...profile,avatar:null},member.cookie)).status,200);
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
  const reviewIds = [];
  for (let index = 0; index < 4; index++) {
    const response = await post('/v1/feedback',{...feedback,type:'review',rating:5,publishConsent:index === 0,moderation:'approved'});
    assert.equal(response.status,201); reviewIds.push((await response.json()).id);
  }
  const publicReviews = async () => (await request('/v1/public/reviews')).json();
  assert.equal((await publicReviews()).total,0, 'client moderation fields cannot publish reviews');
  const moderation = {id:reviewIds[0],moderation:'approved'};
  assert.equal((await post('/v1/admin/feedback/moderation',moderation)).status,401);
  assert.equal((await post('/v1/admin/feedback/moderation',moderation,member.cookie)).status,403);
  assert.equal((await post('/v1/admin/feedback/moderation',moderation,admin.cookie,false)).status,403);
  assert.equal((await post('/v1/admin/feedback/moderation',{...moderation,id:receipt.id},admin.cookie)).status,409, 'feature requests stay private');
  assert.equal((await post('/v1/admin/feedback/moderation',{...moderation,id:reviewIds[1]},admin.cookie)).status,409, 'private reviews cannot be published');
  await post('/v1/admin/feedback/status',{id:reviewIds[0],status:'done'},admin.cookie);
  assert.equal((await publicReviews()).total,0, 'processing status does not approve a review');
  assert.equal((await post('/v1/admin/feedback/moderation',moderation,admin.cookie)).status,200);
  const published = await publicReviews(); assert.equal(published.total,1); assert.equal(published.reviews[0].rating,5);
  assert.deepEqual(Object.keys(published.reviews[0]).sort(),['createdAt','id','message','name','rating']);
  assert.equal(JSON.stringify(published).includes(feedback.email),false);
  const restarted = createCloud({env}).listen(0,'127.0.0.1'); await new Promise(resolve => restarted.once('listening',resolve)); t.after(() => restarted.close());
  const afterRestart = await fetch('http://127.0.0.1:' + restarted.address().port + '/v1/public/reviews').then(response => response.json());
  assert.equal(afterRestart.total,1, 'approval persists across service restart');
  assert.equal((await post('/v1/admin/feedback/moderation',{...moderation,moderation:'pending'},admin.cookie)).status,200);
  assert.equal((await publicReviews()).total,0, 'withdrawing approval removes the public review');
  await post('/v1/admin/feedback/moderation',{...moderation,moderation:'rejected'},admin.cookie);
  assert.equal((await publicReviews()).total,0);

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

test('Google login returns invitees only to the allowed join page and rejects arbitrary return URLs',async t=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'snapkit-invite-auth-'));t.after(()=>rm(directory,{recursive:true,force:true}));let claims;
 const server=createCloud({env:{SNAPKIT_CLOUD_DATA:directory,GOOGLE_CLIENT_ID:'client',GOOGLE_CLIENT_SECRET:'secret'},fetcher:async()=>Response.json({id_token:'signed'}),verifyGoogle:async()=>claims}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
 const base='http://127.0.0.1:'+server.address().port;
 for(const [returnTo,expected] of [['/join/','/join/'],['https://evil.example/','/admin/'],['//evil.example/','/admin/'],['/join/?next=https://evil.example','/admin/']]){
  const start=await fetch(base+'/auth/google/start?returnTo='+encodeURIComponent(returnTo),{redirect:'manual'}),google=new URL(start.headers.get('location'));
  claims={sub:'invitee',email:'invitee@example.com',email_verified:true,nonce:google.searchParams.get('nonce')};
  const response=await fetch(base+'/auth/google/callback?state='+google.searchParams.get('state')+'&code=test',{redirect:'manual',headers:{Cookie:start.headers.get('set-cookie').split(';')[0]}});assert.equal(response.headers.get('location'),expected);
 }
});


test('static website requests do not consume the cloud API rate limit',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'snapkit-static-rate-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const app=createCloud({env:{SNAPKIT_CLOUD_DATA:dir}}),server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>server.close());const origin='http://127.0.0.1:'+server.address().port;
 for(let i=0;i<125;i++)assert.equal((await fetch(origin+'/favicon.svg')).status,200);
 for(let i=0;i<120;i++)assert.equal((await fetch(origin+'/v1/product/kit')).status,200);
 const limited=await fetch(origin+'/v1/product/kit');assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'60');
 assert.equal((await fetch(origin+'/favicon.svg')).status,200);assert.equal((await fetch(origin+'/health')).status,200);
});
