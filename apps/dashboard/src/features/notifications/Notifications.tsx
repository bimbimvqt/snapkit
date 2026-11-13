import {reconcileSnapshot} from '../../shared/state/reconcile.js';
import {pushEnabled,pushSupported,setPush,testPush,desktopPush,listenPush} from './push';
import {createNotificationTracker} from './sound.js';
import {soundEnabled,setSoundEnabled,unlockSound,playChime,chimeForNewItems,playSuccess,soundVolume,setSoundVolume} from './notification-sound';
import {createRoot} from 'react-dom/client';
import {createPortal} from 'react-dom';
import {useCallback,useEffect,useId,useRef,useState} from 'react';
import {api,state} from '../../legacy/device-controller.js';
import {Icon} from '../../shared/ui/icons';
import {t,useLanguage} from '../../shared/ui/use-language';
import './notifications.css';
import './messages.js';
type Notification={id:string;type:string;title:string;at:string;workspaceId:string;workspaceName:string;page:string;projectId?:string;environment?:string;detail?:string;taskId?:string;read:boolean};
type Feed={userId:string;items:Notification[]};
function Notifications({personalHost}:{personalHost:HTMLElement}){
 const language=useLanguage(),id=useId(),trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null),epoch=useRef(0),writing=useRef(false),track=useRef(createNotificationTracker());
 const hydrated=useRef(false);
 const [sound,setSound]=useState(soundEnabled);
 const [push,setPushState]=useState(false),[pushError,setPushError]=useState(''),[pushBusy,setPushBusy]=useState(false);const pushUser=useRef('');
 const [mode,setMode]=useState(document.body.dataset.productMode),[open,setOpen]=useState(false),[feed,setFeed]=useState<Feed>({userId:'',items:[]}),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(false),[unreadOnly,setUnreadOnly]=useState(false);
 const preview=!!window.SNAPKIT_PREVIEW,available=preview||!(state as {demo?:boolean}).demo||mode==='teams';
 const refresh=useCallback(async()=>{
  if(!available||writing.current)return;const current=++epoch.current;if(!hydrated.current)setLoading(true);
  try{const result=await api('/api/teams/notifications',undefined,true) as Feed;if(current!==epoch.current)return;const fresh=track.current(result);pushUser.current=result.userId;setPushState(pushEnabled(result.userId));if(!preview)desktopPush(result.userId,result.items.filter(i=>fresh.includes(i.id)));if(!preview)void chimeForNewItems(result.userId,fresh);setFeed(previous=>preview&&previous.userId===result.userId?{...result,items:result.items.map(item=>({...item,read:previous.items.find(old=>old.id===item.id)?.read??item.read}))}:reconcileSnapshot(previous,result));hydrated.current=true;setError(false);}
  catch(e){if(current===epoch.current){setError(true);if([401,403].includes(Number((e as {status?:number})?.status))){setFeed({userId:'',items:[]});pushUser.current='';setPushState(false);hydrated.current=false;}}}
  finally{if(current===epoch.current)setLoading(false);}
 },[available,preview]);
 const [volume,setVolume]=useState(soundVolume);
 useEffect(()=>{const success=()=>void playSuccess();document.addEventListener('snapkit:action-success',success);return()=>document.removeEventListener('snapkit:action-success',success);},[]);
 useEffect(()=>{const unlock=()=>{if(soundEnabled())void unlockSound();};const sync=()=>{setSound(soundEnabled());setVolume(soundVolume());};document.addEventListener('pointerdown',unlock);document.addEventListener('keydown',unlock);document.addEventListener('snapkit:notification-sound',sync);window.addEventListener('storage',sync);return()=>{document.removeEventListener('pointerdown',unlock);document.removeEventListener('keydown',unlock);document.removeEventListener('snapkit:notification-sound',sync);window.removeEventListener('storage',sync);};},[]);
 function close(restore=false){setOpen(false);if(restore)trigger.current?.focus();}
 useEffect(()=>{const change=(e:Event)=>{setMode((e as CustomEvent).detail);close();};document.addEventListener('snapkit:product-mode',change);return()=>document.removeEventListener('snapkit:product-mode',change);},[]);
 useEffect(()=>{
  void refresh();const update=()=>{if(!document.hidden||soundEnabled()||pushEnabled(pushUser.current))void refresh();};const timer=setInterval(update,30000);
  document.addEventListener('snapkit:teams-updated',update);document.addEventListener('visibilitychange',update);window.addEventListener('focus',update);
  return()=>{epoch.current++;clearInterval(timer);document.removeEventListener('snapkit:teams-updated',update);document.removeEventListener('visibilitychange',update);window.removeEventListener('focus',update);};
 },[refresh]);
 useEffect(()=>{
  if(!open)return;const element=panel.current!,button=trigger.current!;
  function position(){const r=button.getBoundingClientRect(),width=Math.min(400,innerWidth-24);Object.assign(element.style,{width:width+'px',left:Math.max(12,Math.min(r.right-width,innerWidth-width-12))+'px',top:Math.min(r.bottom+8,innerHeight-160)+'px',maxHeight:Math.max(120,innerHeight-r.bottom-24)+'px'});}
  element.showPopover();position();element.querySelector<HTMLButtonElement>('[data-close]')?.focus({preventScroll:true});
  const outside=(e:Event)=>{if(!element.contains(e.target as Node)&&!button.contains(e.target as Node))close();};
  document.addEventListener('pointerdown',outside,true);document.addEventListener('focusin',outside);window.addEventListener('resize',position);
  return()=>{if(element.isConnected&&element.matches(':popover-open'))element.hidePopover();document.removeEventListener('pointerdown',outside,true);document.removeEventListener('focusin',outside);window.removeEventListener('resize',position);};
 },[open]);
 async function read(ids?:string[]){
  if(writing.current)return;writing.current=true;setSaving(true);epoch.current++;setLoading(false);
  try{if(preview)setFeed(previous=>({...previous,items:previous.items.map(item=>({...item,read:!ids||ids.includes(item.id)||item.read}))}));else setFeed(await api('/api/teams/notifications/read',ids?{ids}:{all:true}) as Feed);setError(false);}catch{setError(true);}finally{writing.current=false;setSaving(false);}
 }
 useEffect(()=>{
  void window.snapkitDesktop?.miniTask?.(null).catch(()=>{});
 },[feed.userId]);
 useEffect(()=>listenPush(()=>pushUser.current),[feed.userId]);
 const unread=feed.items.filter(item=>!item.read).length,items=unreadOnly?feed.items.filter(item=>!item.read):feed.items;
 const host=mode==='teams'?document.getElementById('teams-notifications-slot'):personalHost;
 return <>
 {host&&createPortal(<button ref={trigger} type="button" className="icon-button notification-trigger" aria-label={unread?t('Notifications ({0} unread)',[unread]):t('Notifications')} aria-expanded={open} aria-haspopup="dialog" aria-controls={id} onClick={()=>{setOpen(!open);if(!open)void refresh();}}><Icon name="bell"/>{unread>0&&<span className="notification-count" aria-hidden="true">{unread>99?'99+':unread}</span>}</button>,host)}
 <div ref={panel} id={id} popover="manual" className="notification-panel" role="dialog" aria-labelledby={id+'-title'} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(true);}}}>
  <header><h2 id={id+'-title'}>{t('Notifications')}</h2><div className="notification-header-actions"><button type="button" className="icon-button" aria-label={t('Notification sound')} title={t(sound?'Mute notification sound':'Enable notification sound')} aria-pressed={sound} onClick={()=>{setSoundEnabled(!sound);if(!sound)void unlockSound();}}><Icon name={sound?'volume-2':'volume-x'}/></button><button className="icon-button" data-close type="button" aria-label={t('Close notifications')} onClick={()=>close(true)}><Icon name="x"/></button></div></header>
  <div className="notification-tools"><div role="group" aria-label={t('Filter notifications')}><button type="button" aria-pressed={!unreadOnly} onClick={()=>setUnreadOnly(false)}>{t('All')}</button><button type="button" aria-pressed={unreadOnly} onClick={()=>setUnreadOnly(true)}>{t('Unread')}{unread>0?' · '+unread:''}</button></div><button type="button" disabled={saving||loading||!unread} onClick={()=>void read()}>{t('Mark all as read')}</button></div>
  <div className="notification-content" aria-busy={loading||saving}>
   {!available?<p className="notification-empty">{t('Sign in to receive team notifications.')}</p>:error&&!feed.items.length?<div className="notification-empty" role="alert"><p>{t('Could not update notifications.')}</p><button type="button" className="button" onClick={()=>void refresh()}>{t('Retry')}</button></div>:loading&&!items.length?<p className="notification-empty" role="status">{t('Loading notifications…')}</p>:!items.length?<div className="notification-empty"><Icon name="bell"/><p>{t(unreadOnly?'You are all caught up.':'No notifications yet.')}</p></div>:<ul>{items.map(item=><li key={item.id} data-unread={!item.read}><button type="button" disabled={saving} className="notification-item" onClick={()=>{if(!item.read)void read([item.id]);close(true);document.dispatchEvent(new CustomEvent('snapkit:notification-open',{detail:item}));}}><span className="notification-symbol"><Icon name={item.type==='invitation'?'group':item.type==='handoff'?'package':item.type==='warning'?'circle-alert':'layers'}/></span><span><strong>{t(item.title)}</strong><small>{item.workspaceName}{item.detail?' · '+item.detail:''}</small><time dateTime={item.at}>{new Date(item.at).toLocaleString(language==='vi'?'vi-VN':'en-US',{dateStyle:'short',timeStyle:'short'})}</time></span>{!item.read&&<span className="notification-unread-dot" aria-label={t('Unread')}/>}</button></li>)}</ul>}
  </div>
  {!preview&&<div className="notification-push-settings"><button className="button" type="button" disabled={pushBusy||!feed.userId||!pushSupported()} aria-pressed={push} onClick={()=>{setPushBusy(true);setPushError('');void setPush(feed.userId,!push).then(()=>setPushState(!push)).catch((e:Error)=>setPushError(e.message)).finally(()=>setPushBusy(false));}}>{t(push?'Disable push notifications':'Enable push notifications')}</button>{push&&<button className="button" type="button" disabled={pushBusy} onClick={()=>{setPushError('');void testPush(feed.userId).catch((e:Error)=>setPushError(e.message));}}>{t('Test notification')}</button>}{pushError&&<p role="alert">{t(pushError)}</p>}</div>}<footer className="notification-sound-settings"><label className="notification-volume"><span>{t('Sound volume')} {Math.round(volume*100)}%</span><input type="range" aria-label={t('Sound volume')} min="0" max="100" value={Math.round(volume*100)} disabled={!sound} onChange={e=>setSoundVolume(Number(e.target.value)/100)}/></label><button type="button" disabled={!sound} onClick={()=>void unlockSound().then(()=>playChime())}>{t('Test sound')}</button></footer>
 </div>
 </>;
}
export function mountNotifications(){
 const rootHost=document.createElement('div');rootHost.id='notifications-root';document.body.append(rootHost);
 const personalHost=document.createElement('span');personalHost.className='notifications-slot';document.getElementById('help-button')!.before(personalHost);
 const root=createRoot(rootHost);root.render(<Notifications personalHost={personalHost}/>);
 return()=>{root.unmount();rootHost.remove();personalHost.remove();};
}
