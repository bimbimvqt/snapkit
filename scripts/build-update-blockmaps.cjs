'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { scan } = require('../apps/desktop/src/updates/blocks.cjs');
(async () => {
  const folder = path.resolve(process.argv[2] || 'release');
  const names = (await fs.readdir(folder)).filter(name => /^Snapkit-\d+\.\d+\.\d+(?:-(?:beta|rc)\.\d+)?-(?:mac-(?:arm64|x64)\.zip|win-x64\.exe)$/.test(name));
  if (!names.length) throw Error('No desktop update packages found.');
  for (const name of names) { const map = await scan(path.join(folder, name)); await fs.writeFile(path.join(folder, name + '.blockmap.json'), JSON.stringify(map)); console.log(`${name}: ${map.blocks.length} verified blocks`); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
