export function parseIni(text) {
  return Object.fromEntries(text.split(/\r?\n/).filter(l => l.includes('=') && !l.trim().startsWith('#')).map(l => { const p = l.indexOf('='); return [l.slice(0, p).trim(), l.slice(p + 1).trim()]; }));
}
export function mergeDevices(flutter, simulators, avds, runningAvds = {}) {
  const devices = [];
  for (const [runtime, list] of Object.entries(simulators.devices || {})) for (const d of list) {
    if (d.isAvailable === false) continue;
    const f = flutter.find(f => f.id === d.udid);
    devices.push({ id: d.udid, name: d.name, group: 'ios', platform: 'ios', state: d.state === 'Booted' ? 'online' : 'offline', os: runtime.split('.').at(-1).replace('iOS-', 'iOS ').replaceAll('-', '.'), flutterId: f?.id, ram: null, cpu: null, resolution: null });
  }
  for (const avd of avds) {
    const f = flutter.find(f => runningAvds[f.id] === avd.id);
    devices.push({ ...avd, id: `avd:${avd.id}`, avd: avd.id, group: 'android', platform: 'android', state: f ? 'online' : 'offline', flutterId: f?.id });
  }
  for (const f of flutter) {
    if (!['android', 'ios'].some(p => f.targetPlatform?.startsWith(p))) continue;
    if (devices.some(d => d.flutterId === f.id || d.id === f.id)) continue;
    devices.push({ id: f.id, flutterId: f.id, name: f.name, group: f.emulator ? (f.targetPlatform.startsWith('android') ? 'android' : 'ios') : 'physical', platform: f.targetPlatform.startsWith('android') ? 'android' : 'ios', state: 'online', os: f.sdk || f.targetPlatform, ram: null, cpu: null, resolution: null });
  }
  return devices;
}

