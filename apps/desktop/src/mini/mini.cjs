'use strict';
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {debugSummary}=require('./data.cjs');
const {key,profileFor,buildView}=require('./build.cjs');
const {completionTracker,saveArtifact}=require('./artifacts.cjs');
function installMini({app,BrowserWindow,Tray,Menu,nativeImage,screen,ipcMain,fromApp,getWindow,language,setDeadline,nativeTheme,origin,history,kit,Notification,dialog,shell}){
 const completions=completionTracker(),notifications=new Set();let monitoring=false;
 let refreshTimer=null,refreshing=false,debugRefreshing=false,lastBounds=null,nextTask=0,nextDebug=0;
 let window=null,tray=null,compact=false,pinned=true,task=null,focus={remaining:1500,deadline:null};
 let mode='focus',debug=null;const contentHeights={};
 let buildState=null,catalog=null,releases=null,catalogWorkspace=null,nextCatalog=0,starting=false;let selection={platform:'android',environment:'dev'},mappings={};
 const preferences=path.join(app.getPath('userData'),'mini.json');
 try{const saved=JSON.parse(fs.readFileSync(preferences,'utf8'));if(['focus','debug','utility'].includes(saved.mode))mode=saved.mode;if(saved.mappings&&typeof saved.mappings==='object'&&!Array.isArray(saved.mappings))mappings=saved.mappings;}catch{}
 const url=pathToFileURL(path.join(__dirname,'mini.html')).href;
 function savePreferences(){fs.mkdirSync(path.dirname(preferences),{recursive:true});fs.writeFileSync(preferences,JSON.stringify({mode,mappings:Object.fromEntries(Object.entries(mappings).slice(-20))}),{mode:0o600});}
 const buildSnapshot=()=>buildView(buildState,catalog,releases,selection,mappings,starting);
 const vi=()=>language()==='vi';
 const showMain=()=>{const main=getWindow();if(main&&!main.isDestroyed()){if(main.isMinimized())main.restore();main.show();main.focus();}};
 const snapshot=()=>{const clipboard=history.state();return {focus,task,compact,pinned,mode,debug,quickBuild:buildSnapshot(),utility:mode==='utility'?{enabled:clipboard.enabled,item:clipboard.enabled&&clipboard.items[0]?{id:clipboard.items[0].id,text:clipboard.items[0].text.slice(0,500)}:null,count:clipboard.enabled?clipboard.items.length:0,awake:kit.state().awake,error:!!clipboard.error}:null,language:vi()?'vi':'en',dark:nativeTheme.shouldUseDarkColors};};
 const publish=()=>{if(window&&!window.isDestroyed())window.webContents.send('snapkit:mini-state',snapshot());};
 const valid=e=>{if(e.sender!==window?.webContents||e.senderFrame!==window.webContents.mainFrame||e.senderFrame.url!==url)throw Error('Invalid widget caller');};
 async function get(route){const response=await fetch(origin+route,{signal:AbortSignal.timeout(5000)});if(!response.ok)throw Object.assign(Error('Unavailable'),{status:response.status});return response.json();}
 function notifyBuild(job){
  if(!Notification.isSupported())return;
  const success=job.status==='succeeded',format=String(job.plan?.format||'').toUpperCase();
  const notification=new Notification({title:vi()?(success?'Build hoàn tất':'Build thất bại'):(success?'Build complete':'Build failed'),body:vi()?(success?format+' đã sẵn sàng. Mở Snapkit để tải.':'Mở Snapkit để xem chi tiết.'):(success?format+' is ready. Open Snapkit to save it.':'Open Snapkit to review details.'),silent:false});
  notifications.add(notification);notification.on('close',()=>notifications.delete(notification));notification.on('click',()=>{showMain();getWindow()?.webContents.send('snapkit:mini-navigate',{page:'releases'});});notification.show();
 }
 async function monitorBuilds(){if(monitoring)return;monitoring=true;try{const jobs=await get('/api/releases/activity');for(const job of completions.observe(jobs.jobs))notifyBuild(job);}catch{}finally{monitoring=false;}}
 const monitorTimer=setInterval(()=>void monitorBuilds(),3000);void monitorBuilds();
 async function downloadArtifact(jobId,artifactId){
  const expected=buildState?.settings?.workspace;await refreshDebug();
  const item=buildSnapshot().artifacts.find(item=>item.jobId===jobId&&item.id===artifactId);
  if(!item||!expected||buildState?.settings?.workspace!==expected)throw Error('Artifact unavailable');
  const choice=await dialog.showSaveDialog(window||getWindow(),{title:vi()?'Lưu bản build':'Save build',defaultPath:path.join(app.getPath('downloads'),item.name),filters:[{name:item.name.split('.').pop().toUpperCase(),extensions:[item.name.split('.').pop()]}]});
  if(choice.canceled||!choice.filePath)return;
  const state=await get('/api/state');if(state.authRequired||state.settings?.workspace!==expected)throw Error('Workspace changed');
  const response=await fetch(origin+'/api/releases/'+encodeURIComponent(jobId)+'/artifacts/'+encodeURIComponent(artifactId),{signal:AbortSignal.timeout(600000)});
  await saveArtifact(response,choice.filePath);shell.showItemInFolder(choice.filePath);
 }
 async function refreshDebug(){if(debugRefreshing)return;debugRefreshing=true;try{
  const [state,result]=await Promise.allSettled([get('/api/state'),get('/api/releases')]);if(state.status==='rejected')throw state.reason;buildState=state.value;releases=result.status==='fulfilled'?result.value:null;
  const workspace=buildState.settings?.workspace||'';
  if(workspace!==catalogWorkspace){catalog=null;catalogWorkspace=workspace;nextCatalog=0;}
  if(workspace&&!buildState.authRequired&&Date.now()>=nextCatalog){nextCatalog=Date.now()+15000;try{catalog=await get('/api/releases/catalog');if(catalog.workspace!==workspace)catalog=null;}catch{catalog=null;}}
  debug=debugSummary(buildState,releases);
 }catch{buildState=null;catalog=null;releases=null;debug={devices:[],deviceCount:0,sessions:0,build:null,unavailable:true,releaseUnavailable:true};}finally{debugRefreshing=false;publish();}}
 async function post(route,body,state){const response=await fetch(origin+route,{method:'POST',headers:{'Content-Type':'application/json','X-Snapkit-Token':state.token},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Build unavailable');return response.json();}
 async function startBuild(){
  if(starting)throw Error('Build busy');const expected=buildState?.settings?.workspace;const chosen={...selection};starting=true;publish();
  try{const state=await get('/api/state');if(!expected||state.settings?.workspace!==expected||state.authRequired)throw Error('Workspace changed');const fresh=await get('/api/releases/catalog'),jobs=await get('/api/releases');if(fresh.workspace!==expected)throw Error('Workspace changed');const view=buildView(state,fresh,jobs,chosen,mappings);if(!view.canBuild)throw Error('Build unavailable');const profile=profileFor(fresh,chosen.platform,chosen.environment,mappings[key(expected)]?.[chosen.platform+':'+chosen.environment]);
   const job=await post('/api/releases/build',{expectedWorkspace:expected,format:chosen.platform==='ios'?'ipa':'apk',purpose:'ipa',flavor:profile.flavor||'',target:profile.target||'lib/main.dart',defineFile:profile.defineFile||'',buildName:fresh.buildName||'',buildNumber:fresh.buildNumber||''},state);completions.track(job);void monitorBuilds();
  }finally{starting=false;nextCatalog=0;await refreshDebug();}
 }
 async function refreshTask(){if(!task||refreshing||!window?.isVisible())return;refreshing=true;const selected=task;try{const value=await get('/api/teams/'+encodeURIComponent(selected.workspaceId));if(task!==selected)return;const current=value.tasks?.find(item=>item.id===selected.id);if(value.membership?.userId!==selected.userId||!current){task=null;resize();publish();return;}task={...selected,title:current.title,done:current.criteria.filter(c=>c.done).length,total:current.criteria.length};publish();}catch(error){if(task===selected&&[401,403,404].includes(error.status)){task=null;resize();publish();}}finally{refreshing=false;}}
 function tick(){if(!window?.isVisible())return;if(mode==='utility')publish();if(mode==='debug'&&Date.now()>=nextDebug){nextDebug=Date.now()+3000;void refreshDebug();}if(task&&Date.now()>=nextTask){nextTask=Date.now()+15000;void refreshTask();}}
 function resize(){if(!window)return;const desired=compact?72:contentHeights[mode]??(mode==='utility'?520:mode==='debug'?550:task?454:404);const bounds=window.getBounds(),work=screen.getDisplayMatching(bounds).workArea,height=Math.min(desired,work.height);if(bounds.height===height&&bounds.width===360&&bounds.x>=work.x&&bounds.x+360<=work.x+work.width&&bounds.y>=work.y&&bounds.y+height<=work.y+work.height)return;window.setBounds({x:Math.max(work.x,Math.min(bounds.x,work.x+work.width-360)),y:Math.max(work.y,Math.min(bounds.y,work.y+work.height-height)),width:360,height});}
 async function show(){
  if(window&&!window.isDestroyed()){window.show();window.focus();tick();return true;}
  const work=screen.getPrimaryDisplay().workArea;
  window=new BrowserWindow({width:360,height:454,x:lastBounds?.x??work.x+work.width-384,y:lastBounds?.y??work.y+Math.min(90,Math.max(0,work.height-530)),show:false,frame:false,resizable:false,maximizable:false,fullscreenable:false,alwaysOnTop:pinned,transparent:true,skipTaskbar:true,title:'Snapkit Mini',backgroundColor:'#00000000',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
  window.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',event=>event.preventDefault());window.on('move',()=>{lastBounds=window.getBounds();});window.on('closed',()=>{clearInterval(refreshTimer);refreshTimer=null;window=null;});
  await window.loadURL(url);resize();window.show();refreshTimer=setInterval(tick,1000);tick();return true;
 }
 function menu(){return Menu.buildFromTemplate([{label:vi()?'Mở Snapkit':'Open Snapkit',click:showMain},{label:vi()?'Mở widget nổi':'Open floating widget',click:()=>void show().catch(()=>{})},{label:vi()?'Lệnh nhanh':'Quick commands',click:()=>{showMain();getWindow()?.webContents.send('snapkit:kit-command');}},{type:'separator'},{label:vi()?'Thoát Snapkit':'Quit Snapkit',click:()=>app.quit()}]);}
 function refresh(){tray?.setContextMenu(menu());publish();}
 const image=nativeImage.createFromPath(path.join(__dirname,'../../assets',process.platform==='darwin'?'trayTemplate.png':'icon.png')).resize({width:process.platform==='darwin'?18:24,height:process.platform==='darwin'?18:24});
 if(process.platform==='darwin')image.setTemplateImage(true);
 tray=new Tray(image);tray.setToolTip('Snapkit');refresh();tray.on('double-click',showMain);if(process.platform==='darwin')tray.on('click',()=>tray.popUpContextMenu());else tray.on('click',showMain);
 ipcMain.handle('snapkit:mini-open',event=>{if(!fromApp(event))throw Error('Invalid caller');return show();});
 ipcMain.handle('snapkit:mini-focus',(event,value)=>{if(!fromApp(event)||!value||!Number.isFinite(value.remaining)||value.remaining<0||value.remaining>86400||(value.deadline!==null&&(!Number.isFinite(value.deadline)||value.deadline>Date.now()+86400000)))throw Error('Invalid focus');focus={remaining:value.remaining,deadline:value.deadline};publish();});
 ipcMain.handle('snapkit:mini-task',(event,value)=>{if(!fromApp(event))throw Error('Invalid caller');if(value===null)task=null;else{const fields=['id','userId','workspaceId','projectId','environment','title','project'];if(fields.some(key=>typeof value?.[key]!=='string'||value[key].length>300)||!Number.isInteger(value.total)||!Number.isInteger(value.done)||value.total<0||value.done<0||value.done>value.total)throw Error('Invalid task');task=Object.fromEntries(fields.map(key=>[key,value[key]]));Object.assign(task,{total:value.total,done:value.done});mode='focus';}resize();publish();});
 ipcMain.on('snapkit:mini-fit',(event,value)=>{valid(event);if(compact||value?.mode!==mode||!Number.isInteger(value.height)||value.height<160||value.height>900)return;contentHeights[mode]=value.height;resize();});
 ipcMain.handle('snapkit:mini-state',event=>{valid(event);return snapshot();});
 ipcMain.handle('snapkit:mini-action',async(event,action)=>{
  valid(event);
  if(action==='close'){window.close();return;}
  if(action==='pin'){pinned=!pinned;window.setAlwaysOnTop(pinned);}
  else if(action==='compact'){compact=!compact;resize();}
  else if(['mode:focus','mode:debug','mode:utility'].includes(action)){mode=action.slice(5);savePreferences();resize();if(mode==='debug'){nextDebug=Date.now()+3000;void refreshDebug();}}
  else if(['build:android','build:ios','build:dev','build:prod'].includes(action)){if(starting)throw Error('Build busy');const value=action.slice(6);if(['android','ios'].includes(value))selection.platform=value;else selection.environment=value;}
  else if(typeof action==='string'&&/^build:profile:[a-f0-9]{24}$/.test(action)){if(starting)throw Error('Build busy');const view=buildSnapshot(),id=action.slice(14);if(!buildState?.settings?.workspace||!view.profiles.some(p=>p.id===id))throw Error('Invalid profile');const project=key(buildState.settings.workspace);mappings[project]={...mappings[project],[selection.platform+':'+selection.environment]:id};savePreferences();}
  else if(typeof action==='string'&&/^build:download:[a-f0-9-]{36}:[a-f0-9-]{36}$/.test(action)){const [, ,jobId,artifactId]=action.split(':');await downloadArtifact(jobId,artifactId);}
  else if(action==='build:start'){await startBuild();}
  else if(action==='build:cancel'){if(!buildSnapshot().canCancel)throw Error('No active build');const expected=buildState.settings.workspace,state=await get('/api/state'),jobs=await get('/api/releases');if(state.settings?.workspace!==expected||jobs.active?.workspace!==expected)throw Error('Workspace changed');await post('/api/releases/'+encodeURIComponent(jobs.active.id)+'/cancel',{},state);await refreshDebug();}
  else if(action==='focus'){const running=focus.deadline&&focus.deadline>Date.now();const remaining=running?Math.max(0,Math.ceil((focus.deadline-Date.now())/1000)):focus.deadline?1500:focus.remaining||1500;focus={remaining,deadline:running?null:Date.now()+remaining*1000};setDeadline(focus.deadline);getWindow()?.webContents.send('snapkit:mini-focus',focus);}
  else if(action==='awake'){kit.setAwake(!kit.state().awake);}
  else if(action==='copy'){const value=history.state();if(!value.enabled||!value.items[0])throw Error('No captured clipboard item');await history.copy(value.items[0].id);}
  else if(['capture','qr','clipboard','logs','devices','releases'].includes(action)){showMain();getWindow()?.webContents.send('snapkit:mini-navigate',['logs','devices','releases'].includes(action)?{page:action}:{tool:action});}
  else if(action==='open'){showMain();if(task)getWindow()?.webContents.send('snapkit:team-notification',{userId:task.userId,...task,taskId:task.id,page:'tasks'});else getWindow()?.webContents.send('snapkit:mini-navigate',{tool:'focus'});}
  else if(action==='clear'){task=null;resize();}
  else throw Error('Invalid action');
  publish();return snapshot();
 });
 nativeTheme.on('updated',publish);
 app.once('will-quit',()=>{clearInterval(refreshTimer);clearInterval(monitorTimer);nativeTheme.removeListener('updated',publish);window?.destroy();tray?.destroy();});
 return {show,refresh,checkBuilds:monitorBuilds,getWindow:()=>window,hasTray:()=>!!tray&&!tray.isDestroyed()};
}
module.exports={installMini};
