export const themeScenes=['forest','rain','cafe','night','gradient'];
export const presetThemes=[
 {id:'forest',name:'Quiet forest',scene:'forest',accent:'#a3ce8a',background:'#234838'},
 {id:'rain',name:'Rainy day',scene:'rain',accent:'#9fcbdc',background:'#29475b'},
 {id:'cafe',name:'Cozy café',scene:'cafe',accent:'#dfbc88',background:'#594234'},
 {id:'night',name:'Starry night',scene:'night',accent:'#bfb3ed',background:'#35304f'}
];
export const isPresetTheme=id=>presetThemes.some(theme=>theme.id===id);
export function cleanTheme(value){
 if(!value||!/^custom-[a-f0-9-]{36}$/.test(value.id)||typeof value.name!=='string'||!value.name.trim()||value.name.trim().length>40||/[\u0000-\u001f]/.test(value.name)||!themeScenes.includes(value.scene)||!/^#[0-9a-f]{6}$/i.test(value.accent)||!/^#[0-9a-f]{6}$/i.test(value.background))throw Error('Invalid personal theme');
 return {id:value.id,name:value.name.trim(),scene:value.scene,accent:value.accent.toLowerCase(),background:value.background.toLowerCase()};
}
export function restoreThemes(value){
 const custom=[];
 for(const item of Array.isArray(value)?value.slice(0,68):[]){try{const theme=cleanTheme(item);if(custom.length<64&&!custom.some(existing=>existing.id===theme.id))custom.push(theme);}catch{}}
 return [...presetThemes.map(theme=>({...theme})),...custom];
}
export const activeTheme=state=>(state.themes||presetThemes).find(theme=>theme.id===state.space)||presetThemes[0];
const rgb=color=>[1,3,5].map(index=>Number.parseInt(color.slice(index,index+2),16));
function mix(first,second,weight){return '#'+rgb(first).map((channel,index)=>Math.round(channel*(1-weight)+rgb(second)[index]*weight).toString(16).padStart(2,'0')).join('');}
export function contrast(first,second){
 const luminance=color=>rgb(color).map(channel=>{const v=channel/255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;}).reduce((sum,value,index)=>sum+value*[0.2126,0.7152,0.0722][index],0);
 const a=luminance(first),b=luminance(second);return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
}
// Keep custom palettes readable even when users choose very pale or dark colors.
function accessible(color,background,target,destination){let result=color;for(let i=0;i<24&&contrast(result,background)<target;i++)result=mix(result,destination,0.15);return result;}
export function themeTokens(theme,light=false){
 const bg=mix(theme.background,light?'#ffffff':'#080b0e',light?0.96:0.8);
 const surface=mix(theme.background,light?'#ffffff':'#13171b',light?0.985:0.75);
 const text=light?'#20272b':'#edf1f1';
 const accent=accessible(theme.accent,bg,3,light?'#111820':'#ffffff');
 const green=accessible(theme.accent,surface,4.5,light?'#111820':'#ffffff');
 const ink=contrast('#000000',accent)>contrast('#ffffff',accent)?'#000000':'#ffffff';
 return {'--bg':bg,'--sidebar':mix(theme.background,light?'#ffffff':'#0b0f12',light?0.97:0.78),'--surface':surface,'--surface-hover':mix(theme.background,light?'#ffffff':'#252a2f',light?0.90:0.65),'--surface-subtle':mix(theme.background,light?'#ffffff':'#101418',light?0.93:0.78),'--border':mix(theme.background,light?'#ffffff':'#73808a',light?0.77:0.23),'--border-subtle':mix(theme.background,light?'#ffffff':'#46535b',light?0.86:0.25),'--text':text,'--muted':accessible(light?'#59646d':'#a9b4bd',surface,4.5,light?'#111820':'#ffffff'),'--faint':accessible(light?'#647079':'#9ba6ad',surface,4.5,light?'#111820':'#ffffff'),'--accent':accent,'--accent-ink':ink,'--green':green,'--purple':green,'--danger':light?'#ac2840':'#f7a1af'};
}
