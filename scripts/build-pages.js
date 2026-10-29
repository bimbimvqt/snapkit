import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { demoDevices, demoCatalog } from '../server/demo.js';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, 'dist');
await rm(out, { recursive: true, force: true });
await mkdir(path.join(out, 'demo/vendor'), { recursive: true });
await cp(path.join(root, 'site'), out, { recursive: true });
await cp(path.join(root, 'public/favicon.svg'), path.join(out, 'favicon.svg'));
await cp(path.join(root, 'public'), path.join(out, 'demo'), { recursive: true });
await cp(path.join(root, 'node_modules/lucide/dist/umd/lucide.js'), path.join(out, 'demo/vendor/lucide.js'));
const snapshot = {
  state: { demo: true, devices: demoDevices, warnings: [], jobs: [], settings: { workspace: '/Projects/flutter_app', targetIds: [] },
    storage: { iosDevices: '/Users/developer/Library/Developer/CoreSimulator/Devices', iosOnSSD: false, avd: '/SSD/SnapkitData/Android/avd', downloads: '/SSD/SnapkitData/downloads/iOS', iosReady: true }, host: 'Preview', platform: 'darwin', scannedAt: '2026-01-01T00:00:00.000Z' },
  catalog: demoCatalog
};
await writeFile(path.join(out, 'demo/preview-data.js'), `window.SNAPKIT_PREVIEW = ${JSON.stringify(snapshot)};\n`);
const html = (await readFile(path.join(root, 'public/index.html'), 'utf8'))
  .replaceAll('href="/', 'href="./').replaceAll('src="/', 'src="./')
  .replace('<script src="./app.js"', '<script src="./preview-data.js" defer></script><script src="./app.js"');
await writeFile(path.join(out, 'demo/index.html'), html);
await mkdir(path.join(out, 'control/vendor'), { recursive: true });
await cp(path.join(root, 'public'), path.join(out, 'control'), { recursive: true });
await cp(path.join(root, 'node_modules/lucide/dist/umd/lucide.js'), path.join(out, 'control/vendor/lucide.js'));
await writeFile(path.join(out, 'control/controller-config.js'), 'window.SNAPKIT_CONTROLLER = true;\n');
await writeFile(path.join(out, 'control/index.html'), html.replace('preview-data.js', 'controller-config.js'));
// Preserve old bookmarks as a fully functional controller, including pairing fragments.
await cp(path.join(out, 'control'), path.join(out, 'preview'), { recursive: true });
await writeFile(path.join(out, '.nojekyll'), '');
console.log('Built website, explicit demo and paired controllers at control/ and preview/ in dist/.');
