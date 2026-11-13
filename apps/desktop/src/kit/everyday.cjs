'use strict';
const {createClipboardHistory}=require('./clipboard.cjs');
function installEveryday({app,ipcMain,clipboard,fromApp}){
 const history=createClipboardHistory(clipboard);
 const valid=e=>{if(!fromApp(e))throw Error('Invalid caller');};
 ipcMain.handle('snapkit:clipboard-state',e=>{valid(e);return history.state();});
 ipcMain.handle('snapkit:clipboard-enabled',(e,value)=>{valid(e);return history.setEnabled(value);});
 ipcMain.handle('snapkit:clipboard-clear',e=>{valid(e);return history.clear();});
 ipcMain.handle('snapkit:clipboard-copy',(e,id)=>{valid(e);return history.copy(id);});
 app.once('will-quit',()=>history.dispose());
 return {history};
}
module.exports={installEveryday};
