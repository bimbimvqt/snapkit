import {useRef,useState} from 'react';
import {projectIcons} from '../../../../../packages/domain/project-identity.js';
import {Icon} from '../../shared/ui/icons';
import {t} from '../../shared/ui/use-language';
const labels:Record<string,string>={'folder-code':'Project folder',smartphone:'Mobile app',layers:'Platform','code-xml':'Backend',package:'Package',gem:'Product','flask-conical':'Testing','shield-check':'Security'};
export function ProjectIcon({value}:{value?:string}){return <span className="project-icon" aria-hidden="true">{value?.startsWith('data:image/')?<img src={value} alt=""/>:<Icon name={projectIcons.includes(value||'')?value!:'folder-code'}/>}</span>;}
export function ProjectIconPicker({initial,onBusy}:{initial?:string;onBusy:(busy:boolean)=>void}){
 const [value,setValue]=useState(initial||'folder-code'),[error,setError]=useState(''),[loading,setLoading]=useState(false);const file=useRef<HTMLInputElement>(null);
 async function upload(image:File|undefined){
  if(!image)return;setError('');setLoading(true);onBusy(true);
  try{
   if(!['image/png','image/jpeg','image/webp'].includes(image.type)||image.size>5*1024*1024)throw Error('Choose a PNG, JPEG or WebP image under 5 MB.');
   const bitmap=await createImageBitmap(image);try{
    if(!bitmap.width||!bitmap.height)throw Error('Could not read this image.');
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d')!;
    const scale=Math.min(128/bitmap.width,128/bitmap.height),w=bitmap.width*scale,h=bitmap.height*scale;
    ctx.drawImage(bitmap,(128-w)/2,(128-h)/2,w,h);setValue(canvas.toDataURL('image/png'));
   }finally{bitmap.close();}
  }catch(e){setError(e instanceof Error?e.message:'Could not read this image.');}finally{setLoading(false);onBusy(false);if(file.current)file.current.value='';}
 }
 return <div className="teams-icon-picker"><span>{t('Project icon')}</span><input type="hidden" name="icon" value={value}/><div className="teams-icon-preview"><ProjectIcon value={value}/><div><button type="button" className="button" disabled={loading} onClick={()=>file.current?.click()}><Icon name="image"/>{t(loading?'Loading…':'Upload icon')}</button><small>PNG, JPG, WebP · 5 MB</small></div></div><input ref={file} className="sr-only" tabIndex={-1} type="file" accept="image/png,image/jpeg,image/webp" aria-label={t('Upload project icon')} onChange={e=>void upload(e.target.files?.[0])}/><div role="group" aria-label={t('Choose project icon')} className="teams-icon-options">{projectIcons.map(icon=><button type="button" key={icon} aria-label={t(labels[icon])} title={t(labels[icon])} aria-pressed={value===icon} onClick={()=>{setValue(icon);setError('');}}><Icon name={icon}/></button>)}</div>{error&&<p className="teams-error" role="alert">{t(error)}</p>}</div>;
}
