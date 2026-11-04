import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { DeviceCard } from './DeviceCard';
import { Icon } from '../../shared/ui/icons';
import type { DeviceView, EmptyDevices } from './model';
let root: Root | undefined, previous = '';
// Compatibility adapter: event delegation stays in the device application controller.
// React exclusively owns the grid children; controllers must never write innerHTML here.
export function renderDeviceGrid(views: DeviceView[], empty: EmptyDevices | null = null) {
  const language = window.SnapkitI18n.language;
  const signature = JSON.stringify([views, empty, language]);
  if (previous === signature) return;
  previous = signature;
  root ??= createRoot(document.getElementById('devices-grid')!);
  flushSync(() => root!.render(views.length ? views.map(view => <DeviceCard key={view.device.id} view={view} signature={JSON.stringify([view, language])} />) : empty && <div className="empty-state"><Icon name={empty.icon || 'monitor-smartphone'} /><h3>{empty.title}</h3><p>{empty.detail}</p>{empty.actions?.map(action => <button className="button" id={action.id} key={action.id}>{action.label}</button>)}</div>));
}
