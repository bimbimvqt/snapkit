import os from 'node:os';
import path from 'node:path';
import {readdir,statfs} from 'node:fs/promises';
import {run} from '../../infrastructure/process/cli.js';

export function volumeForPath(volumes,target,platform=process.platform){
 if(!target)return null;const normalize=value=>(platform==='win32'?value.replaceAll('\\','/').toLowerCase():value).replace(/\/$/,'');const file=normalize(target);
 return volumes.filter(v=>{return (v.mounts||[v.mount]).some(value=>{const mount=normalize(value);return file===mount||file.startsWith(mount+'/');});}).sort((a,b)=>b.mount.length-a.mount.length)[0]||null;
}
export async function storageVolumes({platform=process.platform,command=run,readDirectory=readdir,space=statfs,home=os.homedir(),snapkit='',project=''}={}){
 let volumes=[];
 const measure=async candidate=>{const d=await space(candidate);const total=Number(d.blocks)*Number(d.bsize),free=Math.max(0,Math.min(total,Number(d.bavail)*Number(d.bsize)));return {total,free};};
 if(platform==='darwin'){
  let apfsRoles={};try{const raw=await command('/usr/sbin/diskutil',['apfs','list','-plist'],{timeout:3000});const apfs=JSON.parse(await command('/usr/bin/plutil',['-convert','json','-o','-','-'],{input:raw,timeout:2000}));apfsRoles=Object.fromEntries((apfs.Containers||[]).flatMap(c=>(c.Volumes||[]).map(v=>[v.DeviceIdentifier,v.Roles||[]])));}catch{}
  const entries=await readDirectory('/Volumes',{withFileTypes:true}).catch(()=>[]);const candidates=['/',...entries.filter(e=>e.isDirectory()).map(e=>path.posix.join('/Volumes',e.name))].slice(0,25);
  volumes=(await Promise.all(candidates.map(async mount=>{try{const raw=await command('/usr/sbin/diskutil',['info','-plist',mount],{timeout:3000});const info=JSON.parse(await command('/usr/bin/plutil',['-convert','json','-o','-','-'],{input:raw,timeout:2000}));if(info.MountPoint!==mount||info.BusProtocol==='Disk Image'||(apfsRoles[info.DeviceIdentifier]||[]).some(r=>['Preboot','Recovery','VM','Update','xART','Hardware'].includes(r)))return null;return {_group:info.APFSVolumeGroupID||mount,id:mount,name:info.VolumeName||path.posix.basename(mount)||'System disk',mount,internal:info.Internal??null,kind:info.SolidState===true?'ssd':info.SolidState===false?'hdd':'drive',connection:info.BusProtocol||'',filesystem:info.FilesystemType||'',...await measure(mount)};}catch{if(mount==='/')try{return {id:mount,mount,name:'System disk',internal:null,kind:'drive',connection:'',filesystem:'',...await measure(mount)};}catch{}return null;}}))).filter(Boolean);
 }else if(platform==='win32'){
  const script="@(Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 2 -or $_.DriveType -eq 3 } | ForEach-Object { $v=$_; $bus=''; try { $d=Get-Partition -DriveLetter $v.DeviceID.Substring(0,1) -ErrorAction Stop | Get-Disk -ErrorAction Stop | Select-Object -First 1; $bus=[string]$d.BusType } catch {}; @{mount=$v.DeviceID+'\\';name=$v.VolumeName;total=[double]$v.Size;free=[double]$v.FreeSpace;filesystem=$v.FileSystem;connection=$bus;removable=($v.DriveType -eq 2)} }) | ConvertTo-Json -Compress";
  try{const raw=JSON.parse(await command('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{timeout:6000}));volumes=[raw].flat().filter(v=>v&&v.total>0).map(v=>({id:v.mount,mount:v.mount,name:v.name||v.mount,total:v.total,free:Math.max(0,Math.min(v.total,v.free)),kind:'drive',internal:v.removable||/USB|SD|MMC/i.test(v.connection)?false:/NVMe|SATA|ATA|SAS|SCSI|RAID/i.test(v.connection)?true:null,connection:v.connection||'',filesystem:v.filesystem||''}));}catch{}
 }
 if(!volumes.length){try{const mount=platform==='win32'?path.win32.parse(home).root:'/';volumes=[{id:mount,mount,name:'System disk',internal:null,kind:'drive',connection:'',filesystem:'',...await measure(home)}];}catch{}}
 const system=volumeForPath(volumes,platform==='win32'?(process.env.SystemDrive?process.env.SystemDrive+'\\':path.win32.parse(home).root):'/',platform),data=volumeForPath(volumes,snapkit,platform),active=volumeForPath(volumes,project,platform);
 const groups=new Map();for(const v of volumes){const roles=[...(v===system?['system']:[]),...(v===data?['snapkit']:[]),...(v===active?['project']:[])],key=v._group||v.mount,previous=groups.get(key);const score=roles.length*10+(roles.includes('system')?100:0);if(!previous){groups.set(key,{...v,mounts:[v.mount],roles,_score:score});}else{const chosen=score>previous._score?v:previous;groups.set(key,{...chosen,mounts:[...previous.mounts,v.mount],roles:[...new Set([...previous.roles,...roles])],_score:Math.max(score,previous._score)});}}
 return [...groups.values()].map(({_group,_score,...v})=>v);
}
