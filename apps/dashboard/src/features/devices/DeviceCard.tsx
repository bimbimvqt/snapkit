import { memo } from 'react';
import { Icon } from '../../shared/ui/icons';
import { t } from '../../shared/ui/use-language';
import type { DeviceView } from './model';
const groupLabel = { ios: 'iOS SIMULATOR', android: 'ANDROID EMULATOR', physical: 'PHYSICAL DEVICE' };
const groupIcon = { ios: 'smartphone', android: 'bot', physical: 'usb' };
export const DeviceCard = memo(function DeviceCard({ view }: { view: DeviceView; signature: string }) {
  const { device: d, selected, starting, shutting, debugging, debugStopping, selectionSaving, canRunRelease, showRunRelease } = view;
  const online = d.state === 'online', tablet = /ipad|tablet/i.test(d.name);
  const readiness = starting ? 'Starting device…' : !online ? 'Start this device to select it for debug' : !d.flutterId ? 'Waiting for Flutter detection · refresh shortly' : 'Ready for IDE debug';
  const specs = [[d.ram, 'memory-stick', 'Device RAM'], [d.cpu, 'cpu', 'Logical CPU cores'], [d.resolution?.replaceAll(' ', ''), 'scan', 'Display resolution']].filter(([value]) => value);
  return <article className={`device-card ${d.group} ${online ? 'online' : 'offline'} ${selected ? 'target' : ''} ${tablet ? 'tablet' : ''}`} data-device={d.id}>
    <div className="card-top"><span className="platform-label"><Icon name={groupIcon[d.group]} />{t(groupLabel[d.group])}</span><div className="card-badges">
      {selected && <span className="target-badge"><Icon name="crosshair" />IDE</span>}
      <span className={`status-badge ${online ? 'online' : ''}`}><span className={`dot ${online ? 'green' : ''}`} />{t(online ? 'Online' : 'Offline')}</span>
      {(d.group === 'ios' || d.group === 'android' && d.avd) && <button className="icon-button delete-device" data-action="delete" aria-label={t('Delete {0}', [d.name])} title={t('Delete device and its data')}><Icon name="trash-2" /></button>}
    </div></div>
    <div className="device-stage" aria-hidden="true"><div className="stage-grid" /><div className="device-model"><div className="phone-screen">{online ? <><div className="wallpaper" /><span className="screen-clock">9:41</span><span className="screen-date">Thursday, October 29</span><span className="screen-label">READY FOR IDE</span></> : <span className="offline-symbol"><Icon name="power" /></span>}</div></div></div>
    <div className="card-info"><h3 className="card-name">{d.name}{d.group === 'physical' && <Icon name="cable" />}</h3><p className="device-os">{d.os}</p>
      {specs.length ? <div className="device-specs">{specs.map(([value, symbol, label]) => <span key={symbol} className="spec" title={t(label!)}><Icon name={symbol!} />{value}</span>)}</div> : d.platform !== 'ios' && <p className="device-specs-empty">{t('Hardware details are not available yet.')}</p>}
    </div>
    <p className="device-readiness">{t(readiness)}</p>
    <div className="card-actions">
      {d.group !== 'physical' ? <button className="button" data-action={online ? 'shutdown' : 'boot'} disabled={starting || shutting} aria-busy={starting || shutting || undefined} title={t(online ? 'Turn off this device and disconnect its debug session. Device data is kept.' : 'Start device')}><Icon name={starting || shutting ? 'loader-circle' : 'power'} />{t(shutting ? 'Turning off…' : starting ? 'Starting…' : online ? 'Turn off device' : 'Start device')}</button> : showRunRelease && <button type="button" className="button" data-run-release={d.id} disabled={!canRunRelease}><Icon name="play" />{t('Run Release')}</button>}
      <label className={`target-action ${selected ? 'selected' : ''}`}><input type="checkbox" data-action="select" aria-label={t('Select {0} for IDE debug', [d.name])} defaultChecked={selected} ref={node => { if (node) node.checked = selected; }} disabled={selectionSaving || starting || shutting || !selected && (!online || !d.flutterId)} />{t(selected ? 'Selected for IDE' : 'Select for IDE')}</label>
    </div>
    {online && (d.platform === 'android' || d.group === 'ios') && <div className="device-tool-actions"><button className="button" data-tool-action="logs"><Icon name="terminal" />{t('Logs')}</button><button className="button" data-tool-action="screenshot"><Icon name="camera" />{t('Screenshot')}</button><button className="button" data-tool-action="record"><Icon name="video" />{t('Record')}</button></div>}
    {debugging && <div className="device-debug"><span><Icon name="bug" />{t('Debugging in IDE')}</span><button className="button" data-action="stop-debug" disabled={debugStopping || shutting} aria-busy={debugStopping || undefined}><Icon name={debugStopping ? 'loader-circle' : 'square'} />{t(debugStopping ? 'Stopping debug…' : 'Stop debug')}</button></div>}
  </article>;
}, (previous, next) => previous.signature === next.signature);
