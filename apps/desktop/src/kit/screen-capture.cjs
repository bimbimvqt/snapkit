'use strict';
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const run=promisify(execFile);
// Use the macOS capture tool when Chromium cannot produce screen thumbnails.
// Each request owns its temporary directory; never retain captures on disk.
async function captureMacScreens({displayCount,execute=run}){
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'snapkit-capture-'));
 try{
  const images=[];
  for(let index=1;index<=Math.min(8,Math.max(1,displayCount));index++){
   const file=path.join(directory,`screen-${index}.png`);
   try{
    await execute('/usr/sbin/screencapture',['-x','-t','png','-D',String(index),file],{timeout:10000,maxBuffer:64*1024});
    const info=await fs.stat(file);
    if(info.size<8||info.size>32*1024*1024)continue;
    const bytes=await fs.readFile(file);
    if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))continue;
    images.push({id:`mac-screen:${index}`,name:`Screen ${index}`,image:`data:image/png;base64,${bytes.toString('base64')}`});
   }catch{/* One unavailable display must not discard other captures. */}
  }
  return images;
 }finally{await fs.rm(directory,{recursive:true,force:true});}
}
module.exports={captureMacScreens};
