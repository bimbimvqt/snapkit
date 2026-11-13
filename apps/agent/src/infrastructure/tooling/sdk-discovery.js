import path from 'node:path';
import os from 'node:os';
import { statSync, realpathSync, readdirSync } from 'node:fs';

let cached;
const file = value => { try { return statSync(value).isFile(); } catch { return false; } };
const children = directory => { try { return readdirSync(directory, { withFileTypes: true }).filter(item => item.isDirectory()).slice(0, 64).map(item => path.join(directory, item.name)); } catch { return []; } };
const canonical = value => { try { return realpathSync(value); } catch { return value; } };
export function clearSDKDiscovery() { cached = undefined; }

// Probe known SDK layouts only. Never recursively crawl source, user documents or disks.
export function discoverSDKs({ platform = process.platform, home = os.homedir(), env = process.env, mounts, includeExternal = false, isFile = file, directories = children, realpath = canonical } = {}) {
  const p = platform === 'win32' ? path.win32 : path.posix;
  const flutterName = platform === 'win32' ? 'flutter.bat' : 'flutter';
  const adbName = platform === 'win32' ? 'adb.exe' : 'adb';
  const flutter = [], android = [];
  if (env.FLUTTER_ROOT) flutter.push(env.FLUTTER_ROOT);
  if (env.ANDROID_SDK_ROOT) android.push(env.ANDROID_SDK_ROOT);
  if (env.ANDROID_HOME) android.push(env.ANDROID_HOME);
  for (const bin of (env.PATH || '').split(platform === 'win32' ? ';' : ':').filter(Boolean)) {
    const flutterBin = p.join(bin, flutterName), adbBin = p.join(bin, adbName);
    if (isFile(flutterBin)) flutter.push(p.dirname(p.dirname(realpath(flutterBin))));
    if (isFile(adbBin)) android.push(p.dirname(p.dirname(realpath(adbBin))));
  }
  if (platform === 'darwin') android.push(p.join(home, 'Library/Android/sdk'));
  if (platform === 'win32') android.push(p.join(env.LOCALAPPDATA || p.join(home, 'AppData/Local'), 'Android/Sdk'));
  // External disks are inspected only when explicitly supplied by the caller.
  const volumes = mounts ?? (includeExternal ? (platform === 'darwin' ? directories('/Volumes') : platform === 'win32' ? 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => `${letter}:\\`) : [...directories('/media'), ...directories(p.join('/media', p.basename(home))), ...directories('/mnt'), ...directories(p.join('/run/media', p.basename(home)))]) : []);
  const roots = [home, ...volumes];
  const containers = ['', 'development', 'Development', 'Developer', 'dev', 'tools', 'Tools', 'sdk', 'SDKs', 'src', 'sdks'];
  for (const root of roots) {
    for (const folder of containers) {
      const base = p.join(root, folder);
      flutter.push(p.join(base, 'flutter'));
      android.push(p.join(base, 'Android/sdk'), p.join(base, 'Android/Sdk'), p.join(base, 'android-sdk'));
    }
    flutter.push(p.join(root, 'fvm/default'), p.join(root, '.fvm/default'));
    for (const versions of [p.join(root, 'fvm/versions'), p.join(root, '.fvm/versions')]) flutter.push(...directories(versions).sort().reverse());
  }
  flutter.push(p.join(home, 'snap/flutter/common/flutter'), '/opt/flutter');
  // Homebrew wrappers resolve to the SDK through realpath above; cover GUI launches without PATH too.
  if (platform === 'darwin') for (const bin of ['/opt/homebrew/bin/flutter', '/usr/local/bin/flutter']) {
    if (isFile(bin)) flutter.push(p.dirname(p.dirname(realpath(bin))));
  }
  return {
    flutterSDK: [...new Set(flutter)].find(root => isFile(p.join(root, 'bin', flutterName))) || '',
    androidSDK: [...new Set(android)].find(root => isFile(p.join(root, 'platform-tools', adbName))) || ''
  };
}
export function detectedSDKs() {
  if (!cached || Date.now() - cached.at > 30000) cached = { at: Date.now(), value: discoverSDKs() };
  return cached.value;
}
