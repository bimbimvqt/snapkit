// Explicit one-time migration. Normal Dashboard operations never invoke this.
import { readFile, writeFile, mkdir, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateWorkspace, stripLegacyTargets } from '../server/workspace.js';
import { storage } from '../server/storage.js';

const root = await validateWorkspace(process.argv[2]);
const file = path.join(root, '.vscode/launch.json');
const raw = await readFile(file, 'utf8');
const clean = stripLegacyTargets(raw);
const backup = await readFile(`${file}.snapkit.bak`).catch(e => { if (e.code !== 'ENOENT') throw e; return null; });
if (raw === clean && !backup) {
  console.log('No legacy Snapkit configuration to remove. Project unchanged.');
} else {
  const archive = path.join(storage.state, 'legacy-ide', `${Date.now()}-${randomUUID()}`);
  await mkdir(archive, { recursive: true });
  await writeFile(path.join(archive, 'launch.json'), raw);
  if (backup) await writeFile(path.join(archive, 'launch.json.snapkit.bak'), backup);
  if (clean !== raw) {
    const temporary = `${file}.${randomUUID()}.tmp`;
    await writeFile(temporary, clean);
    await rename(temporary, file);
  }
  if (backup) await unlink(`${file}.snapkit.bak`);
  console.log(`Removed only generated Snapkit profiles/compound and moved the old backup out of the project. Archive: ${archive}`);
}
