'use strict';
const path=require('node:path');
function installKit({app,ipcMain,dialog,shell,globalShortcut,Notification,powerSaveBlocker,fromApp,getWindow,origin,language}){
 let awake=null,focusTimer=null;
 async function request(route,body){const state=await fetch(origin+'/api/state').then(r=>r.json());const response=await fetch(origin+'/api/kit'+route,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Snapkit-Token':state.token},...(body===undefined?{}:{body:JSON.stringify(body)})});const result=await response.json();if(!response.ok)throw Error(result.error||'Kit operation failed');return result;}
 const valid=event=>{if(!fromApp(event))throw Error('Invalid caller');};
 const showCommands=()=>{const window=getWindow();if(window&&!window.isDestroyed()){if(window.isMinimized())window.restore();window.show();window.focus();window.webContents.send('snapkit:kit-command');}};
 const shortcut=globalShortcut.register('CommandOrControl+Shift+Space',showCommands);
 const state=()=>({startupAvailable:app.isPackaged&&['darwin','win32'].includes(process.platform),openAtLogin:app.getLoginItemSettings().openAtLogin,shortcut,awake:awake!==null&&powerSaveBlocker.isStarted(awake)});
 ipcMain.handle('snapkit:kit-settings',(event)=>{valid(event);return state();});
 ipcMain.handle('snapkit:kit-startup',(event,enabled)=>{valid(event);if(typeof enabled!=='boolean'||!state().startupAvailable)throw Error('Startup is available in the installed macOS or Windows app.');app.setLoginItemSettings({openAtLogin:enabled});return state();});
 const setAwake=enabled=>{if(typeof enabled!=='boolean')throw Error('Invalid setting');if(enabled&&awake===null)awake=powerSaveBlocker.start('prevent-display-sleep');else if(!enabled&&awake!==null){powerSaveBlocker.stop(awake);awake=null;}return state();};
 ipcMain.handle('snapkit:kit-awake',(event,enabled)=>{valid(event);return setAwake(enabled);});
 ipcMain.handle('snapkit:kit-pick',async event=>{valid(event);const result=await dialog.showOpenDialog(getWindow(),{title:language()==='vi'?'Thêm tệp vào Snapkit':'Add files to Snapkit',properties:['openFile','multiSelections']});if(result.canceled)return {files:[]};return request('/files',{paths:result.filePaths.slice(0,5)});});
 ipcMain.handle('snapkit:kit-drop',async(event,paths)=>{valid(event);if(!Array.isArray(paths)||paths.length>5||paths.some(p=>typeof p!=='string'||!path.isAbsolute(p)))throw Error('Choose up to 5 files');return request('/files',{paths});});
 ipcMain.handle('snapkit:kit-reveal',async(event,id)=>{valid(event);if(typeof id!=='string'||!/^[a-z0-9-]{36}$/i.test(id))throw Error('Invalid file');const result=await request('/files/'+encodeURIComponent(id)+'/path');shell.showItemInFolder(result.path);return true;});
 ipcMain.handle('snapkit:kit-folder',async(event,name)=>{valid(event);if(!['build','.dart_tool/flutter_build','node_modules/.cache'].includes(name))throw Error('Invalid folder');const state=await fetch(origin+'/api/state').then(r=>r.json());if(!state.settings.workspace)throw Error('Connect a project first');const root=await require('node:fs/promises').realpath(state.settings.workspace),folder=await require('node:fs/promises').realpath(path.join(root,name));if(path.relative(root,folder).startsWith('..')||path.isAbsolute(path.relative(root,folder)))throw Error('Folder is outside your project');shell.showItemInFolder(folder);return true;});
 const setFocusDeadline=deadline=>{if(deadline!==null&&(!Number.isFinite(deadline)||deadline<Date.now()-1000||deadline>Date.now()+86400000))throw Error('Invalid focus time');if(focusTimer)clearTimeout(focusTimer);focusTimer=null;if(deadline!==null)focusTimer=setTimeout(()=>{focusTimer=null;if(Notification.isSupported())new Notification({title:'Snapkit',body:language()==='vi'?'Đã hoàn thành phiên tập trung. Nghỉ một chút nhé.':'Your focus session is complete. Time for a break.',silent:false}).show();},Math.max(0,deadline-Date.now()));return true;};
 ipcMain.handle('snapkit:kit-focus',(event,deadline)=>{valid(event);return setFocusDeadline(deadline);});
 ipcMain.handle('snapkit:kit-notify',event=>{valid(event);if(Notification.isSupported()){new Notification({title:'Snapkit',body:language()==='vi'?'Đã hoàn thành phiên tập trung. Nghỉ một chút nhé.':'Your focus session is complete. Time for a break.',silent:false}).show();}return true;});
 app.once('will-quit',()=>{if(focusTimer)clearTimeout(focusTimer);globalShortcut.unregister('CommandOrControl+Shift+Space');if(awake!==null)powerSaveBlocker.stop(awake);});
 return {setFocusDeadline,state,setAwake};
}
module.exports={installKit};
