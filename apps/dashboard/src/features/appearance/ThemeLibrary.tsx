import {useEffect,useRef,useState,useSyncExternalStore,type CSSProperties} from 'react';
import {activeTheme,isPresetTheme,themeScenes,themeTokens} from '../../../../../packages/domain/personal-themes.js';
import {focusAction,useFocusExperience} from '../kit/focus-store';
import type {PersonalTheme} from '../updates/model';
import {t,useLanguage} from '../../shared/ui/use-language';
import {Select} from '../../shared/controls/Select';
import './themes.css';
const viText:Record<string,string>={'Your themes':'Theme của bạn','A space that feels like you, across all of Snapkit.':'Không gian theo sở thích, trên toàn bộ Snapkit.','New theme':'Tạo theme','Customize':'Tùy chỉnh','Edit theme':'Sửa theme','Theme name':'Tên theme','Scenery':'Cảnh nền','Accent color':'Màu nhấn','Background color':'Màu nền','Save and apply':'Lưu và áp dụng','Cancel':'Hủy','Delete theme':'Xóa theme','Remove this theme? Your garden and focus progress are kept.':'Xóa theme này? Khu vườn và tiến trình tập trung vẫn được giữ lại.','Applied throughout Snapkit':'Áp dụng trên toàn Snapkit','My space':'Không gian của tôi','Theme library is full. Delete a custom theme to add another.':'Thư viện đã đầy. Hãy xóa một theme tự tạo để thêm theme mới.','Could not save theme. Please try again.':'Không thể lưu theme. Hãy thử lại.'};
export function ThemeLibrary(){
 const language=useLanguage(),{value,ready,error}=useFocusExperience();
 const label=(key:string)=>language==='vi'?(viText[key]||t(key)):key;
 const [draft,setDraft]=useState<PersonalTheme|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[deleting,setDeleting]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null),opener=useRef<HTMLElement|null>(null);
 useEffect(()=>{if(draft&&!dialog.current?.open)dialog.current?.showModal();},[draft]);
 function close(){dialog.current?.close();setDraft(null);setDeleting(false);setMessage('');opener.current?.focus();}
 function edit(theme:PersonalTheme,fresh=false){opener.current=document.activeElement as HTMLElement;setMessage('');setDeleting(false);setDraft({...theme,id:fresh||isPresetTheme(theme.id)?'custom-'+crypto.randomUUID():theme.id,name:fresh||isPresetTheme(theme.id)?label('My space'):theme.name});}
 async function save(){if(!draft||busy)return;if(!value.themes.some(x=>x.id===draft.id)&&value.themes.length>=68){setMessage(label('Theme library is full. Delete a custom theme to add another.'));return;}setBusy(true);try{if(await focusAction({type:'theme:save',theme:draft}))close();else setMessage(label('Could not save theme. Please try again.'));}finally{setBusy(false);}}
 const name=(theme:PersonalTheme)=>isPresetTheme(theme.id)?t(theme.name):theme.name;
 const light=useSyncExternalStore(notify=>{document.addEventListener('snapkit:appearance',notify);return()=>document.removeEventListener('snapkit:appearance',notify);},()=>document.documentElement.classList.contains('light'));
 function preview(theme:PersonalTheme){return <span className="theme-app-preview" style={themeTokens(theme,light) as CSSProperties} aria-hidden="true"><span className="theme-preview-side"><b/><b/><b/></span><span className="theme-preview-body"><strong/><span/><span/><i/></span></span>;}
 return <section className="theme-library" aria-label={label('Your themes')}>
  <div className="theme-library-heading"><div><h3>{label('Your themes')}</h3><p>{label('A space that feels like you, across all of Snapkit.')}</p></div><button className="button" disabled={!ready||busy} onClick={()=>edit(activeTheme(value),true)}>＋ {label('New theme')}</button></div>
  <div className="theme-library-grid">{value.themes.map(theme=><div className="theme-tile" key={theme.id} data-selected={value.space===theme.id}><button className="theme-select" aria-label={name(theme)} aria-pressed={value.space===theme.id} disabled={!ready||busy} onClick={()=>void focusAction({type:'space',value:theme.id})}>{preview(theme)}<span>{name(theme)}<b aria-hidden="true">{value.space===theme.id?'✓':''}</b></span></button><button className="theme-edit" aria-label={`${label('Customize')} ${name(theme)}`} disabled={!ready||busy} onClick={()=>edit(theme)}>{label('Customize')}</button></div>)}</div>
  {error&&<p role="alert">{t(error)}</p>}
  <dialog ref={dialog} className="theme-dialog" onCancel={e=>{e.preventDefault();if(!busy)close();}} aria-labelledby="theme-editor-title">
   {draft&&<form onSubmit={e=>{e.preventDefault();void save();}}><header><div><h2 id="theme-editor-title">{label('Edit theme')}</h2><p>{label('Applied throughout Snapkit')}</p></div><button type="button" className="button" aria-label={label('Cancel')} disabled={busy} onClick={close}>×</button></header>
    {preview(draft)}
    <label>{label('Theme name')}<input required autoFocus maxLength={40} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
    <label>{label('Scenery')}<Select value={draft.scene} onChange={e=>setDraft({...draft,scene:e.target.value})}>{themeScenes.map((scene:string)=><option value={scene} key={scene}>{t(({forest:'Quiet forest',rain:'Rainy day',cafe:'Cozy café',night:'Starry night',gradient:'Gradient'} as Record<string,string>)[scene])}</option>)}</Select></label>
    <div className="theme-colors"><label>{label('Accent color')}<input type="color" value={draft.accent} onChange={e=>setDraft({...draft,accent:e.target.value})}/></label><label>{label('Background color')}<input type="color" value={draft.background} onChange={e=>setDraft({...draft,background:e.target.value})}/></label></div>
    {message&&<p role="alert">{message}</p>}
    {value.themes.some(theme=>theme.id===draft.id)&&<div className="theme-delete">{deleting?<><p>{label('Remove this theme? Your garden and focus progress are kept.')}</p><button type="button" className="button" disabled={busy} onClick={async()=>{setBusy(true);try{if(await focusAction({type:'theme:delete',value:draft.id}))close();else setMessage(label('Could not save theme. Please try again.'));}finally{setBusy(false);}}}>{label('Delete theme')}</button></>:<button className="text-button" type="button" onClick={()=>setDeleting(true)}>{label('Delete theme')}</button>}</div>}
    <footer><button className="button" type="button" disabled={busy} onClick={close}>{label('Cancel')}</button><button className="button primary" disabled={busy||!draft.name.trim()}>{label('Save and apply')}</button></footer>
   </form>}
  </dialog>
 </section>;
}
