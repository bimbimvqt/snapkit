export const avatarStyles=['bottts-neutral','lorelei'];
export function validAvatar(value){
 if(value===null)return true;
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 if(value.type==='preset')return avatarStyles.includes(value.style)&&typeof value.seed==='string'&&/^[a-zA-Z0-9_-]{1,64}$/.test(value.seed);
 if(value.type!=='upload'||typeof value.data!=='string'||value.data.length>96000)return false;
 const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value.data);if(!match||match[2].length%4)return false;
 const bytes=Buffer.from(match[2],'base64');if(bytes.toString('base64')!==match[2]||bytes.length<16)return false;
 return match[1]==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):match[1]==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
}
export function cleanAvatar(value){return value===null?null:value.type==='preset'?{type:'preset',style:value.style,seed:value.seed}:{type:'upload',data:value.data};}
