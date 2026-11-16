'use strict';
// Only allow fields intended for the widget across its isolated preload bridge.
function debugControls(state, launch) {
 const settings=state?.settings||{},ids=settings.targetIds||[];
 const devices=(state?.devices||[]).filter(d=>ids.includes(d.id));
 const active=(state?.debugSessions||[]).filter(s=>devices.some(d=>[d.id,d.flutterId].includes(s.deviceId)));
 const flutter=settings.framework!=='react-native'&&settings.framework!=='backend';
 return {selected:ids.length,active:active.length,canRun:!state?.authRequired&&flutter&&!!settings.workspace&&ids.length>0&&devices.length===ids.length&&devices.every(d=>d.state==='online'&&d.flutterId)&&!active.length&&launch?.status!=='queued',canControl:!state?.authRequired&&active.length>0,flutter,flavor:settings.flavor||'',target:settings.target||'lib/main.dart',launch:launch?{status:launch.status,error:launch.error||''}:null};
}
function debugSummary(state,releases){
 const sessions=Array.isArray(state.debugSessions)?state.debugSessions:[];
 const devices=(state.devices||[]).filter(device=>device.state==='online'||sessions.some(session=>session.deviceId===device.id));
 const jobs=releases?.jobs||[],active=jobs.find(job=>job.id===releases?.active?.id)||jobs.find(job=>['preparing','building','collecting'].includes(job.status)||job.uploadStatus==='uploading');
 return {devices:devices.slice(0,2).map(device=>({name:String(device.name||device.platform||'Device').slice(0,100),platform:device.platform==='ios'?'iOS':'Android',debugging:sessions.some(session=>session.deviceId===device.id)})),deviceCount:devices.length,sessions:sessions.length,build:active?{format:['apk','aab','ipa'].includes(active.plan?.format)?active.plan.format.toUpperCase():'Build',status:['preparing','building','collecting'].includes(active.status)?active.status:'running',upload:active.uploadStatus==='uploading'}:null,unavailable:!!state.authRequired,releaseUnavailable:!releases};
}
module.exports={debugSummary,debugControls};
