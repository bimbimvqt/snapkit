'use strict';
const {createClipboardHistory}=require('./clipboard.cjs');
const {createFileKit}=require('./file-kit.cjs');
function installEveryday({app,ipcMain,dialog,clipboard,desktopCapturer,fromApp,getWindow,language}){
 const files=createFileKit(),history=createClipboardHistory(clipboard);
 const valid=e=>{if(!fromApp(e))throw Error('Invalid caller');};
 ipcMain.handle('snapkit:clipboard-state',e=>{valid(e);return history.state();});
 ipcMain.handle('snapkit:clipboard-enabled',(e,value)=>{valid(e);return history.setEnabled(value);});
 ipcMain.handle('snapkit:clipboard-clear',e=>{valid(e);return history.clear();});
 ipcMain.handle('snapkit:clipboard-copy',(e,id)=>{valid(e);return history.copy(id);});
 ipcMain.handle('snapkit:file-pick',async e=>{valid(e);const result=await dialog.showOpenDialog(getWindow(),{properties:['openFile','multiSelections'],title:'Snapkit · File Kit'});return result.canceled?null:files.choose(result.filePaths);});
 ipcMain.handle('snapkit:file-apply',async(e,id,options)=>{valid(e);const rows=await files.plan(id,options);if(rows.some(r=>r.error))throw Error('Fix the filename conflicts before renaming');const count=rows.filter(r=>r.changed).length;const vi=language?.()==='vi';const choice=await dialog.showMessageBox(getWindow(),{type:'question',title:'Snapkit · File Kit',message:vi?`Đổi tên ${count} tệp?`:`Rename ${count} files?`,detail:vi?'Chỉ đổi tên các tệp đã chọn. Giữ nguyên nội dung. Hoàn tác có hiệu lực đến lần đổi tên tiếp theo hoặc khi đóng Snapkit.':'Only the selected filenames change. File contents stay the same. Undo is available until the next rename or until Snapkit closes.',buttons:vi?['Huỷ','Đổi tên']:['Cancel','Rename'],defaultId:0,cancelId:0});if(choice.response!==1)return {cancelled:true};return files.apply(id,options);});
 ipcMain.handle('snapkit:file-undo',async(e,id)=>{valid(e);return files.revert(id);});
 ipcMain.handle('snapkit:capture-screens',async e=>{valid(e);const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:1920,height:1080}});const images=sources.filter(s=>!s.thumbnail.isEmpty()).slice(0,8).map(s=>({id:s.id,name:s.name,image:s.thumbnail.toDataURL()}));if(!images.length)throw Error('Screen capture is unavailable. Allow Screen Recording in system settings or choose an image');return images;});
 app.once('will-quit',()=>history.dispose());
 return {files};
}
module.exports={installEveryday};
