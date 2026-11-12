import {Children,isValidElement,useEffect,useId,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {Icon} from '../ui/icons';
import './select.css';
type Props={children:ReactNode;name?:string;value?:string;defaultValue?:string;disabled?:boolean;'aria-label'?:string;onChange?:(event:{target:{value:string}})=>void};
export function Select({children,name,value,defaultValue,disabled=false,'aria-label':label,onChange}:Props){
 const id=useId(),anchor=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null);
 const [local,setLocal]=useState(defaultValue??''),[open,setOpen]=useState(false),[query,setQuery]=useState('');
 const options=Children.toArray(children).filter(isValidElement).map(child=>{const p=child.props as {value:string;children:ReactNode;disabled?:boolean;'data-avatar'?:string;'data-initial'?:string};return {value:String(p.value),label:String(p.children),disabled:!!p.disabled,avatar:p['data-avatar'],initial:p['data-initial']};});
 const selected=options.find(o=>o.value===(value??local))??options[0];
 const visible=options.filter(o=>o.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
 function focus(index:number){const items=menu.current?.querySelectorAll<HTMLButtonElement>('[role=option]:not(:disabled)');const item=items?.[(index+(items?.length||1))%(items?.length||1)];item?.focus({preventScroll:true});if(item&&menu.current){const top=item.offsetTop,bottom=top+item.offsetHeight;if(top<menu.current.scrollTop)menu.current.scrollTop=top;else if(bottom>menu.current.scrollTop+menu.current.clientHeight)menu.current.scrollTop=bottom-menu.current.clientHeight;}}
 function close(restore=false){setOpen(false);if(restore)anchor.current?.focus({preventScroll:true});}
 useEffect(()=>{
  if(!open||disabled){if(menu.current?.matches(':popover-open'))menu.current.hidePopover();if(disabled&&open)setOpen(false);return;}
  const element=menu.current!,button=anchor.current!;
  function position(){const r=button.getBoundingClientRect(),width=Math.min(Math.max(r.width,200),innerWidth-20),below=innerHeight-r.bottom-16,above=r.top-16;const up=below<220&&above>below;Object.assign(element.style,{width:width+'px',left:Math.max(10,Math.min(r.left,innerWidth-width-10))+'px',top:up?'auto':r.bottom+6+'px',bottom:up?innerHeight-r.top+6+'px':'auto',maxHeight:Math.min(300,Math.max(90,up?above:below))+'px'});}
  element.showPopover();position();
  if(options.length>=8)element.querySelector<HTMLInputElement>('input')?.focus({preventScroll:true});else focus(Math.max(0,visible.findIndex(o=>o.value===selected?.value)));
  const outside=(e:Event)=>{if(!element.contains(e.target as Node)&&!button.contains(e.target as Node))close();};
  const scroll=(e:Event)=>{if(!element.contains(e.target as Node))position();};
  document.addEventListener('pointerdown',outside,true);document.addEventListener('focusin',outside);document.addEventListener('scroll',scroll,true);window.addEventListener('resize',position);
  return()=>{if(element.isConnected&&element.matches(':popover-open'))element.hidePopover();document.removeEventListener('pointerdown',outside,true);document.removeEventListener('focusin',outside);document.removeEventListener('scroll',scroll,true);window.removeEventListener('resize',position);};
 },[open,disabled]);
 return <span className="react-choice">
  {name&&<input type="hidden" name={name} value={selected?.value??''} disabled={disabled}/>}
  <button ref={anchor} type="button" className="choice-trigger" role="combobox" aria-label={label} aria-expanded={open&&!disabled} aria-haspopup="listbox" aria-controls={id} disabled={disabled||!options.length} onClick={()=>{setQuery('');setOpen(!open);}} onKeyDown={e=>{if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();setQuery('');setOpen(true);}if(e.key==='Escape')close();}}><span className="choice-value">{selected?.initial&&<span className="choice-avatar" aria-hidden="true">{selected.avatar?<img src={selected.avatar} alt=""/>:selected.initial}</span>}{selected?.label||'—'}</span><Icon name="chevron-down"/></button>
  <div ref={menu} className="react-choice-popup" popover="manual" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(true);}if(e.key==='Tab')close(true);}}>
   {options.length>=8&&<input type="search" aria-label={window.SnapkitI18n.t('Search options')} placeholder={window.SnapkitI18n.t('Search options…')} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();focus(0);}}}/>}
   <div id={id} role="listbox" aria-label={label}>{visible.map(o=><button type="button" role="option" className="choice-option" aria-selected={o.value===selected?.value} disabled={o.disabled} key={o.value} onClick={()=>{setLocal(o.value);onChange?.({target:{value:o.value}});close(true);}} onKeyDown={e=>{const items=[...(menu.current?.querySelectorAll('[role=option]:not(:disabled)')||[])],index=items.indexOf(e.currentTarget);const next=e.key==='ArrowDown'?index+1:e.key==='ArrowUp'?index-1:e.key==='Home'?0:e.key==='End'?items.length-1:null;if(next!==null){e.preventDefault();focus(next);}}}><span className="choice-option-label">{o.initial&&<span className="choice-avatar" aria-hidden="true">{o.avatar?<img src={o.avatar} alt="" loading="lazy"/>:o.initial}</span>}{o.label}</span>{o.value===selected?.value&&<Icon name="check"/>}</button>)}</div>
   {!visible.length&&<p role="status">{window.SnapkitI18n.t('No matching options')}</p>}
  </div>
 </span>;
}
