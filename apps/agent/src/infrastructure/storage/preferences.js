import { readFileSync } from 'node:fs';
import { mkdir, writeFile, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import { dataRoot } from './paths.js';
const file = path.join(dataRoot, 'state/preferences.json');
let preferences = {};
try { preferences = JSON.parse(readFileSync(file, 'utf8')); } catch {}
if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) preferences = {};
const supportedEditors = ['vscode', 'cursor', 'antigravity'];
export const getPreferences = () => ({ flutterSDK: preferences.flutterSDK || '', androidSDK: preferences.androidSDK || '', editor: supportedEditors.includes(preferences.editor) ? preferences.editor : 'vscode', onboardingComplete: preferences.onboardingComplete === true });
export async function savePreferences(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid preferences');
  const next = getPreferences();
  for (const key of ['flutterSDK', 'androidSDK']) if (input[key] !== undefined) {
    if (typeof input[key] !== 'string' || input[key].length > 4096) throw new Error('Choose a valid SDK folder');
    const value = input[key].trim();
    if (value && (!path.isAbsolute(value) || !(await stat(value).catch(() => null))?.isDirectory())) throw new Error('SDK folder does not exist on this computer');
    if (value) {
      const executable = key === 'flutterSDK' ? path.join(value, 'bin', process.platform === 'win32' ? 'flutter.bat' : 'flutter') : path.join(value, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
      if (!(await stat(executable).catch(() => null))?.isFile()) throw new Error(key === 'flutterSDK' ? 'Choose the Flutter SDK folder containing bin/flutter' : 'Choose the Android SDK folder containing platform-tools/adb');
    }
    next[key] = value;
  }
  if (input.editor !== undefined) {
    if (!supportedEditors.includes(input.editor)) throw new Error('Choose a supported editor');
    next.editor = input.editor;
  }
  if (input.onboardingComplete !== undefined) next.onboardingComplete = input.onboardingComplete === true;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file + '.tmp', JSON.stringify(next, null, 2), { mode: 0o600 });
  await rename(file + '.tmp', file); preferences = next;
  return getPreferences();
}
