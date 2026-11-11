const preference='snapkit-notification-sound',ledger='snapkit-notification-chimes';
let context:AudioContext|undefined;
let lastSuccess=0;
export function soundVolume(){try{const raw=localStorage.getItem('snapkit-sound-volume');const value=raw===null?.85:Number(raw);return Number.isFinite(value)?Math.max(0,Math.min(1,value)):.85;}catch{return .85;}}
export function setSoundVolume(value:number){try{localStorage.setItem('snapkit-sound-volume',String(Math.max(0,Math.min(1,value))));}catch{}document.dispatchEvent(new Event('snapkit:notification-sound'));}
export async function playSuccess(){if(!soundEnabled()||Date.now()-lastSuccess<700)return;lastSuccess=Date.now();await unlockSound();playChime(true);}
export function soundEnabled(){try{return localStorage.getItem(preference)!=='off';}catch{return true;}}
export function setSoundEnabled(enabled:boolean){try{localStorage.setItem(preference,enabled?'on':'off');}catch{}document.dispatchEvent(new Event('snapkit:notification-sound'));}
export async function unlockSound(){
 try{context??=new AudioContext();if(context.state==='suspended')await context.resume();}catch{/* A browser may require another user gesture. */}
}
export function playChime(success=false){
 if(!context||context.state!=='running')return false;
 try{const now=context.currentTime;for(const [offset,frequency] of success?[[0,523.25],[.1,783.99]]:[[0,659.25],[.18,880],[.36,1046.5]]){const oscillator=context.createOscillator(),gain=context.createGain();oscillator.type='sine';oscillator.frequency.value=frequency;gain.gain.setValueAtTime(0,now+offset);gain.gain.linearRampToValueAtTime((success?.22:.38)*soundVolume(),now+offset+.015);gain.gain.exponentialRampToValueAtTime(.0001,now+offset+.22);oscillator.connect(gain);gain.connect(context.destination);oscillator.start(now+offset);oscillator.stop(now+offset+.24);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};}return true;}catch{return false;}
}
export async function chimeForNewItems(userId:string,ids:string[]){
 if(!ids.length||!soundEnabled()||!context||context.state!=='running')return;
 const notify=()=>{if(!soundEnabled())return;let played:string[]=[];try{played=JSON.parse(localStorage.getItem(ledger)||'[]');if(!Array.isArray(played))played=[];}catch{}
  const keys=ids.map(id=>userId+':'+id);if(keys.every(id=>played.includes(id)))return;
  if(playChime())try{localStorage.setItem(ledger,JSON.stringify([...new Set([...played,...keys])].slice(-300)));}catch{}
 };
 if(navigator.locks)await navigator.locks.request(ledger,notify);else notify();
}
