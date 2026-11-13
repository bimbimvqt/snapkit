import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const validId=id=>/^[a-zA-Z][a-zA-Z0-9_]*(?:[.][a-zA-Z0-9_-]+)+$/.test(id);
export async function installedApps({device,run,signal}){
 const command=(name,args)=>run(name,args,{signal,timeout:15000});
 if(device.platform==='android'){
  const output=await command('adb',['-s',device.connection,'shell','pm','list','packages','-3']);
  return [...new Set(output.split(/\r?\n/).filter(line=>line.startsWith('package:')).map(line=>line.slice(8).trim()).filter(validId))].sort().map(id=>({id,name:id}));
 }
 const output=await command('xcrun',['simctl','listapps',device.connection]);
 const directory=await mkdtemp(path.join(os.tmpdir(),'snapkit-apps-'));
 try{
  const file=path.join(directory,'apps.plist');await writeFile(file,output,{mode:0o600});
  const apps=JSON.parse(await command('plutil',['-convert','json','-o','-',file]));
  return Object.entries(apps).filter(([id,app])=>validId(id)&&app&&app.ApplicationType==='User').map(([id,app])=>({id,name:String(app.CFBundleDisplayName||app.CFBundleName||id).slice(0,160)})).sort((a,b)=>a.name.localeCompare(b.name));
 }finally{await rm(directory,{recursive:true,force:true});}
}
