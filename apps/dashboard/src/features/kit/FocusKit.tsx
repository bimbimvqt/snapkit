import {useEffect,useState,type CSSProperties} from 'react';
import {toast} from '../../legacy/device-controller.js';
import {Select} from '../../shared/controls/Select';
import {Icon} from '../../shared/ui/icons';
import {t,useLanguage} from '../../shared/ui/use-language';
import {gardenProgress,plants} from '../../../../../packages/domain/focus-garden.js';
import {focusAction,useFocusExperience} from './focus-store';
import '../../../../../packages/ui/focus/focus.css';
import './focus.css';
import {activeTheme,isPresetTheme} from '../../../../../packages/domain/personal-themes.js';
import {ThemeLibrary} from '../appearance/ThemeLibrary';
const plantNames:Record<string,string>={oak:'Oak',pine:'Pine',blossom:'Cherry blossom'};
const stages=['A seed, a fresh start.','Your seed is sprouting.','Growing at your own pace.','Almost a tree.'];
export function FocusKit(){
 useLanguage();const {value,ready,error}=useFocusExperience();const theme=activeTheme(value);const [now,setNow]=useState(Date.now()),[busy,setBusy]=useState(false);
 const {timer}=value,seconds=timer.deadline?Math.max(0,Math.ceil((timer.deadline-now)/1000)):timer.remaining,progress=gardenProgress(value);
 useEffect(()=>{if(!timer.deadline)return;setNow(Date.now());const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id);},[timer.deadline]);
 async function act(action:Parameters<typeof focusAction>[0]){if(busy||!ready)return;setBusy(true);try{await focusAction(action);}finally{setNow(Date.now());setBusy(false);}}
 return <section className="kit-card kit-focus" aria-busy={!ready||busy}>
  <header><Icon name="focus"/><h2>{t('Focus Kit')}</h2>{window.snapkitDesktop?.miniOpen&&<button className="button" onClick={()=>void window.snapkitDesktop!.miniOpen!().catch(()=>toast('Could not open widget',true))}>{t('Open floating widget')}</button>}</header>
  <p>{t('A little space to focus. A garden that grows with you.')}</p>
  <div className="focus-world" data-space={theme.scene} style={{'--scene-color':theme.background} as CSSProperties}>
   <div className="focus-world-content"><span className="focus-eyebrow">{isPresetTheme(theme.id)?t(theme.name):theme.name}</span><h3>{t(timer.deadline?'One thing at a time.':'Make room for yourself.')}</h3><div className="kit-timer" role="timer" aria-label={t('Focus time remaining')}>{Math.floor(seconds/60).toString().padStart(2,'0')}:{(seconds%60).toString().padStart(2,'0')}</div><span className="focus-world-status">{t(timer.deadline?'Focusing':timer.remaining===0?'Focus complete. Take a break.':'Ready when you are.')}</span></div>
   <div className="focus-world-garden" aria-hidden="true">{Array.from({length:Math.min(progress.trees,4)},(_,i)=><span key={i} className="focus-plant focus-grown" data-plant={value.plant} data-stage="3"/>)}<span className="focus-plant focus-current" data-plant={value.plant} data-stage={progress.stage}/></div>
  </div>
  <div className="focus-controls"><label className="kit-field">{t('Session length')}<Select aria-label={t('Session length')} value={String(value.sessionSeconds/60)} disabled={!ready||busy||timer.deadline!==null} onChange={e=>void act({type:'duration',seconds:Number(e.target.value)*60})}>{['5','15','25','45','60'].map(n=><option key={n} value={n}>{t('{0} minutes',[n])}</option>)}</Select></label><div className="kit-actions"><button className="button primary" disabled={!ready||busy||!!error} onClick={()=>void act({type:'toggle'})}><Icon name={timer.deadline?'square':'play'}/>{t(timer.deadline?'Pause focus':'Start focus')}</button><button className="button" disabled={!ready||busy} onClick={()=>void act({type:'reset',seconds:value.sessionSeconds})}>{t('Reset')}</button></div></div>
  {timer.remaining===0&&timer.deadline===null&&<p className="focus-complete" role="status">{t('Focus complete. Take a break.')} {t('Your garden has grown a little.')}</p>}
  {error&&<p role="alert">{t(error)} <button className="text-button" onClick={()=>location.reload()}>{t('Reload')}</button></p>}
  <ThemeLibrary/>
  <section className="focus-garden" aria-label={t('Your garden')}><div className="focus-garden-top"><div><span className="focus-eyebrow">{t('YOUR GARDEN')}</span><h3>{t(stages[progress.stage])}</h3><p>{t('Completed sessions nourish your garden. Days off never take anything away.')}</p></div><span className="focus-plant" data-plant={value.plant} data-stage={progress.stage} role="img" aria-label={t(stages[progress.stage])}/></div>
   <div className="focus-garden-stats"><span><strong>{value.completed}</strong>{t('Completed sessions')}</span><span><strong>{progress.minutes}</strong>{t('Focus minutes')}</span><span><strong>{progress.trees}</strong>{t('Grown trees')}</span></div>
   <label className="focus-growth-label" htmlFor="focus-growth">{t('{0} more focus minutes to grow a tree',[progress.remaining])}</label><progress id="focus-growth" value={progress.growth} max="100"/>
   <label className="kit-field">{t('Garden style')}<Select aria-label={t('Garden style')} value={value.plant} disabled={!ready||busy} onChange={e=>void act({type:'plant',value:e.target.value})}>{plants.map(plant=><option key={plant} value={plant}>{t(plantNames[plant])}</option>)}</Select></label>
   <p className="kit-note">{t('Every 100 completed focus minutes grows a tree. Saved only on this computer.')}</p>
  </section>
 </section>;
}
