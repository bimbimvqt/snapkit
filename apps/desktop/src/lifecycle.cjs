'use strict';
function stopAgent(child,{timeout=15000}={}){
 if(!child||!child.pid)return Promise.resolve();
 return new Promise(resolve=>{
  let timer;
  const done=()=>{clearTimeout(timer);child.removeListener('exit',done);resolve();};
  child.once('exit',done);
  const terminate=()=>{try{child.kill();}catch{}done();};
  timer=setTimeout(terminate,timeout);
  try{child.postMessage({type:'shutdown'});}catch{terminate();}
 });
}
function installLifecycle({app,showMain,confirmQuit,cleanup}){
 let quitting=false,exiting=false,reopen=false;
 const reopenOrFocus=()=>{
  // A launch while the old process holds its lock must survive that process.
  if(quitting){reopen=true;return;}
  showMain();
 };
 app.on('second-instance',reopenOrFocus);
 app.on('activate',()=>{
  if(exiting)reopen=true;
  else if(!quitting)showMain();
 });
 app.on('before-quit',async event=>{
  if(exiting)return;
  event.preventDefault();
  if(quitting)return;
  quitting=true;
  let allowed=true;
  try{allowed=await confirmQuit();}catch{/* An unavailable agent must not prevent quitting. */}
  if(!allowed){quitting=false;reopen=false;return;}
  exiting=true;
  try{await cleanup();}catch(error){console.warn('Snapkit quit cleanup failed:',error.message);}
  // Electron starts this only after this process exits and releases its lock.
  try{if(reopen)app.relaunch();}finally{app.quit();}
 });
 return {get exiting(){return exiting;},restart(){reopen=true;app.quit();}};
}
module.exports={installLifecycle,stopAgent};
