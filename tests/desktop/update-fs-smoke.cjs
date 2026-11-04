'use strict';
// Must run in real Electron: ordinary Node tests cannot reproduce ASAR fs behavior.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
(async () => {
  const root = path.resolve(__dirname, '../..'), temp = await fs.mkdtemp(path.join(os.tmpdir(), 'snapkit-update-fs-'));
  let child;
  try {
    const source = path.join(temp, 'source'); await fs.mkdir(source);
    await fs.writeFile(path.join(source, 'index.js'), 'module.exports = "update regression fixture";');
    await fs.mkdir(path.join(source, 'updates'));
    for (const file of ['install.cjs', 'filesystem.cjs', 'policy.cjs', 'mac-helper.cjs']) await fs.copyFile(path.join(root, 'apps/desktop/src/updates', file), path.join(source, 'updates', file));
    const archive = path.join(temp, 'app.asar'); await require('@electron/asar').createPackage(source, archive);
    const script = path.join(temp, 'main.cjs');
    await fs.writeFile(script, `
      const { app } = require('electron');
      const path = require('node:path'), assert = require('node:assert/strict');
      const native = require(${JSON.stringify(path.join(root, 'apps/desktop/src/updates/filesystem.cjs'))}).promises;
      const { DesktopUpdater } = require(${JSON.stringify(path.join(root, 'apps/desktop/src/updates/updater.cjs'))});
      app.setPath('userData', ${JSON.stringify(path.join(temp, 'profile'))});
      app.whenReady().then(async () => {
        const base = ${JSON.stringify(temp)}, source = ${JSON.stringify(archive)};
        const { writeMacHelper } = require(path.join(source, 'updates/install.cjs'));
        const helper = await writeMacHelper(path.join(base, 'helper-cache'));
        assert.match(await native.readFile(helper, 'utf8'), /async function install/);
        const raw = path.join(base, 'unpacked'); await native.mkdir(raw);
        await native.copyFile(source, path.join(raw, 'app.asar'));
        assert.equal((await native.stat(path.join(raw, 'app.asar'))).isFile(), true);
        await native.rm(raw, { recursive: true, force: true });
        await assert.rejects(native.stat(raw), /ENOENT/);
        const updater = new DesktopUpdater({version:'0.2.0-beta.20',platform:process.platform,arch:process.arch,packaged:true,userData:base,download:async()=>{},prepare:async({file})=>{
          const folder=path.join(path.dirname(file),'unpacked');await native.mkdir(folder);await native.copyFile(source,path.join(folder,'app.asar'));throw Error('Signature check failed');
        }});
        updater.platform='darwin';updater.asset={version:'0.2.0-beta.21',name:'update.zip',size:100};updater.state.status='available';
        updater.beginDownload();await updater.pending;
        assert.equal(updater.snapshot().status,'error');assert.match(updater.snapshot().error,/Signature check failed/);
        await assert.rejects(native.stat(updater.work),/ENOENT/);
        await updater.close();
        console.log('PASS: real Electron reads the installer from inside ASAR, removes ASAR bundles as raw files, cleans partial updates and exits verification with a retryable error.');app.exit(0);
      }).catch(error=>{console.error(error);app.exit(1)});
    `);
    child = spawn(require('electron'), [script], { stdio: 'inherit' });
    const timer = setTimeout(() => child.kill(), 30000);
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); }); clearTimeout(timer);
    if (code !== 0) throw Error('Electron updater filesystem smoke failed.');
  } finally { if (child && child.exitCode === null) child.kill(); await fs.rm(temp, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
