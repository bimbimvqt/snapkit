import { randomUUID } from 'node:crypto';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

// Profiles belong to both a named workspace and its project. Never write project files.
export class RunProfiles {
  constructor(store) { this.file = path.join(store, 'run-profiles.json'); this.entries = []; }
  async restore() {
    try { const data = JSON.parse(await readFile(this.file, 'utf8')); if (data.version === 1 && Array.isArray(data.entries)) this.entries = data.entries; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  list(settings) { return this.entries.filter(p => p.spaceId === (settings.spaceId || 'legacy') && p.workspace === settings.workspace); }
  find(settings, id) { const profile = this.list(settings).find(p => p.id === id); if (!profile) throw Error('Run profile not found'); return profile; }
  async commit(entries) {
    await mkdir(path.dirname(this.file), { recursive: true });
    await writeFile(this.file + '.tmp', JSON.stringify({ version: 1, entries }, null, 2));
    await rename(this.file + '.tmp', this.file);
    this.entries = entries;
  }
  async save(settings, name, build) {
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 80 || /[\u0000-\u001f]/.test(name)) throw Error('Enter a profile name (1–80 characters)');
    name = name.trim();
    const profiles = this.list(settings);
    const previous = profiles.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (previous) throw Error('A run profile with this name already exists');
    if (profiles.length >= 50) throw Error('You can save up to 50 run profiles per project');
    const profile = { id: randomUUID(), name, spaceId: settings.spaceId || 'legacy', workspace: settings.workspace, ...build,
      targetIds: [...settings.targetIds], ideEnabled: settings.ideEnabled !== false };
    await this.commit([...this.entries, profile]); return profile;
  }
  async remove(settings, id) { this.find(settings, id); await this.commit(this.entries.filter(p => p.id !== id)); }
}
