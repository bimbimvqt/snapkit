import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { iosAccessStatus } from './storage.js';
import { run, parseJsonOutput } from './cli.js';

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

export async function discover() {
  const warnings = [];
  const attempt = async (name, task, fallback) => { try { return await task(); } catch (e) { warnings.push(`${name}: ${e.message}`); return fallback; } };
  const [flutter, simulators, avdList] = await Promise.all([
    attempt('Flutter', async () => parseJsonOutput(await run('flutter', ['devices', '--machine'], { timeout: 45000 })), []),
    process.platform === 'darwin' ? attempt('iOS', async () => parseJsonOutput(await run('xcrun', ['simctl', 'list', 'devices', 'available', '--json'])), {}) : {},
    attempt('Android', () => run('emulator', ['-list-avds']), '')
  ]);
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
