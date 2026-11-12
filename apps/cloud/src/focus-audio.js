import {readFile,writeFile,mkdir,rename,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {spaces} from '../../../packages/domain/focus-garden.js';
import {hasPermission} from './domain/admin-access.js';
export const audioLimit=2*1024*1024;
function format(buffer){
 if(buffer.length<32)return null;
 if(buffer.toString('ascii',0,3)==='ID3'||buffer[0]===255&&(buffer[1]&224)===224)return {extension:'mp3',mime:'audio/mpeg'};
 if(buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WAVE')return {extension:'wav',mime:'audio/wav'};
 if(buffer.toString('ascii',0,4)==='OggS')return {extension:'ogg',mime:'audio/ogg'};
 return null;
}
export function installFocusAudio(app,{env,accounts}){
 const directory=path.join(env.SNAPKIT_CLOUD_DATA||'cloud-data','focus-audio'),manifest=path.join(directory,'catalog.json');
 let queue=Promise.resolve();
 async function catalog(){try{return JSON.parse(await readFile(manifest,'utf8'));}catch(error){if(error.code==='ENOENT')return {tracks:{}};throw error;}}
 const serial=task=>{const operation=queue.catch(()=>{}).then(task);queue=operation;return operation;};
 const view=data=>({tracks:Object.fromEntries(Object.entries(data.tracks).map(([space,item])=>[space,{...item,url:'/v1/focus/audio/files/'+item.file}]))});
 async function authorized(req){const account=await accounts.identity(req);if(!account||!hasPermission(account.user.role,'content.write')){const error=Error('Permission revoked');error.status=403;throw error;}}
 async function save(data){await mkdir(directory,{recursive:true});await writeFile(manifest+'.tmp',JSON.stringify(data),{mode:0o600});await rename(manifest+'.tmp',manifest);}
 app.get('/v1/focus/audio',async(_req,res)=>res.json(view(await catalog())));
 app.get('/v1/focus/audio/files/:file',async(req,res)=>{
  if(!/^[a-f0-9]{64}\.(mp3|wav|ogg)$/.test(req.params.file))return res.sendStatus(404);
  res.set({'Cache-Control':'public, max-age=86400','Content-Type':{'mp3':'audio/mpeg','wav':'audio/wav','ogg':'audio/ogg'}[req.params.file.split('.').pop()]});
  res.sendFile(path.resolve(directory,req.params.file),error=>{if(error&&!res.headersSent)res.sendStatus(404);});
 });
 // Role and CSRF are checked before the route decodes or writes audio.
 app.get('/v1/admin/focus-audio',async(_req,res)=>res.json(view(await catalog())));
 app.post('/v1/admin/focus-audio/:space',async(req,res)=>{
  const input=req.body;
  if(typeof input?.data!=='string'||input.data.length>Math.ceil(audioLimit/3)*4||input.data.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(input.data))return res.status(400).json({error:'Dữ liệu âm thanh không hợp lệ hoặc vượt quá 2 MB.'});
  const buffer=Buffer.from(input.data,'base64');
  if(!spaces.includes(req.params.space)||!buffer.length||buffer.length>audioLimit)return res.status(400).json({error:'Chọn không gian và tệp MP3, WAV hoặc OGG (tối đa 2 MB).'});
  const detected=format(buffer);if(!detected)return res.status(400).json({error:'Tệp không phải âm thanh MP3, WAV hoặc OGG hợp lệ.'});
  let title;try{title=String(input.title||'').trim();}catch{return res.status(400).json({error:'Tên âm thanh không hợp lệ.'});}
  if(!title||title.length>100||/[\u0000-\u001f]/.test(title))return res.status(400).json({error:'Tên âm thanh cần từ 1 đến 100 ký tự.'});
  const data=await serial(async()=>{
   await authorized(req);const data=await catalog(),previous=data.tracks[req.params.space];
   const file=createHash('sha256').update(buffer).digest('hex')+'.'+detected.extension;
   await mkdir(directory,{recursive:true});await writeFile(path.join(directory,file+'.tmp'),buffer,{mode:0o600});await rename(path.join(directory,file+'.tmp'),path.join(directory,file));
   data.tracks[req.params.space]={file,title,mime:detected.mime,size:buffer.length,updatedAt:new Date().toISOString()};await save(data);
   if(previous&&previous.file!==file&&!Object.values(data.tracks).some(item=>item.file===previous.file))await unlink(path.join(directory,previous.file)).catch(()=>{});
   return view(data);
  });res.json(data);
 });
 app.post('/v1/admin/focus-audio/:space/remove',async(req,res)=>{
  if(!spaces.includes(req.params.space))return res.sendStatus(400);
  const result=await serial(async()=>{await authorized(req);const data=await catalog(),previous=data.tracks[req.params.space];delete data.tracks[req.params.space];await save(data);if(previous&&!Object.values(data.tracks).some(item=>item.file===previous.file))await unlink(path.join(directory,previous.file)).catch(()=>{});return view(data);});res.json(result);
 });
}
