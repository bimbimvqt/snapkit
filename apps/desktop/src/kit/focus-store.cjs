'use strict';
const fs=require('node:fs');
const path=require('node:path');
async function createFocusStore({app,onChange,setDeadline}) {
 const {initialFocus,restoreFocus,settleFocus,changeFocus}=await import('../../../../packages/domain/focus-garden.js');
 const file=path.join(app.getPath('userData'),'focus-garden.json');
 let state=initialFocus(),loaded=false;
 try{state=restoreFocus(JSON.parse(fs.readFileSync(file,'utf8')));loaded=true;}catch{}
 function commit(next){
  if(next===state)return state;
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file+'.tmp',JSON.stringify(next),{mode:0o600});fs.renameSync(file+'.tmp',file);
  const changed=next.timer.deadline!==state.timer.deadline;state=next;loaded=true;
  if(changed)setDeadline(state.timer.deadline);
  onChange(state);return state;
 }
 const settle=()=>commit(settleFocus(state));
 const timer=setInterval(()=>{try{settle();}catch{}},1000);
 // Catch a session that finished while Snapkit was closed without crediting it twice.
 settle();if(state.timer.deadline>Date.now())setDeadline(state.timer.deadline);
 return {
  state:settle,
  migrate(value){if(!loaded&&value){const restored=restoreFocus({timer:value});commit(restored);}return settle();},
  action(value){return commit(changeFocus(state,value));},
  legacyTimer(value){return commit(restoreFocus({...settle(),timer:value}));},
  dispose(){clearInterval(timer);}
 };
}
module.exports={createFocusStore};
