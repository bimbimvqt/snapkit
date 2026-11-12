// Capture one frame from the screen the user selected in the macOS system picker.
export async function captureSystemScreen():Promise<Blob>{
 const stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:1},audio:false});
 const video=document.createElement('video');video.muted=true;video.srcObject=stream;
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  return await Promise.race([
   (async()=>{
    const frame=new Promise<void>(resolve=>video.requestVideoFrameCallback(()=>resolve()));
    await video.play();await frame;
    if(!video.videoWidth||!video.videoHeight)throw Error('No screen frame');
    const canvas=document.createElement('canvas');
    const scale=Math.min(1,Math.sqrt(24000000/(video.videoWidth*video.videoHeight)));
    canvas.width=Math.max(1,Math.floor(video.videoWidth*scale));canvas.height=Math.max(1,Math.floor(video.videoHeight*scale));
    canvas.getContext('2d')!.drawImage(video,0,0,canvas.width,canvas.height);
    return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Could not capture the screen')),'image/png'));
   })(),
   new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('No screen frame')),5000);})
  ]);
 }finally{
  clearTimeout(timer);for(const track of stream.getTracks())track.stop();video.pause();video.srcObject=null;
 }
}
