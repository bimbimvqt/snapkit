import path from 'node:path';
import os from 'node:os';
import { existsSync, lstatSync } from 'node:fs';
import { mkdir, realpath, lstat, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { run, parseJsonOutput } from './cli.js';
const project = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const dataRoot = path.resolve(process.env.SNAPKIT_DATA_ROOT || (process.platform === 'darwin' && existsSync('/Volumes/SanDiskSSDData') ? '/Volumes/SanDiskSSDData/SnapkitData' : path.join(project, '.snapkit', 'data')));
const defaultIOSDevices = path.join(os.homedir(), 'Library/Developer/CoreSimulator/Devices');
export function selectIOSDeviceRoot(defaultRoot, ssdRoot, platform = process.platform) {
  // Respect an existing native device set, including recovery from blocked SSD access.
  if (platform === 'darwin') {
    try { if (lstatSync(defaultRoot).isDirectory()) return defaultRoot; } catch { /* Not created yet. */ }
  }
  return ssdRoot;
}
export const storage = {
  root: dataRoot, avd: path.join(dataRoot, 'Android/avd'), iosDevices: selectIOSDeviceRoot(defaultIOSDevices, path.join(dataRoot, 'iOS/Devices')),
  downloads: path.join(dataRoot, 'downloads/iOS'),
  temp: path.join(dataRoot, 'tmp'), state: path.join(dataRoot, 'state'),
  sdk: process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME || (existsSync('/Volumes/SanDiskSSDData/Android/sdk') ? '/Volumes/SanDiskSSDData/Android/sdk' : path.join(dataRoot, 'Android/sdk'))
};
export async function configureStorage() {
  // Fail closed if an external volume was unplugged; never create a fake mount directory.
  if (dataRoot.startsWith('/Volumes/')) await realpath(path.join('/Volumes', dataRoot.split('/')[2]));
  for (const key of ['avd', 'iosDevices', 'downloads', 'temp', 'state']) await mkdir(storage[key], { recursive: true });
  process.env.ANDROID_AVD_HOME = storage.avd;
  process.env.ANDROID_HOME = storage.sdk;
  process.env.ANDROID_SDK_ROOT = storage.sdk;
  process.env.TMPDIR = storage.temp + path.sep; process.env.TMP = storage.temp; process.env.TEMP = storage.temp;
}
export async function storageStatus() {
  const defaultDevices = defaultIOSDevices;
  const resolved = await realpath(defaultDevices).catch(() => null);
  return { ...storage, iosReady: process.platform === 'darwin' && resolved === await realpath(storage.iosDevices).catch(() => null),
    iosDefaultDevices: defaultDevices, iosActualDevices: resolved,
    iosSystemRuntimes: '/Library/Developer/CoreSimulator', iosOnSSD: storage.iosDevices !== defaultIOSDevices,
    note: `Android devices, downloads and Snapkit state use the data root. iOS device data: ${storage.iosDevices}. Installed iOS runtime images remain managed by Xcode in /Library/Developer/CoreSimulator.` };
}
export async function requireIOSStorage() {
  const info = await storageStatus();
  if (!info.iosReady) throw new Error(`iOS device storage is unavailable at ${storage.iosDevices}. Check the default CoreSimulator Devices directory before creating a simulator.`);
  // Ensure the external target remains accessible before a simulator mutation.
  await lstat(storage.iosDevices);
  const devices = parseJsonOutput(await run('xcrun', ['simctl', 'list', 'devices', '--json']));
  const status = await iosAccessStatus(devices);
  if (status.blocked) throw new Error(status.reason);
}

export const iosPermissionHelp = 'macOS blocked CoreSimulator access to the SSD. In System Settings → Privacy & Security → Full Disk Access, add /Library/Developer/PrivateFrameworks/CoreSimulator.framework/Versions/A/XPCServices/com.apple.CoreSimulator.CoreSimulatorService.xpc/Contents/MacOS/com.apple.CoreSimulator.CoreSimulatorService, enable it, then restart Simulator/CoreSimulatorService and refresh devices.';
export async function iosAccessStatus(registeredDevices, { deviceRoot = storage.iosDevices, platform = process.platform } = {}) {
  if (platform !== 'darwin') return { blocked: false };
  const folders = (await readdir(deviceRoot).catch(() => [])).filter(name => /^[0-9A-F-]{36}$/i.test(name));
  const ids = new Set(Object.values(registeredDevices.devices || {}).flat().map(d => d.udid));
  const missing = folders.filter(id => !ids.has(id));
  return { blocked: missing.length > 0, reason: missing.length ? iosPermissionHelp : null, missingDeviceIds: missing };
}
