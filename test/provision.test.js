import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile, symlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { iosCompatible, parseAndroidImages, parseAndroidProfiles, Provisioner } from '../server/provision.js';
import { chooseFolder } from '../server/folders.js';
import { screenshotFolder, storage, iosAccessStatus, selectIOSDeviceRoot } from '../server/storage.js';

test('iOS recovery respects a native device set and preserves SSD selection for symlinked storage', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'snapkit-recovery-'));
  try {
    const native = path.join(root, 'Devices'), ssd = path.join(root, 'SSD');
    await mkdir(native); await mkdir(ssd);
    assert.equal(selectIOSDeviceRoot(native, ssd, 'darwin'), native);
    await rm(native, { recursive: true });
    await symlink(ssd, native);
    assert.equal(selectIOSDeviceRoot(native, ssd, 'darwin'), ssd);
    assert.equal(selectIOSDeviceRoot(native, ssd, 'win32'), ssd);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('native folder picker returns host path without uploading files and handles cancel', async () => {
  const calls = [];
  assert.deepEqual(await chooseFolder({ platform: 'darwin', execute: async (...args) => { calls.push(args); return '/Volumes/SSD/My Project/\n'; } }), { path: '/Volumes/SSD/My Project/' });
  assert.equal(calls[0][0], 'osascript');
  assert.deepEqual(await chooseFolder({ platform: 'darwin', execute: async () => { throw new Error('User canceled. (-128)'); } }), { cancelled: true });
  assert.deepEqual(await chooseFolder({ platform: 'win32', execute: async () => 'C:\\Projects\\Flutter App\r\n' }), { path: 'C:\\Projects\\Flutter App' });
  await assert.rejects(chooseFolder({ platform: 'darwin', execute: async () => { throw new Error('Permission denied'); } }), /could not open/);
});
test('iOS compatibility enforces version range, architecture and runtime supported models', () => {
  const model = { identifier: 'phone', minRuntimeVersion: 18 * 65536, maxRuntimeVersion: 26 * 65536 + 65535 };
  const runtime = { version: '18.3.1', isAvailable: true, supportedArchitectures: ['arm64'], supportedDeviceTypes: [{ identifier: 'phone' }] };
  assert.equal(iosCompatible(model, runtime, 'arm64'), true);
  assert.equal(iosCompatible(model, { ...runtime, version: '17.5' }, 'arm64'), false);
  assert.equal(iosCompatible(model, { ...runtime, version: '27.0' }, 'arm64'), false);
  assert.equal(iosCompatible(model, { ...runtime, isAvailable: false }, 'arm64'), false);
  assert.equal(iosCompatible(model, runtime, 'x64'), false);
  assert.equal(iosCompatible({ ...model, identifier: 'old-phone' }, runtime, 'arm64'), false);
});
test('Android catalog keeps 16KB Play images, excludes wrong CPU ABI and records installed state', () => {
  const images = parseAndroidImages(`Installed packages:
 system-images;android-36;google_apis_playstore_ps16k;arm64-v8a | 7 | Installed
 system-images;android-35;google_apis;x86_64 | 1 | Wrong ABI
Available Packages:
 system-images;android-36;google_apis_playstore_ps16k;arm64-v8a | 7 | Available too
 system-images;android-34;google_apis;arm64-v8a | 1 | Download`, 'arm64');
  assert.equal(images.length, 2); assert.equal(images[0].installed, true); assert.equal(images[1].installed, false);
  const profiles = parseAndroidProfiles(`Available devices definitions:
id: 0 or "pixel_9"
 Name: Pixel 9
 OEM: Google
---------
id: 1 or "tv"
 Name: Android TV
 Tag: android-tv
---------`);
  assert.deepEqual(profiles, [{ id: 'pixel_9', name: 'Pixel 9', tag: null }]);
});
function completed(manager, job) {
  if (job.status !== 'running') return Promise.resolve(job);
  return new Promise(resolve => { const listener = () => { if (job.status !== 'running') { manager.off('jobs', listener); resolve(job); } }; manager.on('jobs', listener); });
}
async function fixture(fn) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'snapkit-provision-'));
  const paths = { root, sdk: path.join(root, 'sdk'), avd: path.join(root, 'avd'), iosDevices: path.join(root, 'ios'), downloads: path.join(root, 'downloads'), state: path.join(root, 'state') };
  for (const p of Object.values(paths)) await mkdir(p, { recursive: true });
  try { await fn(paths); } finally { await new Promise(r => setTimeout(r, 30)); await rm(root, { recursive: true, force: true }); }
}
test('provisioning revalidates pairs and creates Android AVD explicitly in SSD data path', async () => fixture(async paths => {
  const calls = [];
  const execute = async (command, args, options) => {
    calls.push({ command, args, options });
    if (command === 'avdmanager' && args[0] === 'list') return 'id: 0 or "pixel_9"\n Name: Pixel 9\n';
    if (command === 'sdkmanager') return 'Installed packages:\n system-images;android-35;google_apis;arm64-v8a | 1 | Pixel';
    if (command === 'avdmanager' && args[0] === 'create') return 'AVD created';
    throw new Error('Unexpected command');
  };
  const manager = new Provisioner({ execute, paths, platform: 'win32', arch: 'arm64' });
  await assert.rejects(manager.create({ platform: 'android', name: 'Pixel test', model: 'pixel_9', runtime: 'unknown' }), /installed Android image/);
  const job = await manager.create({ platform: 'android', name: 'Pixel test', model: 'pixel_9', runtime: 'system-images;android-35;google_apis;arm64-v8a' });
  await completed(manager, job); assert.equal(job.status, 'completed');
  const create = calls.find(c => c.args[0] === 'create');
  assert.equal(create.args.at(-1), path.join(paths.avd, 'Pixel_test.avd')); assert.equal(create.options.input, 'no\n');
  assert.ok(!create.args.includes('--force'));
  await assert.rejects(manager.create({ platform: 'android', name: '../../escape', model: 'pixel_9', runtime: 'anything' }), /device name/);
}));
test('jobs surface failures, serialize installations, and reject runtime path escape', async () => fixture(async paths => {
  const manager = new Provisioner({ paths, platform: 'darwin', execute: async () => { throw new Error('download unavailable'); } });
  const job = manager.downloadIOS('18.5');
  assert.throws(() => manager.downloadIOS('26.1'), /Another provisioning/);
  await completed(manager, job); assert.equal(job.status, 'error'); assert.match(job.error, /download unavailable/);
  assert.throws(() => manager.downloadIOS('18.5; arbitrary-command'), /iOS version/);
  const outside = path.join(paths.root, 'outside.dmg'); await writeFile(outside, 'not a runtime');
  await symlink(outside, path.join(paths.downloads, 'linked.dmg'));
  await assert.rejects(manager.importIOS('linked.dmg'), /inside the SSD/);
}));
test('screenshots are namespaced by canonical workspace and stay in configured SSD root', () => {
  const a = screenshotFolder('/projects/a/app'), b = screenshotFolder('/projects/b/app');
  assert.notEqual(a, b); assert.ok(a.startsWith(storage.screenshots + path.sep));
});

test('iOS storage warns when SSD device data cannot be enumerated by CoreSimulator', async () => fixture(async paths => {
  const id = 'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE';
  await mkdir(path.join(paths.iosDevices, id));
  const blocked = await iosAccessStatus({ devices: {} }, { deviceRoot: paths.iosDevices, platform: 'darwin' });
  assert.equal(blocked.blocked, true);
  assert.match(blocked.reason, /Full Disk Access/);
  const visible = await iosAccessStatus({ devices: { ios: [{ udid: id }] } }, { deviceRoot: paths.iosDevices, platform: 'darwin' });
  assert.equal(visible.blocked, false);
}));
