'use strict';
// Runs outside the application bundle so replacement never edits a running bundle.
let nativeFS;
try { nativeFS = require('original-fs'); } catch { nativeFS = require('node:fs'); }
const fs = nativeFS.promises;
const path = require('node:path');
const { promisify } = require('node:util');
const run = promisify(require('node:child_process').execFile);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function install(plan, { command = run, delay = pause, isAlive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } }, attempts = 120 } = {}) {
  const { target, stage, backup, pid, token, cache } = plan;
  if (!Number.isSafeInteger(pid) || !/^[a-f0-9-]{36}$/.test(token) || !path.isAbsolute(target) || !target.endsWith('.app') || stage !== path.join(path.dirname(target), `.snapkit-update-${token}.app`) || backup !== path.join(path.dirname(target), `.snapkit-backup-${token}.app`)) throw Error('Invalid installation plan.');
  let alive = true;
  for (let attempt = 0; attempt < attempts; attempt++) { if (!isAlive(pid)) { alive = false; break; } await delay(500); }
  if (alive) throw Error('Snapkit did not quit. The installed app has not been changed.');
  let swapped = false, moved = false;
  try {
    await fs.rename(target, backup); moved = true;
    await fs.rename(stage, target); swapped = true;
    await command('/usr/bin/open', ['-n', target, '--args', `--snapkit-update-token=${token}`]);
    // The new main process acknowledges after its agent and renderer are ready.
    const marker = path.join(cache, `ready-${token}`);
    for (let attempt = 0; attempt < attempts; attempt++) { if (await fs.stat(marker).catch(() => null)) {
      await fs.rm(backup, { recursive: true, force: true });
      await fs.rm(path.join(cache, token), { recursive: true, force: true });
      await fs.writeFile(path.join(cache, 'result.json'), JSON.stringify({ status: 'installed' })); return;
    } await delay(500); }
    throw Error('The updated app did not finish starting. The previous version was restored.');
  } catch (error) {
    // Never delete project data, userData, preferences or captures during rollback.
    if (swapped) {
      const newPid = Number(await fs.readFile(path.join(cache, `starting-${token}`), 'utf8').catch(() => ''));
      if (Number.isSafeInteger(newPid) && newPid > 1 && newPid !== process.pid) {
        try { process.kill(newPid, 'SIGTERM'); } catch {}
        for (let attempt = 0; attempt < 40 && isAlive(newPid); attempt++) await delay(500);
        if (isAlive(newPid)) throw Error('The updated app is still running. Close it before restoring the backup at ' + backup);
      }
      await fs.rename(target, stage);
    }
    if (moved) { await fs.rename(backup, target); await command('/usr/bin/open', ['-n', target]); }
    throw error;
  }
}
if (require.main === module) {
  delete process.env.ELECTRON_RUN_AS_NODE;
  fs.readFile(process.argv[2], 'utf8').then(JSON.parse).then(async plan => {
    try { await install(plan); } catch (error) { await fs.writeFile(path.join(plan.cache, 'result.json'), JSON.stringify({ status: 'error', error: error.message })); }
  }).catch(() => { process.exitCode = 1; });
}
module.exports = { install };
