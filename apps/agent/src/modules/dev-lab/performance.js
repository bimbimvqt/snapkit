import {performance} from 'node:perf_hooks';
import {androidMetrics} from '../../../../../packages/domain/dev-lab.js';
export async function measureApp({device,appId,run,workload,signal}){
 if(!/^[a-zA-Z][a-zA-Z0-9_]*(?:[.][a-zA-Z0-9_-]+)+$/.test(appId))throw Error('Enter a valid package or bundle identifier');
 const command=(name,args)=>run(name,args,{signal,timeout:30000});
 if(device.platform==='android'){
  const adb=args=>command('adb',['-s',device.connection,'shell',...args]);
  const component=(await adb(['cmd','package','resolve-activity','--brief',appId])).trim().split(/\r?\n/).at(-1);
  if(!component?.startsWith(appId+'/')||!/^[A-Za-z0-9_.]+\/[A-Za-z0-9_.]+$/.test(component))throw Error('Could not resolve the installed app launcher activity');
  const metadata=await adb(['dumpsys','package',appId]);
  await adb(['dumpsys','gfxinfo',appId,'reset']);
  const startup=await adb(['am','start','-W','-S','-n',component]);
  if(!/Status:\s*ok/.test(startup)||!/TotalTime:\s*\d+/.test(startup))throw Error('Android did not return a successful startup measurement');
  await workload();
  const memory=await adb(['dumpsys','meminfo',appId]),frames=await adb(['dumpsys','gfxinfo',appId]);
  return {method:'android-am-total-pss-hwui-v1',version:metadata.match(/versionName=([^\s]+)/)?.[1]||'',build:metadata.match(/versionCode=(\d+)/)?.[1]||'',metrics:androidMetrics({startup,memory,frames}),notes:['Startup is am start TotalTime after force-stop. Memory is end-of-run PSS. HWUI jank does not measure all Flutter/React Native engine frames.']};
 }
 const started=performance.now();
 const result=await command('xcrun',['simctl','launch','--terminate-running-process',device.connection,appId]);
 const elapsed=performance.now()-started,pid=result.match(/:\s*(\d+)\s*$/)?.[1];
 if(!pid)throw Error('iOS Simulator did not return an app process');
 await workload();
 let memoryMB=null;try{const raw=await command('ps',['-o','rss=','-p',pid]);if(/^\s*\d+\s*$/.test(raw))memoryMB=Number(raw.trim())/1024;}catch(error){if(signal.aborted)throw error;}
 return {method:'ios-sim-launch-command-rss-v1',version:'',build:'',metrics:{startupMs:elapsed,memoryMB,hwuiJankPercent:null,totalFrames:null,jankyFrames:null},notes:['iOS startup measures simctl command duration, not first rendered frame. Memory is host RSS for the Simulator app process. Frame jank is unavailable; use Instruments for rendering analysis.']};
}
