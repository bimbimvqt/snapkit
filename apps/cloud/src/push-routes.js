import {createHash,randomUUID} from 'node:crypto';
import {validSubscription} from './infrastructure/team-push.js';
import {teamNotifications} from './domain/team-notifications.js';
export function installPushRoutes({router,transaction,systemWrite,readDB,push,fail,isActiveUser=async()=>true}){
 let timer,running=false;
 function schedule(delay=50){if(timer||running)return;timer=setTimeout(()=>{timer=null;void deliver();},delay);timer.unref?.();}
 async function deliver(){
  if(running)return;running=true;
  try{
   const jobs=(readDB().pushOutbox||[]).filter(j=>j.nextAt<=Date.now()).slice(0,10);
   for(const job of jobs){
    const db=readDB(),sub=(db.pushSubscriptions||[]).find(s=>s.id===job.subscriptionId&&s.userId===job.userId);
    const member=db.workspaces.flatMap(w=>w.members).find(m=>m.userId===job.userId);
    const item=member&&teamNotifications(db,{id:member.userId,email:member.email}).find(i=>i.id===job.notificationId&&!i.read);
    let error;
    if(sub&&item&&await isActiveUser(job.userId))try{await push.send(sub.subscription,{title:'Snapkit Teams',body:'Bạn có cập nhật công việc mới. Mở Snapkit để xem.',tag:item.id,data:{workspaceId:item.workspaceId,page:item.page,projectId:item.projectId,environment:item.environment,taskId:item.taskId,userId:job.userId}});}catch(e){error=e;}
    await systemWrite(next=>{
     if([404,410].includes(error?.statusCode))next.pushSubscriptions=(next.pushSubscriptions||[]).filter(s=>s.id!==job.subscriptionId);
     const pending=(next.pushOutbox||[]).find(j=>j.id===job.id);if(!pending)return;
     if(error&&![404,410].includes(error.statusCode)&&pending.attempts<5){pending.attempts++;pending.nextAt=Date.now()+Math.min(300000,10000*2**pending.attempts);}else next.pushOutbox=next.pushOutbox.filter(j=>j.id!==job.id);
    });
   }
  }catch{/* The outbox remains persisted for the next attempt. */}
  finally{running=false;const jobs=readDB().pushOutbox||[];if(jobs.length)schedule(Math.max(1000,Math.min(...jobs.map(j=>j.nextAt))-Date.now()));}
 }
 function enqueue(previous,next,workspaceId){
  if(!workspaceId||!(next.pushSubscriptions||[]).length)return;
  const workspace=next.workspaces.find(w=>w.id===workspaceId);if(!workspace)return;
  for(const member of workspace.members){const subscriptions=next.pushSubscriptions.filter(s=>s.userId===member.userId);if(!subscriptions.length)continue;
   const user={id:member.userId,email:member.email},old=new Set(teamNotifications(previous,user).map(i=>i.id));
   const fresh=teamNotifications(next,user).filter(i=>!i.read&&!old.has(i.id));
   for(const item of fresh)for(const sub of subscriptions){next.pushOutbox||=[];if(next.pushOutbox.length>=1000)next.pushOutbox.shift();next.pushOutbox.push({id:randomUUID(),userId:user.id,subscriptionId:sub.id,notificationId:item.id,attempts:0,nextAt:Date.now()});}
  }
 }
 router.get('/push/config',async(_req,res)=>res.json({publicKey:await push.publicKey()}));
 router.post('/push/subscribe',async(req,res)=>{
  if(!validSubscription(req.body?.subscription))fail(400,'Choose a supported browser push subscription.');
  const id=createHash('sha256').update(req.body.subscription.endpoint).digest('hex');
  const result=await transaction(req,(next,u)=>{next.pushSubscriptions||=[];const owned=next.pushSubscriptions.find(s=>s.id===id);if(owned&&owned.userId!==u.id)fail(409,'Disable push for the previous account on this browser first.');if(next.pushSubscriptions.filter(s=>s.userId===u.id).length>=8&&!owned)fail(409,'Remove an old notification device first.');next.pushSubscriptions=next.pushSubscriptions.filter(s=>s.id!==id);next.pushSubscriptions.push({id,userId:u.id,subscription:{endpoint:req.body.subscription.endpoint,keys:{p256dh:req.body.subscription.keys.p256dh,auth:req.body.subscription.keys.auth}},createdAt:Date.now()});return {enabled:true};});res.json(result);
 });
 router.post('/push/unsubscribe',async(req,res)=>{await transaction(req,(next,u)=>{next.pushSubscriptions=(next.pushSubscriptions||[]).filter(s=>!(s.userId===u.id&&s.subscription.endpoint===req.body?.endpoint));next.pushOutbox=(next.pushOutbox||[]).filter(j=>next.pushSubscriptions.some(s=>s.id===j.subscriptionId));});res.json({enabled:false});});
 router.post('/push/test',async(req,res)=>{const db=readDB(),sub=(db.pushSubscriptions||[]).find(s=>s.userId===req.teamUser.id&&s.subscription.endpoint===req.body?.endpoint);if(!sub)fail(404,'Enable push on this browser first.');try{await push.send(sub.subscription,{title:'Snapkit Teams',body:'Thông báo đẩy đã được kết nối.',tag:'snapkit-push-test',data:{page:'tasks',userId:req.teamUser.id}});res.json({sent:true});}catch{fail(503,'Could not deliver the test notification. Check browser permission.');}});
 return {enqueue,schedule};
}
