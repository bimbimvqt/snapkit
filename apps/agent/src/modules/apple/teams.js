import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { AppStoreConnect } from '../../infrastructure/app-store-connect.js';
import { AppleSigning } from './signing.js';
import { testFlightIdentity } from '../../domain/release-plan.js';

// Credentials remain local. Public catalogues contain only team/app metadata.
export class AppleTeams {
  constructor({ root, demo = false, api = new AppStoreConnect(), signing = new AppleSigning() }) {
    Object.assign(this, { root, demo, api, signing }); this.teams = {}; this.selections = {}; this.writing = Promise.resolve(); this.pending = new Set();
    if (demo) this.teams.ABCDE12345 = { teamId: 'ABCDE12345', name: 'Demo Studio', identity: testFlightIdentity({ keyId: 'DEMO123456', issuerId: '00000000-0000-0000-0000-000000000000', keyPath: '/Demo/AuthKey_DEMO123456.p8' }), apps: [{ id: '1234567890', name: 'Demo app · dev', bundleId: 'com.snapkit.demo.dev' }, { id: '1234567891', name: 'Demo app · prod', bundleId: 'com.snapkit.demo' }], checkedAt: Date.now() };
  }
  async restore() {
    if (this.demo) return;
    const saved = await readFile(path.join(this.root, 'apple-teams.json'), 'utf8').then(JSON.parse).catch(error => { if (error.code !== 'ENOENT') throw error; return {}; });
    this.teams = saved.teams || {}; this.selections = saved.selections || {};
  }
  save() {
    if (this.demo) return Promise.resolve();
    const content = JSON.stringify({ teams: this.teams, selections: this.selections });
    this.writing = this.writing.catch(() => {}).then(async () => { await mkdir(this.root, { recursive: true }); const file = path.join(this.root, 'apple-teams.json'); await writeFile(file + '.tmp', content, { mode: 0o600 }); await rename(file + '.tmp', file); });
    return this.writing;
  }
  slot(workspace, flavor = '') { if (!workspace) throw Error('Choose a Flutter workspace first.'); if (typeof flavor !== 'string' || flavor.length > 128) throw Error('Invalid flavor name'); return createHash('sha256').update(path.resolve(workspace)).digest('hex') + ':' + flavor; }
  catalog(workspace) { const prefix = this.slot(workspace).split(':')[0] + ':'; return { teams: Object.values(this.teams).map(({ identity, ...team }) => team), selections: Object.fromEntries(Object.entries(this.selections).filter(([key]) => key.startsWith(prefix)).map(([key, value]) => [key.slice(prefix.length), value])), demo: this.demo }; }
  async connect(input) {
    const teamId = String(input.teamId || '').trim().toUpperCase(), name = String(input.name || '').trim() || `Apple Team ${teamId}`;
    if (!/^[A-Z0-9]{10}$/.test(teamId) || !name || name.length > 100 || /[\x00-\x1f]/.test(name)) throw Error('Enter an Apple team name and its 10-character Team ID.');
    if (this.pending.has(teamId)) throw Error('This Apple team is being refreshed. Try again shortly.');
    if (!this.teams[teamId] && Object.keys(this.teams).length >= 30) throw Error('Remove an unused Apple team before adding another.');
    this.pending.add(teamId);
    try {
      const identity = testFlightIdentity(input), apps = this.demo ? this.teams.ABCDE12345.apps : await this.api.apps(identity);
      const old = this.teams[teamId]; this.teams[teamId] = { teamId, name, identity, apps, checkedAt: Date.now() };
      try { await this.save(); } catch (error) { if (old) this.teams[teamId] = old; else delete this.teams[teamId]; throw error; }
      return this.teams[teamId];
    } finally { this.pending.delete(teamId); }
  }
  async refresh(teamId) { const team = this.teams[teamId]; if (!team) throw Error('Connect this Apple team first.'); return this.connect({ teamId, name: team.name, ...team.identity }); }
  async remove(teamId) {
    if (this.pending.has(teamId)) throw Error('This Apple team is being refreshed. Try again shortly.');
    delete this.teams[teamId]; for (const key of Object.keys(this.selections)) if (this.selections[key].teamId === teamId) delete this.selections[key]; await this.save();
  }
  async select(workspace, input) {
    const team = this.teams[input.teamId], app = team?.apps.find(app => app.id === input.appId);
    if (!app) throw Error('Choose an app from this team.');
    const value = { teamId: team.teamId, teamName: team.name, appId: app.id, appName: app.name, bundleId: app.bundleId };
    this.selections[this.slot(workspace, input.flavor)] = value; await this.save(); return value;
  }
  snapshot(workspace, flavor) {
    const value = this.selections[this.slot(workspace, flavor)];
    if (!value || !this.teams[value.teamId]?.apps.some(app => app.id === value.appId && app.bundleId === value.bundleId)) throw Error('Choose an Apple team and app for this environment before building.');
    return { ...value };
  }
  identity(apple) { const identity = this.teams[apple.teamId]?.identity; if (!identity) throw Error('Reconnect the Apple team used by this IPA before uploading.'); return { ...identity }; }
  async verify(apple, signal) {
    const identity = this.identity(apple);
    if (!this.demo) { const app = await this.api.readApp(identity, apple.appId, signal); if (app.bundleId !== apple.bundleId) throw Error('The Apple app bundle ID has changed. Select the matching app and build again.'); }
    return identity;
  }
}
