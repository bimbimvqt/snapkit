import {useSyncExternalStore} from 'react';
import {initialFocus,restoreFocus,settleFocus,changeFocus} from '../../../../../packages/domain/focus-garden.js';
import type {FocusAction,FocusExperience} from '../updates/model';
const key='snapkit-focus-garden-v1',timerKey='snapkit-focus-v1';
const desktop=window.snapkitDesktop,native=!!desktop?.focusExperience;
const listeners=new Set<()=>void>();
function read(key:string){try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}}
let state:FocusExperience=restoreFocus(read(key)||{...initialFocus(),timer:read(timerKey)||initialFocus().timer});
let ready=!native,error='';
const emit=()=>{state={...state};listeners.forEach(fn=>fn());};
function persist(value:FocusExperience){localStorage.setItem(key,JSON.stringify(value));localStorage.setItem(timerKey,JSON.stringify(value.timer));}
function accept(value:FocusExperience){state=restoreFocus(value);error='';emit();}
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
  if(native){accept(await desktop!.focusAction!(action));return true;}
  const next=changeFocus(state,action);persist(next);const timerChanged=next.timer!==state.timer;accept(next);
  if(timerChanged){void desktop?.miniFocus?.(next.timer).catch(()=>{});void desktop?.kitFocus?.(next.timer.deadline).catch(()=>{});}
  return true;
 }catch{error='Could not save your garden on this computer.';emit();return false;}
}
export function useFocusExperience(){
 const value=useSyncExternalStore(callback=>{listeners.add(callback);return()=>{listeners.delete(callback);};},()=>state);
 return {value,ready,error};
}

export const getFocusExperience=()=>state;
export const subscribeFocusExperience=(callback:()=>void)=>{listeners.add(callback);return()=>{listeners.delete(callback);};};
