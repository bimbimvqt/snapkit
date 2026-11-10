import * as webpush from 'web-push';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
export function validSubscription(value){
 try{const url=new URL(value?.endpoint);return url.protocol==='https:'&&(!url.port||url.port==='443')&&!url.username&&!url.password&&!url.hash&&url.href.length<2048&&(url.hostname==='fcm.googleapis.com'||url.hostname==='web.push.apple.com'||['.push.services.mozilla.com','.notify.windows.com','.wns.windows.com','.web.push.apple.com'].some(s=>url.hostname.endsWith(s)))&&/^[A-Za-z0-9_-]{80,130}$/.test(value.keys?.p256dh)&&/^[A-Za-z0-9_-]{20,40}$/.test(value.keys?.auth);}catch{return false;}
}
export function createTeamPush({env,sender}){
 let keysPromise;
 async function keys(){return keysPromise??=(async()=>{
  const file=path.join(env.SNAPKIT_CLOUD_DATA||'cloud-data','web-push-keys.json');await mkdir(path.dirname(file),{recursive:true});
  try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;const value=webpush.generateVAPIDKeys();try{await writeFile(file,JSON.stringify(value),{flag:'wx',mode:0o600});return value;}catch(error){if(error.code!=='EEXIST')throw error;return JSON.parse(await readFile(file,'utf8'));}}
 })();}
 return {publicKey:async()=>(await keys()).publicKey,send:async(subscription,payload)=>{if(sender)return sender(subscription,payload);const k=await keys();return webpush.sendNotification(subscription,JSON.stringify(payload),{vapidDetails:{subject:'mailto:teams@snapkit.vn',publicKey:k.publicKey,privateKey:k.privateKey},TTL:3600,timeout:8000});}};
}
