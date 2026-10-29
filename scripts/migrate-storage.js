// Explicit one-time migration. Run only after stopping Snapkit and virtual devices.
// Copy sparse files, verify with rsync checksums, then switch the original path to a symlink.
import { lstat, mkdir, readdir, rename, symlink, unlink, rm, realpath, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
const destination = process.env.SNAPKIT_DATA_ROOT || '/Volumes/SanDiskSSDData/SnapkitData';
if (process.platform !== 'darwin') throw new Error('This migration script is for this macOS SSD setup');
if (!destination.startsWith('/Volumes/')) throw new Error('Use a mounted external volume');
await realpath(path.join('/Volumes', destination.split('/')[2]));
const active = JSON.parse(execFileSync('xcrun', ['simctl', 'list', 'devices', '--json'], { encoding: 'utf8' }));
if (Object.values(active.devices).flat().some(d => d.state !== 'Shutdown' && d.state !== 'Unavailable')) throw new Error('Shut down all iOS simulators before migration');
const sdk = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME || '/Volumes/SanDiskSSDData/Android/sdk';
const connected = execFileSync(path.join(sdk, 'platform-tools/adb'), ['devices'], { encoding: 'utf8' });
if (/^emulator-\d+\s/m.test(connected)) throw new Error('Shut down all Android emulators before migration');
for (const [source, target] of [
  [path.join(os.homedir(), '.android/avd'), path.join(destination, 'Android/avd')],
  [path.join(os.homedir(), 'Library/Developer/CoreSimulator/Devices'), path.join(destination, 'iOS/Devices')]
]) {
  const stat = await lstat(source).catch(() => null);
  if (stat?.isSymbolicLink()) {
    if (await realpath(source) !== await realpath(target)) throw new Error(`${source} already points elsewhere`);
    console.log(`Already on SSD: ${source}`); continue;
  }
  await mkdir(target, { recursive: true });
  if ((await readdir(target)).length) throw new Error(`Destination is not empty: ${target}; refusing to merge data`);
  if (stat) {
    console.log(`Copying ${source} → ${target}`);
    execFileSync('/usr/bin/rsync', ['-aS', `${source}/`, `${target}/`], { stdio: 'inherit' });
    console.log('Copying and verifying extended attributes…');
    execFileSync('python3', [fileURLToPath(new URL('./copy-xattrs.py', import.meta.url)), source, target], { stdio: 'inherit' });
    console.log('Verifying file contents and metadata…');
    const changes = execFileSync('/usr/bin/rsync', ['-aScni', '--delete', `${source}/`, `${target}/`], { encoding: 'utf8' });
    if (changes.trim()) throw new Error(`Verification failed. Original preserved; destination retained for inspection:\n${changes}`);
    const backup = `${source}.snapkit-migrating-${Date.now()}`;
    await rename(source, backup);
    try {
      await symlink(target, source);
      if (source.endsWith('/CoreSimulator/Devices')) {
        execFileSync('launchctl', ['kickstart', '-k', `user/${process.getuid()}/com.apple.CoreSimulator.CoreSimulatorService`]);
        const listed = JSON.parse(execFileSync('xcrun', ['simctl', 'list', 'devices', '--json'], { encoding: 'utf8' }));
        const ids = new Set(Object.values(listed.devices).flat().map(d => d.udid));
        const missing = (await readdir(backup)).filter(id => /^[0-9A-F-]{36}$/i.test(id) && !ids.has(id));
        if (missing.length) throw new Error('CoreSimulator cannot read the SSD device set. Restoring the original internal device directory.');
      }
    } catch (e) {
      if ((await lstat(source).catch(() => null))?.isSymbolicLink()) await unlink(source);
      await rename(backup, source);
      if (source.endsWith('/CoreSimulator/Devices')) execFileSync('launchctl', ['kickstart', '-k', `user/${process.getuid()}/com.apple.CoreSimulator.CoreSimulatorService`]);
      throw e;
    }
    // Original was verified byte-for-byte; remove the redundant internal copy.
    await rm(backup, { recursive: true });
  } else { await mkdir(path.dirname(source), { recursive: true }); await symlink(target, source); }
  // avdmanager stores an absolute .avd directory path in each pointer file.
  if (source.endsWith('/avd')) for (const name of await readdir(target)) if (name.endsWith('.ini')) {
    const file = path.join(target, name); const raw = await readFile(file, 'utf8');
    await writeFile(file, raw.replace(/^path=(.+)$/m, (_m, previous) => previous.startsWith(source + path.sep) ? `path=${path.join(target, path.basename(previous))}` : `path=${previous}`));
  }
  console.log(`SSD ready: ${source} → ${target}`);
}
