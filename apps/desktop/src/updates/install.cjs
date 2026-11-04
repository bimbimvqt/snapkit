'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const { createHash } = require('node:crypto');
const { createReadStream } = require('node:fs');
const { archiveEntries } = require('./policy.cjs');
const run = promisify(execFile);
async function verifyFile(file, expected) {
  const hash = createHash('sha256'); for await (const chunk of createReadStream(file)) hash.update(chunk);
  if (hash.digest('hex') !== expected) throw Error('Update verification failed. Download the update again.');
}
async function verifyBundle(bundle, version, arch) {
  await run('/usr/bin/codesign', ['--verify', '--deep', '--strict', bundle], { timeout: 60000 });
  const { stdout } = await run('/usr/bin/plutil', ['-convert', 'json', '-o', '-', path.join(bundle, 'Contents/Info.plist')]);
  const info = JSON.parse(stdout);
  if (info.CFBundleIdentifier !== 'dev.snapkit.desktop' || info.CFBundleShortVersionString !== version || info.CFBundleExecutable !== 'Snapkit') throw Error('The update is not a matching Snapkit app.');
  const { stdout: architectures } = await run('/usr/bin/lipo', ['-archs', path.join(bundle, 'Contents/MacOS/Snapkit')]);
  if (!architectures.trim().split(/\s+/).includes(arch)) throw Error('The update does not support this Mac.');
}
function appBundle(executable) { return path.resolve(path.dirname(executable), '../..'); }
async function prepareMac({ file, version, arch, executable, token }) {
  const target = appBundle(executable);
  if (!target.endsWith('.app') || target.startsWith('/Volumes/Snapkit') || target.includes('/AppTranslocation/')) throw Error('Move Snapkit to a writable Applications folder before updating.');
  await fs.access(path.dirname(target), require('node:fs').constants.W_OK);
  const stage = path.join(path.dirname(target), `.snapkit-update-${token}.app`);
  const extract = path.join(path.dirname(file), 'unpacked');
  try {
    const { stdout } = await run('/usr/bin/unzip', ['-Z1', file], { maxBuffer: 16 * 1024 * 1024, timeout: 30000 }); archiveEntries(stdout);
    await fs.mkdir(extract, { recursive: true });
    await run('/usr/bin/ditto', ['-x', '-k', file, extract], { timeout: 120000 });
    const bundle = path.join(extract, 'Snapkit.app'); await verifyBundle(bundle, version, arch);
    await run('/usr/bin/ditto', [bundle, stage], { timeout: 120000 });
    await verifyBundle(stage, version, arch);
    return { target, stage, backup: path.join(path.dirname(target), `.snapkit-backup-${token}.app`) };
  } catch (error) { await fs.rm(stage, { recursive: true, force: true }); throw error; }
  finally { await fs.rm(extract, { recursive: true, force: true }); }
}
async function startInstaller({ platform, executable, cache, file, asset, paths, token }) {
  await verifyFile(file, asset.sha256);
  if (platform === 'win32') {
    const child = spawn(file, ['/S', '--force-run'], { detached: true, stdio: 'ignore', windowsHide: true });
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); }); child.unref(); return;
  }
  await verifyBundle(paths.stage, asset.version, process.arch);
  const helper = path.join(cache, 'install-helper.cjs'), plan = path.join(cache, 'install.json');
  await fs.copyFile(path.join(__dirname, 'mac-helper.cjs'), helper);
  await fs.writeFile(plan, JSON.stringify({ ...paths, pid: process.pid, token, cache }), { mode: 0o600 });
  const child = spawn(executable, [helper, plan], { detached: true, stdio: 'ignore', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } });
  await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); }); child.unref();
}
module.exports = { verifyFile, verifyBundle, appBundle, prepareMac, startInstaller };
