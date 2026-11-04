'use strict';
// Exercises the real packaged archive, swap, app launch and startup acknowledgement.
// Uses a temporary app/profile and separate agent port; never touches the installed app.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { createHash, randomUUID } = require('node:crypto');
const { promisify } = require('node:util');
const exec = promisify(require('node:child_process').execFile);
const { prepareMac, verifyFile } = require('../../apps/desktop/src/updates/install.cjs');
const { install } = require('../../apps/desktop/src/updates/mac-helper.cjs');
(async () => {
  if (process.platform !== 'darwin') throw Error('This packaged upgrade smoke requires macOS.');
  const root = path.resolve(__dirname, '../..'), version = require('../../package.json').version;
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'snapkit-packaged-upgrade-'));
  const target = path.join(temp, 'Snapkit.app'), cache = path.join(temp, 'data/snapkit-smoke-profile/updates'), token = randomUUID();
  const file = path.join(root, 'release', `Snapkit-${version}-mac-${process.arch}.zip`);
  let child, output = '';
  try {
    await fs.mkdir(cache, { recursive: true });
    const hash = createHash('sha256').update(await fs.readFile(file)).digest('hex'); await verifyFile(file, hash);
    // The old and new copies deliberately share a version: this is filesystem/startup QA,
    // while release-policy tests separately enforce strictly newer versions.
    await exec('/usr/bin/ditto', [path.join(root, 'release', process.arch === 'arm64' ? 'mac-arm64' : 'mac', 'Snapkit.app'), target]);
    const paths = await prepareMac({ file, version, arch: process.arch, executable: path.join(target, 'Contents/MacOS/Snapkit'), token });
    const plan = { ...paths, pid: 99999999, token, cache };
    await fs.writeFile(path.join(cache, 'install.json'), JSON.stringify(plan));
    let exit;
    await install(plan, { isAlive: () => false, command: async (_command, args) => {
      child = spawn(path.join(target, 'Contents/MacOS/Snapkit'), args.slice(args.indexOf('--args') + 1), { stdio: 'pipe', env: { ...process.env, SNAPKIT_DATA_ROOT: path.join(temp, 'data'), SNAPKIT_DESKTOP_DEMO: '1', SNAPKIT_SMOKE_TEST: '1', SNAPKIT_SMOKE_OUTPUT: path.join(temp, 'result.json'), SNAPKIT_SMOKE_PORT: '14329' } });
      child.stdout.on('data', value => { output += value.toString(); }); child.stderr.on('data', value => { output += value.toString(); });
      exit = new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
    } });
    if (await exit !== 0) throw Error('Packaged updated app failed to exit cleanly.');
    const result = JSON.parse(await fs.readFile(path.join(temp, 'result.json'), 'utf8'));
    if (result.version !== version || !result.splash || !result.languages || !result.bridge || !result.desktop) throw Error('Packaged app readiness failed.');
    if (await fs.stat(paths.backup).catch(() => null)) throw Error('Backup was not cleaned after successful startup.');
    console.log('PASS: actual ZIP/hash, bundle signature/version/architecture, staging/swap, packaged agent/renderer acknowledgement, backup cleanup.', result);
  } catch (error) { console.error(output.slice(-5000)); throw error; }
  finally { if (child && child.exitCode === null) child.kill(); await fs.rm(temp, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
