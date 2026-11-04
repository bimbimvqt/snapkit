'use strict';
// Explicit allowlist: no app data, Flutter workspaces, SDKs or dependencies.
const fs = require('node:fs/promises');
const path = require('node:path');
(async () => {
  const root = path.resolve(__dirname, '..');
  const folders = ['dist', 'test-results', 'playwright-report', ...(!process.argv.includes('--keep-release') ? ['release'] : [])];
  for (const folder of folders) { await fs.rm(path.join(root, folder), { recursive: true, force: true }); console.log('Removed generated output: ' + folder); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
