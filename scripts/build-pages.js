import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { buildSeoPages } from './build-seo-pages.js';
import { demoDevices, demoCatalog } from '../apps/agent/src/fixtures/demo.js';
import { notFoundPage } from '../packages/web/not-found.js';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, 'dist');
await build({ configFile: path.join(root, 'apps/dashboard/vite.config.ts') });
await rm(out, { recursive: true, force: true });
await mkdir(path.join(out, 'demo'), { recursive: true });
await cp(path.join(root, 'apps/website'), out, { recursive: true });
await buildSeoPages(out);
for (const language of ['vi', 'en']) await writeFile(path.join(out, language === 'en' ? 'en/404.html' : '404.html'), notFoundPage({ language, base: process.env.SNAPKIT_PAGES_BASE || '/' }));
await cp(path.join(root, 'packages/ui/i18n.js'), path.join(out, 'i18n.js'));
await cp(path.join(root, 'packages/ui/language.css'), path.join(out, 'language.css'));
await cp(path.join(root, 'packages/ui/favicon.svg'), path.join(out, 'favicon.svg'));
await cp(path.join(root, 'apps/dashboard/build'), path.join(out, 'demo'), { recursive: true });
await cp(path.join(root, 'packages/ui'), path.join(out, 'demo'), { recursive: true });
const snapshot = {
  state: { demo: true, devices: demoDevices, warnings: [], jobs: [], settings: { workspace: '/Projects/flutter_app', targetIds: [] },
    storage: { iosDevices: '/Users/developer/Library/Developer/CoreSimulator/Devices', iosOnSSD: false, avd: '/SSD/SnapkitData/Android/avd', downloads: '/SSD/SnapkitData/downloads/iOS', iosReady: true }, host: 'Preview', platform: 'darwin', scannedAt: '2026-01-01T00:00:00.000Z' },
  catalog: demoCatalog
};
await writeFile(path.join(out, 'demo/preview-data.js'), `window.SNAPKIT_PREVIEW = ${JSON.stringify(snapshot)};\n`);
const html = (await readFile(path.join(root, 'apps/dashboard/build/index.html'), 'utf8'))
  .replace('</head>', '<meta name="robots" content="noindex,nofollow"><script src="./preview-data.js"></script></head>');
await writeFile(path.join(out, 'demo/index.html'), html);
await mkdir(path.join(out, 'control'), { recursive: true });
await cp(path.join(root, 'apps/dashboard/build'), path.join(out, 'control'), { recursive: true });
await cp(path.join(root, 'packages/ui'), path.join(out, 'control'), { recursive: true });
await writeFile(path.join(out, 'control/controller-config.js'), 'window.SNAPKIT_CONTROLLER = true;\n');
await writeFile(path.join(out, 'control/index.html'), html.replace('preview-data.js', 'controller-config.js'));
// Preserve old bookmarks as a fully functional controller, including pairing fragments.
await cp(path.join(out, 'control'), path.join(out, 'preview'), { recursive: true });
await writeFile(path.join(out, '.nojekyll'), '');
console.log('Built website, explicit demo and paired controllers at control/ and preview/ in dist/.');
