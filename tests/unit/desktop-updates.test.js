import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, readFile, rm, stat } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { newer, selectRelease, downloadURL, archiveEntries } = require('../../apps/desktop/src/updates/policy.cjs');
const { DesktopUpdater } = require('../../apps/desktop/src/updates/updater.cjs');
const { verifyFile } = require('../../apps/desktop/src/updates/install.cjs');
const { install } = require('../../apps/desktop/src/updates/mac-helper.cjs');
function release(version = '0.2.0-beta.20', platform = 'mac', arch = 'arm64') {
  const name = `Snapkit-${version}-${platform}-${arch}.${platform === 'mac' ? 'zip' : 'exe'}`;
  return { tag_name: 'v' + version, assets: [{ name, browser_download_url: `https://github.com/bimbimvqt/snapkit/releases/download/v${version}/${name}`, size: 100, digest: 'sha256:' + 'a'.repeat(64) }] };
}
test('updates choose a strictly newer matching platform and channel with a trusted asset digest', () => {
  assert.equal(newer('0.2.0-beta.20', '0.2.0-beta.9'), true);
  assert.equal(newer('0.2.0', '0.2.0-beta.20'), true);
  assert.equal(selectRelease([release('0.2.0-beta.18')], '0.2.0-beta.19', 'darwin', 'arm64'), null);
  assert.equal(selectRelease([release('0.3.0-beta.1')], '0.2.0', 'darwin', 'arm64'), null);
  const latest = selectRelease([release(), release('0.2.0')], '0.2.0-beta.19', 'darwin', 'arm64'); assert.equal(latest.version, '0.2.0');
  const wrong = release(); wrong.assets[0].browser_download_url = 'https://evil.example/update.zip'; assert.equal(selectRelease([wrong], '0.2.0-beta.19', 'darwin', 'arm64'), null);
  assert.equal(selectRelease([release()], '0.2.0-beta.19', 'win32', 'x64'), null);
  const noDigest = release(); delete noDigest.assets[0].digest; assert.equal(selectRelease([noDigest], '0.2.0-beta.19', 'darwin', 'arm64'), null);
  assert.throws(() => downloadURL('http://github.com/bimbimvqt/snapkit/releases/download/x/a'));
  assert.throws(() => downloadURL('https://github.com/other/project/releases/download/x/a'));
  assert.throws(() => downloadURL('https://github.com.evil.example/file'));
  assert.throws(() => archiveEntries('Snapkit.app/../../outside'));
  assert.throws(() => archiveEntries('/Snapkit.app/a'));
  archiveEntries('Snapkit.app/Contents/Info.plist\nSnapkit.app/Contents/MacOS/Snapkit\n');
});
test('checksum validation rejects a modified update file', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'snapkit-update-hash-')); const file = path.join(root, 'update');
  try { await writeFile(file, 'original'); const hash = createHash('sha256').update('original').digest('hex'); await verifyFile(file, hash); await writeFile(file, 'modified'); await assert.rejects(verifyFile(file, hash), /verification failed/); }
  finally { await rm(root, { recursive: true, force: true }); }
});
test('updater reports progress, keeps ready state, blocks installation during active tasks and cleans cancelled downloads', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'snapkit-update-state-'));
  let transfers = 0, installed = false;
  const updater = new DesktopUpdater({ version: '0.2.0-beta.19', platform: 'win32', arch: 'x64', packaged: true, executable: '/fake/Snapkit.exe', userData: root, releases: async () => [release('0.2.0-beta.20', 'win', 'x64')], download: async (asset, file, _signal, progress) => { transfers++; progress(50); await writeFile(file, 'fake'); }, install: async () => { installed = true; } });
  try {
    assert.equal((await updater.check()).status, 'available');
    await updater.download(); assert.equal(updater.snapshot().status, 'ready'); assert.equal(transfers, 1);
    assert.equal((await updater.check()).status, 'ready');
    await assert.rejects(updater.apply(async () => { throw Error('Active build'); }), /Active build/); assert.equal(installed, false); assert.equal(updater.snapshot().status, 'ready');
    await updater.apply(async () => {}); assert.equal(installed, true);
    const cancel = new DesktopUpdater({ version: '0.2.0-beta.19', platform: 'win32', arch: 'x64', packaged: true, userData: root, releases: async () => [release('0.2.0-beta.20', 'win', 'x64')], download: async (_a, file, signal) => { await writeFile(file, 'partial'); await new Promise((_, reject) => signal.addEventListener('abort', () => reject(Error('Abort')), { once: true })); } });
    await cancel.check(); cancel.beginDownload(); while (!await stat(cancel.file).catch(() => null)) await new Promise(resolve => setTimeout(resolve, 5)); cancel.cancel(); await cancel.pending; assert.equal(cancel.snapshot().status, 'available'); assert.equal(await stat(cancel.work).catch(() => null), null);
    await cancel.close();
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('macOS installation swaps bundles only after parent exits and restores previous bundle after launch failure', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'snapkit-update-swap-'));
  const token = randomUUID(), target = path.join(root, 'Snapkit.app'), stage = path.join(root, `.snapkit-update-${token}.app`), backup = path.join(root, `.snapkit-backup-${token}.app`), cache = path.join(root, 'updates');
  const plan = { token, target, stage, backup, cache, pid: 99999999 };
  try {
    for (const [directory, content] of [[target, 'old'], [stage, 'new']]) { await mkdir(directory); await writeFile(path.join(directory, 'version'), content); } await mkdir(cache);
    await assert.rejects(install(plan, { isAlive: () => true, delay: async () => {}, attempts: 1 }), /did not quit/); assert.equal(await readFile(path.join(target, 'version'), 'utf8'), 'old');
    let opens = 0;
    await assert.rejects(install(plan, { isAlive: () => false, delay: async () => {}, attempts: 1, command: async () => { if (++opens === 1) throw Error('Cannot launch'); } }), /Cannot launch/);
    assert.equal(await readFile(path.join(target, 'version'), 'utf8'), 'old'); assert.equal(await readFile(path.join(stage, 'version'), 'utf8'), 'new');
    await install(plan, { isAlive: () => false, delay: async () => {}, attempts: 1, command: async () => { await writeFile(path.join(cache, `ready-${token}`), 'ready'); } });
    assert.equal(await readFile(path.join(target, 'version'), 'utf8'), 'new'); assert.equal(await stat(backup).catch(() => null), null);
  } finally { await rm(root, { recursive: true, force: true }); }
});
