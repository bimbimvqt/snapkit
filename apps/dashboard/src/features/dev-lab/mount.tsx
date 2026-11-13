import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {DevLab} from './DevLab';
function Page(){const [visible,setVisible]=useState(()=>!document.getElementById('panel-dev-lab')?.classList.contains('hidden'));useEffect(()=>{const change=(e:Event)=>setVisible((e as CustomEvent).detail==='dev-lab');document.addEventListener('snapkit:page',change);return()=>document.removeEventListener('snapkit:page',change);},[]);return visible?<DevLab/>:null;}
export function mountDevLab(){const root=createRoot(document.getElementById('dev-lab-root')!);root.render(<Page/>);return()=>root.unmount();}
