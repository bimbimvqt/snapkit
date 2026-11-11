import {api} from '../../legacy/device-controller.js';
type Target={userId?:string;workspaceId?:string;page?:string;projectId?:string;environment?:string;taskId?:string};
type Desktop={notifyTeam:(data:{test?:boolean;target:Target})=>Promise<boolean>;onTeamNotification:(callback:(target:Target)=>void)=>()=>void};
const desktop=()=> (window as unknown as {snapkitDesktop?:Desktop}).snapkitDesktop;
const key=(userId:string)=>'snapkit-push:'+userId;
export const pushEnabled=(userId:string)=>!!userId&&localStorage.getItem(key(userId))==='on';
export const pushSupported=()=>!!desktop()?.notifyTeam||('serviceWorker' in navigator&&'PushManager' in window&&isSecureContext);
function publicKey(value:string){const raw=atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0));}
export async function setPush(userId:string,enabled:boolean){
 if(!userId)throw Error('Sign in to receive team notifications.');
 if(desktop()?.notifyTeam){if(enabled&&!await desktop()!.notifyTeam({test:true,target:{userId}}))throw Error('Notifications are unavailable on this device.');localStorage.setItem(key(userId),enabled?'on':'off');return;}
 if(!pushSupported())throw Error('Push is unavailable in this browser. Use a supported browser or the desktop app.');
 if(enabled&&await Notification.requestPermission()!=='granted')throw Error('Allow notifications in your browser settings, then try again.');
 const registration=await navigator.serviceWorker.register(new URL('team-push-worker.js',document.baseURI),{scope:new URL('./',document.baseURI).pathname});await navigator.serviceWorker.ready;
 let sub=await registration.pushManager.getSubscription();
 if(enabled){if(!sub){const config=await api('/api/teams/push/config',undefined,true);sub=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:publicKey(config.publicKey)});}await api('/api/teams/push/subscribe',{subscription:sub.toJSON()},true);}
 else if(sub){await api('/api/teams/push/unsubscribe',{endpoint:sub.endpoint},true);await sub.unsubscribe();}
 localStorage.setItem(key(userId),enabled?'on':'off');
}
export async function testPush(userId:string){if(desktop()?.notifyTeam)return desktop()!.notifyTeam({test:true,target:{userId}});const sub=await (await navigator.serviceWorker.ready).pushManager.getSubscription();if(!sub)throw Error('Enable push on this browser first.');return api('/api/teams/push/test',{endpoint:sub.endpoint},true);}
export function desktopPush(userId:string,items:{workspaceId:string;page:string;projectId?:string;environment?:string;taskId?:string}[]){if(pushEnabled(userId)&&items.length)void desktop()?.notifyTeam({target:{...items[0],userId}}).catch(()=>{});}
export function listenPush(user:()=>string){const open=(target:Target)=>{if(target?.userId===user()&&['home','tasks','sessions','handoffs','projects','members'].includes(target.page||'')&&typeof target.workspaceId==='string')document.dispatchEvent(new CustomEvent('snapkit:notification-open',{detail:target}));};const message=(e:MessageEvent)=>{if(e.data?.type==='snapkit-push-open')open(e.data.detail);};navigator.serviceWorker?.addEventListener('message',message);const dispose=desktop()?.onTeamNotification?.(open);const url=new URL(location.href),target=url.searchParams.get('push');if(target&&user()){url.searchParams.delete('push');history.replaceState(null,'',url);try{open(JSON.parse(target));}catch{}}return()=>{navigator.serviceWorker?.removeEventListener('message',message);dispose?.();};}

// Ask on first signed-in launch, while respecting an existing opt-out.
export async function startupPush(userId:string):Promise<'prompt'|'requested'|'enabled'|null>{
 if(!userId||!pushSupported()||localStorage.getItem(key(userId))!==null||localStorage.getItem('snapkit-push-asked:'+userId))return null;
 if(desktop()?.notifyTeam){localStorage.setItem('snapkit-push-asked:'+userId,'1');try{await setPush(userId,true);return 'requested';}catch{localStorage.removeItem('snapkit-push-asked:'+userId);return null;}}
 if(Notification.permission==='denied')return null;
 if(Notification.permission==='granted'){await setPush(userId,true);return 'enabled';}
 return 'prompt';
}
export function deferStartupPush(userId:string){localStorage.setItem('snapkit-push-asked:'+userId,'1');}
