'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),{randomUUID}=require('node:crypto');
const planner=import('../../../../packages/domain/file-kit.js');
const stamp=s=>`${s.dev}:${s.ino}:${s.size}:${s.mtimeMs}`;
async function regular(file){const s=await fs.lstat(file);if(!s.isFile()||s.isSymbolicLink())throw Error('Choose regular files, not folders or shortcuts');return stamp(s);}
// link() fails if the destination exists; unlike rename(), it never overwrites a file.
async function move(source,target){await fs.link(source,target);try{await fs.unlink(source);}catch(e){await fs.unlink(target).catch(()=>{});throw e;}}
function createFileKit(){let selection=null,undo=null,busy=false;
 async function choose(paths){if(busy)throw Error('Wait for the current rename');busy=true;try{if(!Array.isArray(paths)||!paths.length||paths.length>100)throw Error('Choose up to 100 files');const entries=[];for(const file of paths){const real=await fs.realpath(path.dirname(file));const full=path.join(real,path.basename(file));if(entries.some(e=>e.path===full))continue;entries.push({id:randomUUID(),name:path.basename(full),path:full,stamp:await regular(full)});}selection={id:randomUUID(),entries};return {id:selection.id,files:entries.map(({id,name})=>({id,name}))};}finally{busy=false;}}
 async function plan(id,options){if(!selection||id!==selection.id)throw Error('Choose your files again');return (await planner).planNames(selection.entries,options);}
 async function transaction(entries){const done=[];try{for(const e of entries){if(await regular(e.from)!==e.stamp)throw Error('A selected file changed. Choose the files again');await move(e.from,e.to);done.push(e);}}catch(error){let recovered=true;for(const e of done.reverse())try{await move(e.to,e.from);}catch{recovered=false;}throw Error(recovered?error.message:'Some names could not be restored. Review the selected folder before continuing');}}
 async function apply(id,options){if(busy)throw Error('Wait for the current rename');busy=true;try{const rows=await plan(id,options);if(rows.some(r=>r.error))throw Error('Fix the filename conflicts before renaming');const entries=rows.filter(r=>r.changed).map(row=>{const e=selection.entries.find(e=>e.id===row.id);return {from:e.path,to:path.join(path.dirname(e.path),row.to),stamp:e.stamp};});if(!entries.length)throw Error('Change at least one filename');for(const e of entries){try{await fs.lstat(e.to);throw Error('A destination filename already exists');}catch(error){if(error.code!=='ENOENT')throw error;}}
 await transaction(entries);undo={id:randomUUID(),entries:entries.map(e=>({from:e.to,to:e.from,stamp:e.stamp}))};selection=null;return {count:entries.length,undoId:undo.id};}finally{busy=false;}}
 async function revert(id){if(busy)throw Error('Wait for the current rename');if(!undo||undo.id!==id)throw Error('This undo is no longer available');busy=true;try{await transaction(undo.entries);const count=undo.entries.length;undo=null;selection=null;return {count};}finally{busy=false;}}
 return {choose,plan,apply,revert};
}
module.exports={createFileKit};
