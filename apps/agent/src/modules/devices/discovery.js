import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { iosAccessStatus } from '../../infrastructure/storage/device-storage.js';
import { run, parseJsonOutput } from '../../infrastructure/process/cli.js';

import { parseIni, mergeDevices } from '../../domain/device-catalog.js';
export { parseIni, mergeDevices } from '../../domain/device-catalog.js';

export async function discover() {
  const native = (await import('../../infrastructure/storage/preferences.js')).getPreferences().developerProfile?.framework === 'react-native';
  const warnings = [];
  const attempt = async (name, task, fallback) => { try { return await task(); } catch (e) { warnings.push(`${name}: ${e.message}`); return fallback; } };
  const [flutter, simulators, avdList] = await Promise.all([
    native ? [] : attempt('Flutter', async () => parseJsonOutput(await run('flutter', ['devices', '--machine'], { timeout: 45000 })), []),
    // Access checks need every registered device, including those with missing runtimes.
    // mergeDevices filters unavailable devices from the dashboard separately.
    process.platform === 'darwin' ? attempt('iOS', async () => parseJsonOutput(await run('xcrun', ['simctl', 'list', 'devices', '--json'])), {}) : {},
    attempt('Android', () => run('emulator', ['-list-avds']), '')
  ]);
  const adb = await attempt('ADB', () => run('adb', ['devices', '-l']), '');
  for (const line of adb.split(/\r?\n/)) {
    const match = /^(\S+)\s+device(?:\s|$)/.exec(line);
    if (match && !flutter.some(d => d.id === match[1])) flutter.push({ id: match[1], name: /model:(\S+)/.exec(line)?.[1]?.replaceAll('_', ' ') || match[1], targetPlatform: 'android', emulator: match[1].startsWith('emulator-') });
  }
  const runningAvds = {};
  await Promise.all(flutter.filter(d => d.emulator && d.targetPlatform?.startsWith('android')).map(async d => {
    const name = await attempt('AVD identity', () => run('adb', ['-s', d.id, 'emu', 'avd', 'name']), '');
    runningAvds[d.id] = name.split(/\r?\n/)[0].trim();
  }));
  const avds = await Promise.all(avdList.split(/\r?\n/).filter(Boolean).map(async id => {
    let config = {};
    try {
      const root = process.env.ANDROID_AVD_HOME || path.join(process.env.ANDROID_USER_HOME || path.join(os.homedir(), '.android'), 'avd');
      const pointer = parseIni(await readFile(path.join(root, `${id}.ini`), 'utf8'));
      config = parseIni(await readFile(path.join(pointer.path || path.join(root, `${id}.avd`), 'config.ini'), 'utf8'));
    } catch { /* Missing metadata is shown as unknown, never inferred. */ }
    const api = /android-(\d+)/.exec(config['image.sysdir.1'] || '')?.[1];
    return { id, name: config['avd.ini.displayname'] || id.replaceAll('_', ' '), os: api ? `Android API ${api}` : 'Android', ram: config['hw.ramSize'] ? `${config['hw.ramSize']} MB` : null, cpu: config['hw.cpu.ncore'] ? `${config['hw.cpu.ncore']} cores` : null, resolution: config['hw.lcd.width'] && config['hw.lcd.height'] ? `${config['hw.lcd.width']} × ${config['hw.lcd.height']}` : null };
  }));
  const devices = mergeDevices(flutter, simulators, avds, runningAvds);
  if (native) for (const device of devices) if (device.platform === 'ios' && device.state === 'online') device.flutterId ||= device.id;
  await Promise.all(devices.filter(d => d.platform === 'android' && d.flutterId).map(async d => {
    try {
      const [size, mem, cpu, version] = await Promise.all([
        run('adb', ['-s', d.flutterId, 'shell', 'wm', 'size']),
        run('adb', ['-s', d.flutterId, 'shell', 'cat', '/proc/meminfo']),
        run('adb', ['-s', d.flutterId, 'shell', 'getconf', '_NPROCESSORS_ONLN']),
        run('adb', ['-s', d.flutterId, 'shell', 'getprop', 'ro.build.version.release'])
      ]);
      d.resolution = size.match(/(\d+x\d+)/g)?.at(-1)?.replace('x', ' × ') || d.resolution;
      const kb = /MemTotal:\s+(\d+)/.exec(mem)?.[1];
      if (kb) d.ram = `${(Number(kb) / 1048576).toFixed(1)} GB`;
      if (cpu.trim()) d.cpu = `${cpu.trim()} cores`;
      if (version.trim()) d.os = `Android ${version.trim()}`;
    } catch (e) { warnings.push(`${d.name}: ${e.message}`); }
  }));
  const iosAccess = await iosAccessStatus(simulators);
  if (iosAccess.blocked) warnings.push(iosAccess.reason);
  return { devices, warnings, iosAccess, scannedAt: new Date().toISOString() };
}
