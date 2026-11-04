// Discover source automatically so newly added modules cannot escape syntax checks.
import { readdir, readFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const sources = [];
async function collect(directory) {
  for (const item of await readdir(path.join(root, directory), { withFileTypes: true })) {
    if (item.name.startsWith('.') || item.name === 'node_modules' || item.name === 'data' || item.name === 'build') continue;
    const file = path.join(directory, item.name);
    if (item.isDirectory()) await collect(file);
    else if (/\.(c?js|mjs)$/.test(item.name)) sources.push(file);
  }
}
for (const directory of ['apps', 'packages', 'scripts', 'tests']) await collect(directory);
for (const file of sources) {
  execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'pipe' });
  const source = await readFile(path.join(root, file), 'utf8');
  for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(|\brequire\s*\()\s*['"]([^'"\n]+)['"]/g)) {
    const specifier = match[1];
    if (!specifier.startsWith('.')) {
      if (file.includes(`${path.sep}domain${path.sep}`)) throw Error(`Domain must not import runtime infrastructure: ${file} -> ${specifier}`);
      continue;
    }
    const target = path.resolve(root, path.dirname(file), specifier);
    await access(target).catch(() => { throw Error(`Broken import: ${file} -> ${specifier}`); });
    const relative = path.relative(root, target).split(path.sep).join('/');
    const sourceApp = file.split(path.sep)[1], targetApp = relative.split('/')[1];
    if (file.startsWith('packages' + path.sep) && relative.startsWith('apps/')) throw Error(`Shared packages cannot import apps: ${file}`);
    if (file.startsWith('apps' + path.sep) && relative.startsWith('apps/') && sourceApp !== targetApp) throw Error(`Apps must communicate through APIs, not source imports: ${file} -> ${relative}`);
    if (file.includes(`${path.sep}domain${path.sep}`) && !relative.includes('/domain/')) throw Error(`Domain must remain independent: ${file} -> ${relative}`);
    if (file.includes(`${path.sep}application${path.sep}`) && /\/(infrastructure|modules)\//.test(relative)) throw Error(`Use cases must receive adapters through parameters: ${file} -> ${relative}`);
    if (file.includes(`${path.sep}infrastructure${path.sep}`) && /\/(modules|application)\//.test(relative)) throw Error(`Infrastructure cannot depend on application modules: ${file} -> ${relative}`);
  }
}
console.log(`Checked ${sources.length} JavaScript files, relative imports and architecture boundaries.`);
