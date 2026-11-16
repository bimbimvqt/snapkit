import { createHash } from 'node:crypto';
import { workspaceProfiles } from '../workspace/workspace.js';
const ideId = name => 'ide:' + createHash('sha256').update(name).digest('hex').slice(0, 24);
export async function debugProfiles(settings, saved, { readProfiles = workspaceProfiles } = {}) {
  const workspace = settings.workspace || '';
  const source = workspace && (!settings.framework || settings.framework === 'flutter') ? await readProfiles(workspace) : { profiles: [] };
  const profiles = [{ id: 'workspace', source: 'workspace', name: 'Snapkit project settings', flavor: settings.flavor || '', target: settings.target || 'lib/main.dart', defineFile: settings.defineFile || '' }];
  for (const p of source.profiles) {
    // Duplicate IDE names cannot be resolved safely in the connected editor.
    if (source.profiles.filter(other => other.name === p.name).length !== 1 || /(^|\/)(test|integration_test)\/|_test\.dart$/.test(p.target.replaceAll('\\', '/'))) continue;
    profiles.push({ ...p, id: ideId(p.name), source: 'ide' });
  }
  for (const p of saved.filter(p => p.framework === 'flutter')) profiles.push({ id: 'saved:' + p.id, source: 'saved', name: p.name, flavor: p.flavor, target: p.target, defineFile: p.defineFile });
  const selectedId = settings.debugProfileId || 'workspace';
  return { workspace, selectedId, profiles, selected: profiles.find(p => p.id === selectedId) || null };
}
