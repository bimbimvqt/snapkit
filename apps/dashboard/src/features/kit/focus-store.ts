import {useSyncExternalStore} from 'react';
import {initialFocus,restoreFocus,settleFocus,changeFocus} from '../../../../../packages/domain/focus-garden.js';
import type {FocusAction,FocusExperience} from '../updates/model';
const key='snapkit-focus-garden-v1',timerKey='snapkit-focus-v1';
const desktop=window.snapkitDesktop,native=!!desktop?.focusExperience;
const listeners=new Set<()=>void>();
function read(key:string){try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}}
let state:FocusExperience=restoreFocus(read(key)||{...initialFocus(),timer:read(timerKey)||initialFocus().timer});
let ready=!native,error='';
let audio:HTMLAudioElement|null=null,tracks:Record<string,{title:string;url:string}>={},audioEpoch=0,audioUntil=0;
let audioStatus={loading:false,error:'',title:'',available:false};
const audioListeners=new Set<()=>void>();
const audioEmit=()=>audioListeners.forEach(fn=>fn());
function reconcileAudio(){
 const track=tracks[state.space];
 audioStatus={...audioStatus,title:track?.title||'',available:!!track};audioEmit();
 if(!state.sound||!state.timer.deadline||state.timer.deadline<=Date.now()||!track){audioEpoch++;audio?.pause();return;}
 if(!audio){audio=new Audio();audio.loop=true;audio.preload='none';audio.addEventListener('error',()=>{audioStatus={...audioStatus,error:'Could not play this audio. Try again or choose another space.'};audioEmit();});}
 audio.volume=state.volume??0.35;
 if(audio.getAttribute('src')!==track.url){audio.pause();audio.src=track.url;}
 const epoch=++audioEpoch;
 void audio.play().then(()=>{if(epoch!==audioEpoch)return;audioStatus={...audioStatus,error:''};audioEmit();}).catch(e=>{if(epoch!==audioEpoch||e.name==='AbortError')return;audioStatus={...audioStatus,error:'Could not play this audio. Try again or choose another space.'};audioEmit();});
}
export async function refreshFocusAudio(){
 if(audioStatus.loading)return;
 audioUntil=Date.now()+300000;audioStatus={...audioStatus,loading:true,error:''};audioEmit();
 if(window.SNAPKIT_PREVIEW){tracks={};audioStatus={...audioStatus,loading:false};reconcileAudio();return;}
 try{const response=await fetch('/api/kit/focus-audio',{signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error('Unavailable');const data=await response.json();tracks=data.tracks||{};audioStatus={...audioStatus,loading:false};reconcileAudio();}
 catch{audioStatus={...audioStatus,loading:false,error:'Focus audio is temporarily unavailable.'};audioEmit();}
}
setInterval(()=>{if(audio&&(!state.timer.deadline||state.timer.deadline<=Date.now()))audio.pause();if(state.sound&&Date.now()>audioUntil)void refreshFocusAudio();},1000);
const emit=()=>{state={...state};listeners.forEach(fn=>fn());reconcileAudio();};
function persist(value:FocusExperience){localStorage.setItem(key,JSON.stringify(value));localStorage.setItem(timerKey,JSON.stringify(value.timer));}
function accept(value:FocusExperience){state=value;error='';emit();}
if(native){
 desktop?.onFocusExperience?.(accept);
 void desktop!.focusExperience!(state.timer).then(value=>{ready=true;accept(value);}).catch(()=>{error='Could not load your garden. Reopen Focus Kit to retry.';ready=true;emit();});
}else{
 desktop?.onMiniFocus?.(timer=>{const next={...state,timer};try{persist(next);accept(next);}catch{error='Could not save your garden on this computer.';emit();}});
 window.addEventListener('storage',event=>{if(event.key===key)accept(restoreFocus(read(key)));});
 setInterval(()=>{const next=settleFocus(state);if(next!==state){try{persist(next);accept(next);}catch{error='Could not save your garden on this computer.';emit();}}},1000);
}
export async function focusAction(action:FocusAction){
 try{
  if(native){accept(await desktop!.focusAction!(action));return;}
  const next=changeFocus(state,action);persist(next);const timerChanged=next.timer!==state.timer;accept(next);
  if(timerChanged){void desktop?.miniFocus?.(next.timer).catch(()=>{});void desktop?.kitFocus?.(next.timer.deadline).catch(()=>{});}
 }catch{error='Could not save your garden on this computer.';emit();}
}
export function useFocusExperience(){
 const value=useSyncExternalStore(callback=>{listeners.add(callback);return()=>{listeners.delete(callback);};},()=>state);
 return {value,ready,error};
}
export function useFocusAudio(){return useSyncExternalStore(callback=>{audioListeners.add(callback);return()=>{audioListeners.delete(callback);};},()=>audioStatus);}
