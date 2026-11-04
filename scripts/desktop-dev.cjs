'use strict';
const { spawn } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const local = process.argv.includes('--local');
console.log(`Snapkit Dev · ${local ? 'real devices, separate sign-in and settings' : 'demo devices, no sign-in'} · http://127.0.0.1:4311`);
console.log('Vite rebuilds React/TypeScript/CSS on save; desktop reloads the compiled UI.');
const builder = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--watch', '--config', 'apps/dashboard/vite.config.ts'], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
let child, output = '', closing = false;
function stop() { if (closing) return; closing = true; child?.kill(); builder.kill(); }
builder.stdout.on('data', chunk => {
  process.stdout.write(chunk); output = (output + chunk).slice(-8000);
  if (!child && /built in/.test(output)) {
    child = spawn(require('electron'), [root], { cwd: root, stdio: 'inherit', env: { ...process.env, SNAPKIT_DEV: '1', SNAPKIT_DESKTOP_DEMO: local ? '0' : '1' } });
    child.once('error', error => { console.error(error.message); process.exitCode = 1; stop(); });
    child.once('exit', code => { process.exitCode = code ?? 1; stop(); });
  }
});
builder.once('error', error => { console.error(error.message); process.exitCode = 1; stop(); });
builder.once('exit', code => { if (!closing) { process.exitCode = code || 1; stop(); } });
process.once('SIGINT', stop); process.once('SIGTERM', stop);
