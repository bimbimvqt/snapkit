import {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createPortal} from 'react-dom';
import {api, state} from '../../legacy/device-controller.js';
import {useLanguage} from '../../shared/ui/use-language';
import {Icon} from '../../shared/ui/icons';
import {DAY, REVIEW_KEY, readHistory, recordDay, recordSuccess, eligible, invited} from './policy.js';
import './reviews.css';

type Runtime = {demo?: boolean; authRequired?: boolean; scanning?: boolean; activeReleaseTask?: boolean; activeRecordings?: number; jobs?: {status:string}[]; debugSessions?: {id:string}[]; devices: {id:string;state:string}[]};
function Reviews() {
  const language = useLanguage(), vi = language === 'vi';
  const w = (en:string, vn:string) => vi ? vn : en;
  const [open, setOpen] = useState(false), [invite, setInvite] = useState(false), [rating, setRating] = useState(0);
  const [message,setMessage] = useState(''), [name,setName] = useState(''), [consent,setConsent] = useState(false);
  const [sending,setSending] = useState(false), [sent,setSent] = useState(false), [error,setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null), returnFocus = useRef<HTMLElement|null>(null);
  const started = useRef(Date.now()), interacted = useRef(Date.now()), lastProblem = useRef(0), stored = useRef(true);
  const work = useRef(new Set<string>());
  const history = useRef(readHistory(null,Date.now()));
  const attempt = useRef({payload:'', id:''});
  const runtime = () => state as unknown as Runtime;
  const local = () => !window.SNAPKIT_PREVIEW && !window.SNAPKIT_CONTROLLER && !runtime().demo && !runtime().authRequired;
  const persist = () => { try { localStorage.setItem(REVIEW_KEY,JSON.stringify(history.current)); } catch { stored.current = false; } };
  const show = () => { history.current = {...history.current, nextPromptAt:Math.max(history.current.nextPromptAt,Date.now()+30*DAY)}; persist(); returnFocus.current = document.activeElement as HTMLElement; setInvite(false); setOpen(true); };
  const dismiss = (forever = false) => { history.current = {...history.current, optedOut:forever || history.current.optedOut}; persist(); setInvite(false); };
  useEffect(() => {
    try { history.current = readHistory(localStorage.getItem(REVIEW_KEY),Date.now()); } catch { stored.current = false; }
    if (local()) { history.current = recordDay(history.current,Date.now()); persist(); }
    const manual = () => show();
    const interact = () => { interacted.current = Date.now(); };
    const working = (event:Event) => { const {kind,busy} = (event as CustomEvent<{kind:string;busy:boolean}>).detail; if(busy) {work.current.add(kind);setInvite(false);} else work.current.delete(kind); };
    const problem = () => {lastProblem.current = Date.now();setInvite(false);};
    const success = () => { if (local()) { history.current = recordSuccess(history.current,Date.now()); persist(); } };
    let devices = new Map(runtime().devices.map(d=>[d.id,d.state]));
    let debugIds = new Set(runtime().debugSessions?.map(s=>s.id));
    const stateChanged = () => {
      const current = runtime();
      const next = new Map(current.devices.map(d=>[d.id,d.state]));
      const ids = new Set(current.debugSessions?.map(s=>s.id));
      if (current.devices.some(d=>d.state === 'online' && devices.get(d.id) === 'offline') || [...ids].some(id=>!debugIds.has(id))) success();
      devices = next; debugIds = ids;
    };
    const tick = () => {
      if (!local() || !stored.current || document.hidden) { setInvite(false); return; }
      const now = Date.now(), current = runtime();
      if (now - interacted.current < 60000) { const next = recordDay(history.current,now); if (next.days.length !== history.current.days.length) {history.current=next;persist();} }
      const busy = !!(work.current.size || !document.hasFocus() || !navigator.onLine || now - lastProblem.current < 10*60000 || current.scanning || current.authRequired || current.activeReleaseTask || current.activeRecordings || current.debugSessions?.length || current.jobs?.some(j=>j.status==='running') || document.querySelector('dialog[open], [aria-busy="true"], .account-gate:not([hidden])') || document.activeElement?.matches('input,textarea,select,[contenteditable="true"]'));
      const page = document.querySelector('.app-panel:not(.hidden)')?.id;
      if (busy || !['panel-devices','panel-setup'].includes(page || '')) {setInvite(false);return;}
      if (eligible(history.current,{now,sessionStartedAt:started.current,quiet:now-interacted.current>=15000,busy})) {
        history.current=invited(history.current,now);persist(); if(stored.current) setInvite(true);
      }
    };
    document.addEventListener('snapkit:review-open',manual);
    document.addEventListener('snapkit:review-success',success);
    document.addEventListener('snapkit:review-error',problem);
    document.addEventListener('snapkit:review-work',working);
    document.addEventListener('snapkit:state',stateChanged);
    document.addEventListener('pointerdown',interact,true); document.addEventListener('keydown',interact,true);
    const timer = setInterval(tick,15000);
    return () => { clearInterval(timer); document.removeEventListener('snapkit:review-open',manual); document.removeEventListener('snapkit:review-success',success); document.removeEventListener('snapkit:review-error',problem); document.removeEventListener('snapkit:review-work',working); document.removeEventListener('snapkit:state',stateChanged); document.removeEventListener('pointerdown',interact,true); document.removeEventListener('keydown',interact,true); };
  },[]);
  useEffect(() => { if (open) dialog.current?.showModal(); else if (dialog.current?.open) dialog.current.close(); },[open]);
  const close = () => { if(sending) return; setOpen(false); returnFocus.current?.focus({preventScroll:true}); };
  useEffect(() => {
    if (!open) return;
    const escape = (event:KeyboardEvent) => { if(event.key === 'Escape') {event.preventDefault(); if(!sending) setOpen(false);} };
    document.addEventListener('keydown',escape,true);
    return () => document.removeEventListener('keydown',escape,true);
  },[open,sending]);
  async function submit(event:React.FormEvent) {
    event.preventDefault(); if(sending) return;
    if(!local()) { setError(w('Open the local Snapkit app to send a review. Demo reviews are not submitted.','Mở ứng dụng Snapkit trên máy để gửi đánh giá. Chế độ demo không gửi đánh giá.'));return; }
    if(!rating || message.trim().length<10) {setError(w('Choose a rating and write at least 10 characters.','Chọn số sao và viết ít nhất 10 ký tự.'));return;}
    const payload = {rating,message:message.trim(),name:name.trim(),publishConsent:consent};
    const fingerprint = JSON.stringify(payload);
    if(attempt.current.payload!==fingerprint) attempt.current={payload:fingerprint,id:crypto.randomUUID()};
    setSending(true);setError('');
    try {
      const result = await api('/api/reviews',{...payload,submissionId:attempt.current.id});
      if(result?.received!==true) throw Error('Unconfirmed');
      history.current={...history.current,submitted:true};persist();setSent(true);setMessage('');setName('');
    } catch {setError(w('We could not confirm delivery. Your review is kept here. Check your connection and try again.','Chưa xác nhận được việc gửi. Nội dung vẫn được giữ tại đây. Kiểm tra kết nối và thử lại.'));}
    finally {setSending(false);}
  }
  const labels = vi ? ['Rất chưa hài lòng','Chưa hài lòng','Bình thường','Hài lòng','Rất hài lòng'] : ['Very dissatisfied','Dissatisfied','Neutral','Satisfied','Very satisfied'];
  return <>
    {invite && createPortal(<aside className="review-invite" aria-live="polite" aria-labelledby="review-invite-title"><div><strong id="review-invite-title">{w('How is Snapkit working for you?','Trải nghiệm Snapkit của bạn thế nào?')}</strong><p>{w('Share an honest review to help us improve.','Chia sẻ đánh giá của bạn để giúp Snapkit tốt hơn.')}</p></div><div className="review-invite-actions"><button className="button" onClick={show}>{w('Write a review','Viết đánh giá')}</button><button className="button" onClick={()=>dismiss()}>{w('Later','Để sau')}</button><button className="text-button" onClick={()=>dismiss(true)}>{w('Don’t ask again','Không nhắc lại')}</button></div></aside>,document.getElementById('review-invite-root')!)}
    <dialog ref={dialog} id="review-dialog" className="review-dialog" aria-labelledby="review-title" aria-describedby="review-description" onCancel={event=>{event.preventDefault();close();}} onClose={()=>{setOpen(false); requestAnimationFrame(()=>{const target=returnFocus.current?.isConnected?returnFocus.current:document.getElementById('review-open');target?.focus({preventScroll:true});});}}>
      <button className="icon-button review-close" aria-label={w('Close review','Đóng đánh giá')} disabled={sending} onClick={close}><Icon name="x"/></button>
      {sent ? <div className="review-thanks"><span className="review-mark"><Icon name="circle-check"/></span><h2 id="review-title">{w('Thanks for sharing.','Cảm ơn bạn đã chia sẻ.')}</h2><p id="review-description">{w('Your review has been received. Every rating helps us improve Snapkit.','Đã nhận đánh giá của bạn. Mọi mức đánh giá đều giúp Snapkit cải thiện.')}</p><p>{consent ? w('It may appear on snapkit.vn after moderation.','Đánh giá có thể xuất hiện trên snapkit.vn sau khi được duyệt.') : w('Your review stays private to the Snapkit team.','Đánh giá chỉ được chia sẻ riêng với nhóm Snapkit.')}</p><button className="button primary" onClick={close}>{w('Done','Xong')}</button></div> : <form onSubmit={submit}>
        <span className="product-kicker">{w('YOUR EXPERIENCE','TRẢI NGHIỆM CỦA BẠN')}</span><h2 id="review-title">{w('Review Snapkit','Đánh giá Snapkit')}</h2><p id="review-description">{w('What works well, and what could be better? We welcome every rating.','Điều gì hữu ích và điều gì cần cải thiện? Chúng mình đón nhận mọi mức đánh giá.')}</p>
        <fieldset className="review-rating" disabled={sending}><legend>{w('Your rating','Mức độ hài lòng')}</legend><div className="review-stars">{[1,2,3,4,5].map(value=><label key={value} className={value<=rating?'filled':''}><input type="radio" name="review-rating" value={value} checked={rating===value} onChange={()=>setRating(value)} aria-label={w(`${value} stars: ${labels[value-1]}`,`${value} sao: ${labels[value-1]}`)} required/><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/></svg></label>)}</div><p className="review-rating-label" aria-live="polite">{rating?`${rating}/5 · ${labels[rating-1]}`:w('Choose 1–5 stars','Chọn từ 1 đến 5 sao')}</p></fieldset>
        <label htmlFor="review-message">{w('Your review','Nội dung đánh giá')}</label><textarea id="review-message" minLength={10} maxLength={4000} required rows={4} value={message} disabled={sending} onChange={e=>setMessage(e.target.value)} aria-describedby="review-message-help"/><small id="review-message-help">{w('10–4,000 characters. Please leave out secrets and project details.','10–4.000 ký tự. Không đưa thông tin bí mật hoặc chi tiết dự án vào đánh giá.')}</small>
        <label className="review-consent"><input type="checkbox" checked={consent} disabled={sending} onChange={e=>setConsent(e.target.checked)}/><span>{w('Allow this review and my display name to appear on snapkit.vn after moderation.','Cho phép hiển thị đánh giá và tên của tôi trên snapkit.vn sau khi được duyệt.')}</span></label>
        {consent && <><label htmlFor="review-name">{w('Display name (optional)','Tên hiển thị (không bắt buộc)')}</label><input id="review-name" maxLength={100} value={name} disabled={sending} onChange={e=>setName(e.target.value)}/></>}
        <p className="review-privacy">{w('Sent only when you submit. No logs, source code or account details are attached.','Chỉ gửi khi bạn nhấn nút bên dưới. Không đính kèm log, mã nguồn hoặc thông tin tài khoản.')}</p>
        <p role="alert" className="field-error">{error}</p><div className="review-footer"><button type="button" className="button" disabled={sending} onClick={close}>{w('Not now','Để lúc khác')}</button><button className="button primary" type="submit" disabled={sending} aria-busy={sending}>{sending?w('Sending…','Đang gửi…'):w('Send review','Gửi đánh giá')}</button></div>
      </form>}
    </dialog>
  </>;
}
export function mountReviews() {
  const button=document.getElementById('review-open');
  const open=()=>document.dispatchEvent(new Event('snapkit:review-open'));
  button?.addEventListener('click',open);
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);root.render(<Reviews/>);
  return ()=>{button?.removeEventListener('click',open);root.unmount();host.remove();};
}
