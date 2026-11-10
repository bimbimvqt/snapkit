import {useState} from 'react';
import {api} from '../../legacy/device-controller.js';
import {Select} from '../../shared/controls/Select';
import {t} from '../../shared/ui/use-language';
export function DeviceHost({workspaceId,deviceId,platform,refresh}:{workspaceId:string;deviceId:string;platform:string;refresh:()=>void}){
 const [devices,setDevices]=useState<{id:string;name:string;platform:string}[]|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 return <details onToggle={e=>{if(e.currentTarget.open&&!devices)void api('/api/teams/local-devices',undefined,true).then(v=>setDevices(v.devices)).catch((e:Error)=>setError(e.message));}}><summary>{t('Connect this computer')}</summary><form onSubmit={e=>{e.preventDefault();setBusy(true);setError('');void api('/api/teams/local-devices/bind',{workspaceId,deviceId,localDeviceId:new FormData(e.currentTarget).get('localDeviceId')},true).then(refresh).catch((e:Error)=>setError(e.message)).finally(()=>setBusy(false));}}><label className="teams-field">{t('Local device')}<Select name="localDeviceId" disabled={busy||!devices?.length}>{devices?.filter(d=>d.platform===platform).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</Select></label><button className="button" disabled={busy||!devices?.some(d=>d.platform===platform)}>{t('Connect host')}</button>{error&&<p role="alert" className="teams-error">{t(error)}</p>}</form></details>;
}
