import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {DAY,newHistory,readHistory,recordDay,recordSuccess,eligible,invited} from '../../apps/dashboard/src/features/reviews/policy.js';
import {reviewInput} from '../../apps/agent/src/modules/accounts/reviews.js';
import {LocalAccount} from '../../apps/agent/src/modules/accounts/local-account.js';
import {createCloud} from '../../apps/cloud/src/index.js';

test('review invitations require real usage, a quiet moment, cooldown and a finite lifetime budget',()=>{
  const now=Date.now(), sessionStartedAt=now-9*60000;
  let h=newHistory(now-8*DAY);
  for(let i=0;i<3;i++) h=recordDay(h,now-i*DAY);
  for(let i=0;i<5;i++) h=recordSuccess(h,now-60000);
  const context={now,sessionStartedAt,quiet:true,busy:false};
  assert.equal(eligible(h,context),true);
  for(const patch of [{successes:4},{days:h.days.slice(0,2)},{firstUsedAt:now-DAY},{submitted:true},{optedOut:true},{prompts:3},{lastSuccessAt:now-1000}]) assert.equal(eligible({...h,...patch},context),false);
  assert.equal(eligible(h,{...context,busy:true}),false);assert.equal(eligible(h,{...context,quiet:false}),false);
  assert.equal(eligible(h,{...context,sessionStartedAt:now-60000}),false);
  h=invited(h,now);assert.equal(eligible(h,context),false);
  assert.equal(eligible(h,{...context,now:now+30*DAY}),true);
  h=invited(invited(h,now+30*DAY),now+60*DAY);assert.equal(eligible(h,{...context,now:now+100*DAY}),false);
  assert.equal(recordDay(recordDay(h,now),now).days.length,3);
  assert.equal(readHistory('{bad',now).successes,0);
  assert.equal(readHistory(JSON.stringify({...h,prompts:-1}),now).prompts,0);
});
test('review payload allows every rating, requires a comment and whitelists data',()=>{
  for(let rating=1;rating<=5;rating++) {
    const input=reviewInput({rating,message:' Honest feedback. ',name:' Dev ',submissionId:randomUUID(),publishConsent:false,token:'secret',logs:['secret'],email:'account@example.com'});
    assert.equal(input.rating,rating);assert.equal(input.message,'Honest feedback.');assert.equal(input.publishConsent,false);assert.equal(input.name,'Dev');
    assert.equal(input.logs,undefined);assert.equal(input.token,undefined);assert.equal(input.email,undefined);
  }
  assert.throws(()=>reviewInput({rating:0}),/rating/);
  assert.throws(()=>reviewInput({rating:5,message:'short'}),/characters/);
});
test('local review transport supplies feedback origin headers without sending account credentials',async()=>{
  let call;
  const account=new LocalAccount({fetcher:async(url,options)=>{call={url,options};return Response.json({received:true,id:'receipt'});}});
  account.token='private-account-token';await account.review({rating:1,message:'Needs better setup',submissionId:randomUUID()});
  assert.ok(call.url.endsWith('/v1/feedback'));assert.equal(call.options.headers['X-Snapkit-Request'],'1');assert.equal(call.options.headers.Origin,new URL(call.url).origin);
  assert.equal(call.options.headers.Authorization,undefined);
});
test('cloud retry deduplicates review receipt and keeps unapproved or private reviews off the public site',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'snapkit-reviews-'));
  const app=createCloud({env:{SNAPKIT_CLOUD_DATA:root,SNAPKIT_PUBLIC_URL:'https://snapkit.example.com'}});
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const input={type:'review',rating:1,name:'Dev',message:'The setup needs improvement.',publishConsent:false,submissionId:randomUUID()};
  const post=()=>fetch(origin+'/v1/feedback',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://snapkit.example.com','X-Snapkit-Request':'1'},body:JSON.stringify(input)}).then(r=>r.json());
  try {
    const [a,b]=await Promise.all([post(),post()]);assert.equal(a.received,true);assert.equal(a.id,b.id);
    const db=JSON.parse(await readFile(path.join(root,'accounts.json'),'utf8'));assert.equal(db.feedback.length,1);assert.equal(db.feedback[0].rating,1);assert.equal(db.feedback[0].publishConsent,false);
    assert.equal((await fetch(origin+'/v1/public/reviews').then(r=>r.json())).total,0);
  } finally {await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});}
});
