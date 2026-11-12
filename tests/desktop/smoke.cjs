const { spawn } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync, statSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tmp = mkdtempSync(path.join(os.tmpdir(), 'snapkit-smoke-'));
const output = path.join(tmp, 'result.json');
const child = spawn(require('electron'), ['.'], { stdio: 'inherit', env: { ...process.env, SNAPKIT_DATA_ROOT: tmp, SNAPKIT_DESKTOP_DEMO: '1', SNAPKIT_SMOKE_TEST: '1', SNAPKIT_SMOKE_OUTPUT: output } });
const timer = setTimeout(() => { child.kill(); process.exitCode = 1; }, 60000);
child.on('error', error => { clearTimeout(timer); console.error(error.message); process.exitCode = 1; });
child.on('exit', code => {
  clearTimeout(timer);
  try { const shutdownMs=Date.now()-statSync(output).mtimeMs; if(shutdownMs>5000)throw new Error('Idle desktop shutdown took '+Math.round(shutdownMs)+'ms'); const result = JSON.parse(readFileSync(output)); if (code !== 0 || !result.desktop || !result.bridge || !result.ui || !result.languages || !result.splash || !result.kit || !result.everyday || !result.clipboard || !result.mini) throw new Error('Desktop smoke failed: '+JSON.stringify(result)); console.log('Desktop window, preload bridge and local agent passed:', {...result,shutdownMs:Math.round(shutdownMs)}); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { rmSync(tmp, { recursive: true, force: true }); }
});
