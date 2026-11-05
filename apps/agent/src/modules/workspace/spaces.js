import { randomUUID } from 'node:crypto';
import path from 'node:path';
const types = ['flutter', 'react-native', 'backend'];
const setup = settings => ({ workspace: settings.workspace || '', framework: settings.framework || 'flutter', flavor: settings.flavor || '', target: settings.target || 'lib/main.dart', defineFile: settings.defineFile || '', targetIds: [...(settings.targetIds || [])], selectedSetId: settings.selectedSetId || '', ideEnabled: settings.ideEnabled !== false });
// Explicit workspace IDs are independent of project paths. Existing project
// settings remain the legacy workspace until the user first creates/switches one.
export class WorkspaceSpaces {
  constructor(saved = [], settings = {}) {
    this.entries = Array.isArray(saved) ? saved.filter(s => s && typeof s.id === 'string' && typeof s.name === 'string' && types.includes(s.type) && s.setup && Array.isArray(s.setup.targetIds)) : [];
    if (!this.entries.some(s => s.id === (settings.spaceId || 'legacy'))) this.entries.unshift({id: settings.spaceId || 'legacy', name: settings.spaceName || (settings.workspace ? path.basename(settings.workspace) : 'My workspace'), type: settings.framework || 'flutter', setup: setup(settings)});
    this.remember(settings);
  }
  remember(settings) {
    const entry = this.entries.find(s => s.id === (settings.spaceId || 'legacy'));
    if (entry) {entry.setup = setup(settings); if (!settings.spaceId) {entry.type = settings.framework || 'flutter'; entry.name = settings.workspace ? path.basename(settings.workspace) : entry.name;}}
  }
  list(settings) {return {activeId: settings.spaceId || 'legacy', workspaces: this.entries.map(({id, name, type, setup}) => ({id, name, type, project: setup.workspace}))};}
  create(input) {
    if (!types.includes(input?.type)) throw Error('Choose Flutter, React Native or Backend');
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!name || name.length > 80 || /[\u0000-\u001f]/.test(name)) throw Error('Enter a workspace name (1–80 characters)');
    if (this.entries.some(s => s.name.toLowerCase() === name.toLowerCase())) throw Error('A workspace with this name already exists');
    if (this.entries.length >= 100) throw Error('You can create up to 100 workspaces');
    const entry = {id: randomUUID(), name, type: input.type, setup: setup({framework: input.type, ideEnabled: input.type !== 'backend'})};
    this.entries.push(entry); return entry.id;
  }
  activate(id, settings) {
    const entry = this.entries.find(s => s.id === id);
    if (!entry) throw Error('Workspace not found');
    this.remember(settings);
    return {...settings, ...entry.setup, framework: entry.type, spaceId: entry.id, spaceName: entry.name};
  }
  get(id) {return this.entries.find(s => s.id === id);}
}
