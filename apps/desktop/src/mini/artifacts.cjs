'use strict';
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {createWriteStream}=require('node:fs');
const {rename,rm}=require('node:fs/promises');
const {Readable}=require('node:stream');
const {pipeline}=require('node:stream/promises');
const validId=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value);
function artifactsFor(job){
 if(job?.status!=='succeeded'||!validId(job.id))return [];
 return (job.artifacts||[]).filter(item=>validId(item.id)&&typeof item.name==='string'&&/\.(apk|ipa|aab)$/i.test(item.name)&&path.basename(item.name)===item.name&&!/[\\\x00-\x1f]/.test(item.name)).map(item=>({jobId:job.id,id:item.id,name:item.name,size:Number.isSafeInteger(item.size)&&item.size>=0?item.size:0}));
}
function completionTracker(){
 const seen=new Map();
 return {track(job){if(job?.id&&!['succeeded','failed','cancelled'].includes(seen.get(job.id)))seen.set(job.id,'building');},observe(jobs){const completed=[];for(const job of jobs||[]){const previous=seen.get(job.id);if(job.plan?.operation!=='run'&&['preparing','building','collecting'].includes(previous)&&['succeeded','failed'].includes(job.status))completed.push(job);seen.set(job.id,job.status);}while(seen.size>200)seen.delete(seen.keys().next().value);return completed;}};
}
async function saveArtifact(response,destination){
 if(!response.ok||!response.body)throw Error('Artifact unavailable');
 const temporary=path.join(path.dirname(destination),'.snapkit-'+randomUUID()+'.part');
 try{await pipeline(Readable.fromWeb(response.body),createWriteStream(temporary,{flags:'wx',mode:0o600}));await rename(temporary,destination);}finally{await rm(temporary,{force:true});}
}
module.exports={artifactsFor,completionTracker,saveArtifact};
