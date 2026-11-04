import { run, parseJsonOutput } from '../../infrastructure/process/cli.js';

// Read lifecycle status without invoking Flutter discovery or fetching hardware
// metadata. Failed probes preserve the last known state rather than inventing it.
export async function deviceStatus(devices, { execute = run, platform = process.platform } = {}) {
  const updates = new Map();
  await Promise.all([
    (async () => {
      if (platform !== 'darwin' || !devices.some(d => d.group === 'ios')) return;
      try {
        const list = parseJsonOutput(await execute('xcrun', ['simctl', 'list', 'devices', '--json'], { timeout: 3000 }));
        if (!list.devices || typeof list.devices !== 'object') return;
        const current = new Map(Object.values(list.devices).flat().map(d => [d.udid, d]));
        for (const d of devices.filter(d => d.group === 'ios')) {
          const found = current.get(d.id);
          if (!found) { updates.set(d.id, { state: 'offline', flutterId: undefined }); continue; }
          if (found.state === 'Booted') updates.set(d.id, { state: 'online', flutterId: d.id });
          else if (found.state === 'Shutdown') updates.set(d.id, { state: 'offline', flutterId: undefined });
        }
      } catch { /* Keep known status if CoreSimulator is temporarily unavailable. */ }
    })(),
    (async () => {
      if (!devices.some(d => d.platform === 'android')) return;
      try {
        const raw = await execute('adb', ['devices'], { timeout: 3000 });
        if (!raw.includes('List of devices attached')) return;
        const online = raw.split(/\r?\n/).flatMap(line => { const m = /^(\S+)\s+device\s*$/.exec(line.trim()); return m ? [m[1]] : []; });
        const avds = new Map();
        await Promise.all(online.filter(id => /^emulator-\d+$/.test(id)).map(async serial => {
          try { const name = (await execute('adb', ['-s', serial, 'emu', 'avd', 'name'], { timeout: 2000 })).split(/\r?\n/)[0].trim(); avds.set(name, serial); } catch {}
        }));
        for (const d of devices.filter(d => d.platform === 'android')) {
          const serial = d.avd ? avds.get(d.avd) : online.includes(d.flutterId || d.id) ? d.flutterId || d.id : undefined;
          // A failed identity probe must not mark a still-connected AVD offline.
          if (!serial && d.avd && online.includes(d.flutterId)) continue;
          updates.set(d.id, { state: serial ? 'online' : 'offline', flutterId: serial });
        }
      } catch { /* Missing adb is handled by Setup & tools. */ }
    })()
  ]);
  return updates;
}
