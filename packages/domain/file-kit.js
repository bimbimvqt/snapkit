// Filename planning is shared by the browser preview and the desktop apply step.
export function planNames(files, input={}) {
 if(!Array.isArray(files)||files.length>100)throw Error('Choose up to 100 files');
 const options={};for(const key of ['prefix','suffix','find','replacement']){const v=input[key]??'';if(typeof v!=='string'||v.length>80)throw Error('Use shorter filename settings');options[key]=v;}
 const start=input.start??1;if(!Number.isInteger(start)||start<1||start>999999)throw Error('Choose a starting number between 1 and 999999');
 const rows=files.map((file,index)=>{const from=file.name;if(typeof from!=='string')throw Error('Invalid file selection');const dot=from.lastIndexOf('.'),extension=dot>0?from.slice(dot):'',stem=dot>0?from.slice(0,dot):from;let name=options.find?stem.split(options.find).join(options.replacement):stem;
 name=options.prefix+(input.numbering===true?String(start+index).padStart(3,'0')+'-':'')+name+options.suffix+extension;
 const bad=/[\x00-\x1f<>:"/\\|?*]/.test(name)||/[. ]$/.test(name)||!name||name==='.'||name==='..'||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)||new TextEncoder().encode(name).length>240;
 return {id:file.id??String(index),from,to:name,changed:name!==from,error:bad?'Use a valid filename for macOS and Windows':''};});
 const keys=rows.map(r=>r.to.normalize('NFC').toLowerCase());return rows.map((r,i)=>({...r,error:r.error||(keys.some((key,n)=>n!==i&&key===keys[i])?'Two files would have the same name':'')}));
}
