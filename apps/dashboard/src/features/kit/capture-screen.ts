type CaptureConstraints=MediaTrackConstraints&{resizeMode?:string};
type CaptureCapabilities=MediaTrackCapabilities&{resizeMode?:string[]};
type CaptureSettings=MediaTrackSettings&{resizeMode?:string};
// Keep the selected source at its native resolution rather than a video-call
// thumbnail. Negotiate on the selected track: initial display-media ideals can
// be ignored by Chromium's native picker.
async function fullResolution(track:MediaStreamTrack){
 track.contentHint='detail';
 const caps=track.getCapabilities() as CaptureCapabilities,settings=track.getSettings() as CaptureSettings;
 const width=caps.width?.max,height=caps.height?.max;
 const constraints:CaptureConstraints={};
 if(caps.resizeMode?.includes('none')&&settings.resizeMode!=='none')constraints.resizeMode='none';
 if(width&&height&&(width>(settings.width||0)||height>(settings.height||0))){
  const scale=Math.min(1,Math.sqrt(24000000/(width*height)));
  constraints.width={ideal:Math.floor(width*scale)};constraints.height={ideal:Math.floor(height*scale)};
 }
 if(Object.keys(constraints).length){
  try{await track.applyConstraints(constraints);}catch{
   // Some platforms reject resizeMode but still accept native dimensions.
   delete constraints.resizeMode;if(Object.keys(constraints).length)await track.applyConstraints(constraints);
  }
 }
}
// Capture one full-resolution frame from the user's selected screen.
export async function captureSystemScreen():Promise<Blob>{
 const videoConstraints:CaptureConstraints={displaySurface:'monitor',resizeMode:'none',width:{ideal:7680},height:{ideal:4320},frameRate:{ideal:5,max:5}};
 const stream=await navigator.mediaDevices.getDisplayMedia({video:videoConstraints,audio:false});
 const video=document.createElement('video');video.muted=true;
 let timer:ReturnType<typeof setTimeout>|undefined,frameId:number|undefined,cancelled=false;
 try{
  // The native selection is authoritative even if Electron reports window/browser.
  return await Promise.race([
   (async()=>{
    const track=stream.getVideoTracks()[0];if(!track)throw Error('No screen frame');
    await fullResolution(track);if(cancelled)throw Error('Capture timed out');video.srcObject=stream;
    const expected=track.getSettings();
    // Register before play, and ignore a stale initial frame if the track has
    // just changed resolution. Static content may only deliver a single frame.
    const frame=new Promise<void>(resolve=>{
     const check=()=>{if(video.videoWidth>=(expected.width||1)&&video.videoHeight>=(expected.height||1))resolve();else frameId=video.requestVideoFrameCallback(check);};
     frameId=video.requestVideoFrameCallback(check);
    });
    await video.play();await frame;
    if(!video.videoWidth||!video.videoHeight)throw Error('No screen frame');
    const canvas=document.createElement('canvas');
    const scale=Math.min(1,Math.sqrt(24000000/(video.videoWidth*video.videoHeight)));
    canvas.width=Math.max(1,Math.floor(video.videoWidth*scale));canvas.height=Math.max(1,Math.floor(video.videoHeight*scale));
    const ctx=canvas.getContext('2d')!;ctx.imageSmoothingQuality='high';ctx.drawImage(video,0,0,canvas.width,canvas.height);
    return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Could not capture the screen')),'image/png'));
   })(),
   new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('No screen frame')),8000);})
  ]);
 }finally{
  cancelled=true;clearTimeout(timer);if(frameId!==undefined)video.cancelVideoFrameCallback(frameId);for(const track of stream.getTracks())track.stop();video.pause();video.srcObject=null;
 }
}
