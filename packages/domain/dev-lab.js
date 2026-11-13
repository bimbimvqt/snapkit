export function androidMetrics({startup='',memory='',frames=''}) {
 const number=(text,pattern)=>{const match=pattern.exec(text);return match?Number(match[1]):null;};
 const totalFrames=number(frames,/Total frames rendered:\s*(\d+)/i),jankyFrames=number(frames,/Janky frames:\s*(\d+)/i);
 const pss=number(memory,/TOTAL PSS:\s*(\d+)/i)??number(memory,/^\s*TOTAL\s+(\d+)/m);
 return {startupMs:number(startup,/TotalTime:\s*(\d+)/),memoryMB:pss===null?null:pss/1024,hwuiJankPercent:totalFrames&&jankyFrames!==null?jankyFrames/totalFrames*100:null,totalFrames,jankyFrames};
}
export function compareMeasurements(baseline,candidate){
 if(!baseline||!candidate||baseline.id===candidate.id)throw Error('Choose two different completed measurements');
 if(!baseline.metrics||!candidate.metrics)throw Error('Choose performance measurements');
 if(baseline.status!=='succeeded'||candidate.status!=='succeeded')throw Error('Both measurements must have succeeded');
 for(const field of ['project','appId','deviceId','os','method','workload'])if(baseline[field]!==candidate[field])throw Error('Compare the same app, device, OS, measurement method and workload');
 return ['startupMs','memoryMB','hwuiJankPercent'].map(metric=>{const before=baseline.metrics[metric],after=candidate.metrics[metric];const available=Number.isFinite(before)&&Number.isFinite(after);return {metric,before:available?before:null,after:available?after:null,delta:available?after-before:null,percent:available&&before!==0?(after-before)/before*100:null};});
}
