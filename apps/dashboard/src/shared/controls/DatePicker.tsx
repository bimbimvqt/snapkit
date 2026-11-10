import {lazy,Suspense,useEffect,useId,useRef,useState} from 'react';
import {Icon} from '../ui/icons';
import {t,useLanguage} from '../ui/use-language';
import './date-picker.css';

const Calendar=lazy(()=>import('./Calendar'));

const dateValue=(date?:Date)=>date?`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`:'';
export function DatePicker({name,defaultValue='',label}:{name:string;defaultValue?:string;label:string}){
 const language=useLanguage(),id=useId(),button=useRef<HTMLButtonElement>(null),popup=useRef<HTMLDivElement>(null);
 const [value,setValue]=useState(defaultValue),[open,setOpen]=useState(false);
 const selected=value?new Date(value+'T12:00:00'):undefined;
 function close(){setOpen(false);button.current?.focus({preventScroll:true});}
 useEffect(()=>{
  if(!open)return;const element=popup.current!,anchor=button.current!;
  function position(){const r=anchor.getBoundingClientRect(),width=Math.min(320,innerWidth-24),below=innerHeight-r.bottom-12,above=r.top-12,up=below<370&&above>below;Object.assign(element.style,{width:width+'px',left:Math.max(12,Math.min(r.left,innerWidth-width-12))+'px',top:up?'auto':r.bottom+6+'px',bottom:up?innerHeight-r.top+6+'px':'auto',maxHeight:Math.max(100,up?above:below)+'px'});}
  element.showPopover();position();element.querySelector<HTMLButtonElement>('.rdp-day_button[tabindex="0"]')?.focus({preventScroll:true});
  const outside=(e:Event)=>{if(!element.contains(e.target as Node)&&!anchor.contains(e.target as Node))setOpen(false);};
  const scroll=(e:Event)=>{if(!element.contains(e.target as Node))position();};
  document.addEventListener('pointerdown',outside,true);document.addEventListener('focusin',outside);document.addEventListener('scroll',scroll,true);window.addEventListener('resize',position);
  return()=>{if(element.isConnected&&element.matches(':popover-open'))element.hidePopover();document.removeEventListener('pointerdown',outside,true);document.removeEventListener('focusin',outside);document.removeEventListener('scroll',scroll,true);window.removeEventListener('resize',position);};
 },[open]);
 return <span className="snapkit-date-picker"><input type="hidden" name={name} value={value}/><button type="button" ref={button} className="snapkit-date-trigger" aria-label={label} aria-haspopup="dialog" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(!open)}><span>{selected?selected.toLocaleDateString(language==='vi'?'vi-VN':'en-US'):t('Choose date')}</span><Icon name="calendar"/></button><div ref={popup} id={id} popover="manual" role="dialog" aria-label={label} className="snapkit-date-popup" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}}}><div className="snapkit-date-calendar">{open&&<Suspense fallback={<p role="status">{t('Loading…')}</p>}><Calendar language={language} selected={selected} onSelect={date=>{setValue(dateValue(date));close();}}/></Suspense>}</div><footer><button type="button" onClick={()=>{setValue('');close();}}>{t('Clear date')}</button><button type="button" onClick={()=>{setValue(dateValue(new Date()));close();}}>{t('Today')}</button></footer></div></span>;
}
