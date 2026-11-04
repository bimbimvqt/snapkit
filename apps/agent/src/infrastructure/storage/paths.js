import path from 'node:path';
import os from 'node:os';
import { existsSync } from 'node:fs';

export function userDataDirectory({ platform = process.platform, home = os.homedir(), env = process.env } = {}) {
  if (env.SNAPKIT_DATA_ROOT) return path.resolve(env.SNAPKIT_DATA_ROOT);
  if (platform === 'darwin') return path.join(home, 'Library/Application Support/Snapkit');
  if (platform === 'win32') return path.join(env.APPDATA || path.join(home, 'AppData/Roaming'), 'Snapkit');
  return path.join(env.XDG_DATA_HOME || path.join(home, '.local/share'), 'snapkit');
}
export function androidSDKDirectory({ platform = process.platform, home = os.homedir(), env = process.env, exists = existsSync } = {}) {
  if (env.ANDROID_SDK_ROOT || env.ANDROID_HOME) return env.ANDROID_SDK_ROOT || env.ANDROID_HOME;
  const candidates = platform === 'darwin' ? [path.join(home, 'Library/Android/sdk')] : platform === 'win32' ? [path.join(env.LOCALAPPDATA || path.join(home, 'AppData/Local'), 'Android/Sdk')] : [path.join(home, 'Android/Sdk'), path.join(home, 'Android/sdk')];
  return candidates.find(exists) || candidates[0];
}
// Preserve existing installations; a drive with the same name on a new machine is not a configuration.
const legacy = '/Volumes/SanDiskSSDData/SnapkitData';
export const dataRoot = process.env.SNAPKIT_DATA_ROOT ? path.resolve(process.env.SNAPKIT_DATA_ROOT) : process.platform === 'darwin' && existsSync(path.join(legacy, 'state/settings.json')) ? legacy : userDataDirectory();
