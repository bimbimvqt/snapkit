'use strict';
const {createHash}=require('node:crypto');
const path=require('node:path');
const key=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,24);
const profileId=p=>key([p.flavor||'',p.target||'lib/main.dart',p.defineFile||'']);
function profileFor(catalog,platform,environment,saved){
 const native=catalog?.[platform==='ios'?'iosFlavors':'androidFlavors']||[];
 const profiles=(catalog?.profiles||[]).filter(p=>!p.review&&(!native.length||native.includes(p.flavor||'')));
 const explicit=profiles.find(p=>profileId(p)===saved);if(explicit)return explicit;
 if(saved)return null;
 const aliases=environment==='prod'?['prod','production']:['dev','development'];
 const matches=profiles.filter(p=>aliases.includes(String(p.flavor||'').toLowerCase())||!p.flavor&&aliases.includes(String(p.name||'').toLowerCase()));
 return matches.length===1?matches[0]:null;
}
function buildView(state,catalog,releases,selection,mappings,starting=false){
 const workspace=state?.settings?.workspace,projectKey=workspace?key(workspace):'',platform=selection.platform,environment=selection.environment;
 const saved=mappings?.[projectKey]?.[platform+':'+environment],profile=profileFor(catalog,platform,environment,saved);
 const native=catalog?.[platform==='ios'?'iosFlavors':'androidFlavors']||[],profiles=(catalog?.profiles||[]).filter(p=>!p.review&&(!native.length||native.includes(p.flavor||'')));
 const android=!!catalog?.android,ios=!!catalog?.ios&&catalog.platform==='darwin',supported=state?.settings?.framework!=='react-native',available=platform==='ios'?ios:android;
 const latest=(releases?.jobs||[])[0],active=(releases?.jobs||[]).find(job=>job.id===releases?.active?.id),busy=starting||!!releases?.busy;
 const matches=latest&&profile&&latest.plan?.format===(platform==='ios'?'ipa':'apk')&&(latest.plan?.flavor||'')===(profile.flavor||'')&&(latest.plan?.target||'lib/main.dart')===(profile.target||'lib/main.dart')&&(latest.plan?.defineFile||'')===(profile.defineFile||'');
 const result=active||(matches?latest:null),reason=!state?'loading':state.authRequired?'signin':!workspace?'workspace':!supported?'framework':!catalog?'catalog':!releases?'loading':!available?'platform':!profile?'profile':busy?'busy':'';
 return {project:String(state?.settings?.spaceName||(workspace?path.basename(workspace):'')).slice(0,80),platform,environment,android,ios,profile:profile?String(profile.name||profile.flavor||'Default').slice(0,80):'',profileId:profile?profileId(profile):'',profiles:profiles.slice(0,40).map(p=>({id:profileId(p),name:String(p.name||p.flavor||'Default').slice(0,80)})),canBuild:!reason,reason,busy,activeFormat:active&&['apk','aab','ipa'].includes(active.plan?.format)?active.plan.format.toUpperCase():'',activeFlavor:active?String(active.plan?.flavor||'').slice(0,40):'',canCancel:!!active&&!!workspace&&releases.active?.workspace===workspace&&['preparing','building','collecting'].includes(active.status),status:starting?'starting':result?(['preparing','building','collecting','succeeded','failed','cancelled','interrupted'].includes(result.status)?result.status:'idle'):'idle'};
}
module.exports={key,profileId,profileFor,buildView};
