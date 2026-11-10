export const projectIcons=['folder-code','smartphone','layers','code-xml','package','gem','flask-conical','shield-check'];
// Raster data only; no remote URLs, SVG or executable documents.
export function validProjectIcon(value){
 if(projectIcons.includes(value))return true;
 if(typeof value!=='string'||value.length>100000)return false;
 const match=/^data:image\/(png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
 if(!match)return false;
 try{const bytes=atob(match[2]);return match[1]==='png'?bytes.startsWith('\x89PNG\r\n\x1a\n')&&bytes.length>=33:bytes.startsWith('RIFF')&&bytes.slice(8,12)==='WEBP'&&bytes.length>=20;}catch{return false;}
}
