'use strict';
function supportsSystemPicker(platform=process.platform,release=require('node:os').release()){
 return platform==='darwin'&&Number(release.split('.')[0])>=24;
}
function installCapturePermissions({session,webContents,origin,systemPicker}){
 const allowed=(contents,permission,url,isMainFrame)=>{
  if(!systemPicker||contents!==webContents||permission!=='display-capture'||isMainFrame===false)return false;
  try{return new URL(url).origin===origin;}catch{return false;}
 };
 session.setPermissionCheckHandler((contents,permission,requestingOrigin,details)=>allowed(contents,permission,requestingOrigin,details?.isMainFrame));
 session.setPermissionRequestHandler((contents,permission,callback,details)=>callback(allowed(contents,permission,details?.requestingUrl,details?.isMainFrame)));
 if(systemPicker){
  // macOS 15+: the OS asks the user to choose what to share. If unavailable,
  // deny the fallback rather than silently capturing another display.
  session.setDisplayMediaRequestHandler((_request,callback)=>callback({}),{useSystemPicker:true});
 }
}
module.exports={supportsSystemPicker,installCapturePermissions};
