import { run, launch, parseJsonOutput } from './cli.js';
import { setTimeout as delay } from 'node:timers/promises';

const background = (name, args) => new Promise((resolve, reject) => {
  const child = launch(name, args, { detached: true, stdio: 'ignore' });
  child.once('error', reject);
  child.once('spawn', () => { child.unref(); resolve(); });
});
export async function bootDevice(d) {
  const ios = d.platform === 'ios' && d.group === 'ios';
  const avd = d.platform === 'android' && d.group === 'android';
  if (d.state === 'online') return { message: 'Device already online' };
  if (ios) {
    await run('xcrun', ['simctl', 'boot', d.id]);
    await run('open', ['-a', 'Simulator', '--args', '-CurrentDeviceUDID', d.id]);
  } else if (avd && d.avd) await background('emulator', ['-avd', d.avd]);
  else throw new Error('This device cannot be booted remotely');
  return { message: 'Boot requested. Refresh after the device finishes starting.' };
}

export function canDeleteDevice(d) {
  return (d.group === 'ios' && d.platform === 'ios' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(d.id))
    || (d.group === 'android' && d.platform === 'android' && typeof d.avd === 'string' && /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,199}$/.test(d.avd));
}

export async function deleteDevice(d, { execute = run, sleep = delay } = {}) {
  if (!canDeleteDevice(d)) throw new Error('Only registered iOS Simulators and Android AVDs can be deleted. Physical devices cannot be erased here.');
  if (d.platform === 'ios') {
    const list = parseJsonOutput(await execute('xcrun', ['simctl', 'list', 'devices', '--json']));
    const current = Object.values(list.devices || {}).flat().find(item => item.udid === d.id);
    if (!current) throw new Error('Simulator no longer exists. Refresh devices.');
    if (current.state !== 'Shutdown') await execute('xcrun', ['simctl', 'shutdown', d.id]);
    await execute('xcrun', ['simctl', 'delete', d.id]);
  } else {
    // Check adb directly: an emulator can be running before Flutter discovers it.
    const serials = raw => raw.split(/\r?\n/).map(line => line.trim().split(/\s+/)[0]).filter(id => /^emulator-\d+$/.test(id));
    const running = serials(await execute('adb', ['devices']));
    for (const serial of running) {
      const name = (await execute('adb', ['-s', serial, 'emu', 'avd', 'name'])).split(/\r?\n/)[0].trim();
      if (name !== d.avd) continue;
      await execute('adb', ['-s', serial, 'emu', 'kill']);
      let stopped = false;
      for (let attempt = 0; attempt < 20; attempt++) {
        if (!serials(await execute('adb', ['devices'])).includes(serial)) { stopped = true; break; }
        await sleep(500);
      }
      if (!stopped) throw new Error('Emulator is still running. Stop it before deleting its data.');
    }
    await execute('avdmanager', ['delete', 'avd', '-n', d.avd], { timeout: 60000 });
  }
  return { message: `${d.name} and its device data were deleted. Shared OS runtimes were kept.` };
}
