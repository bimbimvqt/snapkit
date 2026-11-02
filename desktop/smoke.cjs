const { spawn } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tmp = mkdtempSync(path.join(os.tmpdir(), 'snapkit-smoke-'));
const output = path.join(tmp, 'result.json');
const child = spawn(require('electron'), ['.'], { stdio: 'inherit', env: { ...process.env, SNAPKIT_DATA_ROOT: tmp, SNAPKIT_DESKTOP_DEMO: '1', SNAPKIT_SMOKE_TEST: '1', SNAPKIT_SMOKE_OUTPUT: output } });
const timer = setTimeout(() => { child.kill(); process.exitCode = 1; }, 45000);
child.on('error', error => { clearTimeout(timer); console.error(error.message); process.exitCode = 1; });
child.on('exit', code => {
  clearTimeout(timer);
  try { const result = JSON.parse(readFileSync(output)); if (code !== 0 || !result.desktop || !result.bridge || !result.ui) throw new Error('Desktop smoke failed'); console.log('Desktop window, preload bridge and local agent passed:', result); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { rmSync(tmp, { recursive: true, force: true }); }
});
