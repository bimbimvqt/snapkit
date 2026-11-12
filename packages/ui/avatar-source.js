import {createAvatar} from '@dicebear/core';
import * as robots from '@dicebear/bottts-neutral';
import * as portraits from '@dicebear/lorelei';
const cache=new Map();
/** @param {{type:'preset',style:string,seed:string}|{type:'upload',data:string}|null|undefined} avatar */
export function avatarSource(avatar){
 if(!avatar)return '';
 if(avatar.type==='upload')return /^data:image\/(png|jpeg|webp);base64,/.test(avatar.data)?avatar.data:'';
 if(avatar.type!=='preset'||!['bottts-neutral','lorelei'].includes(avatar.style)||!/^[a-zA-Z0-9_-]{1,64}$/.test(avatar.seed))return '';
 const key=avatar.style+':'+avatar.seed;if(cache.has(key))return cache.get(key);
 const options={seed:avatar.seed,size:256,backgroundColor:['d1e7c8','c8dfeb','eedcc8','e1d5ec','f2e9bc']};const value=(avatar.style==='lorelei'?createAvatar(portraits,options):createAvatar(robots,options)).toDataUri();if(cache.size>=128)cache.delete(cache.keys().next().value);cache.set(key,value);return value;
}
