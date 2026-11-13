import {readdir,readFile,realpath,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import path from 'node:path';import os from 'node:os';
export function maestroExecutable(){
 if(process.env.SNAPKIT_MAESTRO)return process.env.SNAPKIT_MAESTRO;
 const names=process.platform==='win32'?['maestro.bat','maestro.cmd','maestro.exe']:['maestro'];
 for(const name of names){const file=path.join(os.homedir(),'.maestro','bin',name);if(existsSync(file))return file;}
 return process.platform==='win32'?'maestro.bat':'maestro';
}
export async function workspaceFlows(workspace){
 if(!workspace)return {flows:[],fingerprint:''};
 const base=await realpath(workspace),folder=path.join(base,'.maestro'),flows=[],hash=createHash('sha256');let count=0;
 async function walk(directory,depth){
  if(depth>5)return;
  let items;try{items=await readdir(directory,{withFileTypes:true});}catch(error){if(error.code==='ENOENT')return;throw error;}
  for(const item of items.sort((a,b)=>a.name.localeCompare(b.name))){
   if(item.isSymbolicLink())continue;
   const file=path.join(directory,item.name);
   if(item.isDirectory()){if(!item.name.startsWith('.'))await walk(file,depth+1);continue;}
   if(!item.isFile())continue;
   if(++count>100)throw Error('Keep at most 100 Maestro files in .maestro');
   const actual=await realpath(file);if(!actual.startsWith(base+path.sep))throw Error('Flow must stay inside the workspace');
   const info=await stat(actual);if(info.size>256*1024)throw Error('A Maestro flow exceeds 256 KB');
   const source=await readFile(actual,'utf8'),id=path.relative(base,file).split(path.sep).join('/');hash.update(id).update(source);
   if(/[.]ya?ml$/i.test(item.name)&&!/^config[.]ya?ml$/i.test(item.name)&&/^appId\s*:/m.test(source))flows.push({id,name:path.relative(folder,file).split(path.sep).join('/')});
  }
 }
 try{const actual=await realpath(folder);if(!actual.startsWith(base+path.sep))throw Error('.maestro must stay inside the workspace');await walk(actual,0);}catch(error){if(error.code!=='ENOENT')throw error;}
 return {flows,fingerprint:hash.digest('hex')};
}
export function targetDevice(device,platform=process.platform){
 if(!device||device.state!=='online')throw Error('Choose an online device');
 if(device.platform!=='android'&&!(device.platform==='ios'&&device.group==='ios'&&platform==='darwin'))throw Error('Use Android or an iOS Simulator on macOS');
 const connection=device.platform==='android'?(device.flutterId||device.serial):device.id;
 if(typeof connection!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._:%\[\]-]{0,200}$/.test(connection))throw Error('Invalid device connection. Refresh devices');
 return {...device,connection};
}
