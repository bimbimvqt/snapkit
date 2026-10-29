import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { demoDevices, demoCatalog } from '../server/demo.js';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, 'dist');
await rm(out, { recursive: true, force: true });
await mkdir(path.join(out, 'preview/vendor'), { recursive: true });
await cp(path.join(root, 'site'), out, { recursive: true });
await cp(path.join(root, 'public/favicon.svg'), path.join(out, 'favicon.svg'));
await cp(path.join(root, 'public'), path.join(out, 'preview'), { recursive: true });
await cp(path.join(root, 'node_modules/lucide/dist/umd/lucide.js'), path.join(out, 'preview/vendor/lucide.js'));
const snapshot = {
  state: { demo: true, devices: demoDevices, sessions: [], logs: [], warnings: [], jobs: [], settings: { workspace: '/Projects/flutter_app', targetId: 'demo-ios-1' },
    storage: { iosDevices: '/Users/developer/Library/Developer/CoreSimulator/Devices', iosOnSSD: false, avd: '/SSD/SnapkitData/Android/avd', downloads: '/SSD/SnapkitData/downloads/iOS', iosReady: true }, screenshotDirectory: '/SSD/SnapkitData/screenshots', host: 'Preview', platform: 'darwin', scannedAt: '2026-01-01T00:00:00.000Z' },
  catalog: demoCatalog
};
await writeFile(path.join(out, 'preview/preview-data.js'), `window.SNAPKIT_PREVIEW = ${JSON.stringify(snapshot)};\n`);
const html = (await readFile(path.join(root, 'public/index.html'), 'utf8'))
  .replaceAll('href="/', 'href="./').replaceAll('src="/', 'src="./')
  .replace('<script src="./app.js"', '<script src="./preview-data.js" defer></script><script src="./app.js"');
await writeFile(path.join(out, 'preview/index.html'), html);
await writeFile(path.join(out, '.nojekyll'), '');
console.log('Built GitHub Pages website and read-only dashboard preview in dist/.');
