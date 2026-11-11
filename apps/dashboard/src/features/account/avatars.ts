import {createAvatar} from '@dicebear/core';
import * as robots from '@dicebear/bottts-neutral';
import * as portraits from '@dicebear/lorelei';
export type AvatarStyle='bottts-neutral'|'lorelei';
export type Avatar={type:'preset';style:AvatarStyle;seed:string}|{type:'upload';data:string}|null;
const cache=new Map<string,string>();
export function avatarSource(avatar:Avatar|undefined):string{
 if(!avatar)return '';
 if(avatar.type==='upload')return /^data:image\/(png|jpeg|webp);base64,/.test(avatar.data)?avatar.data:'';
 if(avatar.type!=='preset'||!['bottts-neutral','lorelei'].includes(avatar.style)||!/^[a-zA-Z0-9_-]{1,64}$/.test(avatar.seed))return '';
 const key=avatar.style+':'+avatar.seed;if(cache.has(key))return cache.get(key)!;
 const options={seed:avatar.seed,size:256,backgroundColor:['d1e7c8','c8dfeb','eedcc8','e1d5ec','f2e9bc']};const value=(avatar.style==='lorelei'?createAvatar(portraits,options):createAvatar(robots,options)).toDataUri();if(cache.size>=128)cache.delete(cache.keys().next().value!);cache.set(key,value);return value;
}
export async function uploadAvatar(file:File):Promise<Avatar>{
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024)throw Error('Choose a PNG, JPG or WebP image up to 5 MB.');
 const bitmap=await createImageBitmap(file).catch(()=>{throw Error('Could not read this image. Choose another one.');});
 try{if(!bitmap.width||!bitmap.height||bitmap.width*bitmap.height>40000000)throw Error('This image is too large. Choose a smaller one.');const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Could not read this image. Choose another one.');ctx.fillStyle='#e2e8dc';ctx.fillRect(0,0,256,256);const side=Math.min(bitmap.width,bitmap.height);ctx.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,256,256);const data=canvas.toDataURL('image/jpeg',.85);if(data.length>96000)throw Error('This image is too large. Choose a smaller one.');return {type:'upload',data};}finally{bitmap.close();}
}
