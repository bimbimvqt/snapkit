import express from 'express';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { discover } from './discovery.js';
import { bootDevice } from './devices.js';
import { validateWorkspace, writeTargets, workspaceProfiles, validateBuild } from './workspace.js';
import { chooseFolder } from './folders.js';
import { storage, configureStorage, storageStatus } from './storage.js';
import { Provisioner } from './provision.js';
import { demoCatalog, demoDevices } from './demo.js';
import { run } from './cli.js';
import { Pairings } from './pairing.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const demo = process.argv.includes('--demo');
const port = Number(process.env.PORT || 4310);
const token = randomBytes(32).toString('hex');
const app = express();
const webOrigin = new URL(process.env.SNAPKIT_WEB_ORIGIN || 'https://bimbimvqt.github.io').origin;
if (!webOrigin.startsWith('https://') && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(webOrigin)) throw new Error('Website origin must use HTTPS or loopback HTTP');
const pairings = new Pairings(webOrigin);
let lastRemoteActivity = 0;
const clients = new Set();
if (!demo) await configureStorage();
const provisioner = new Provisioner();
if (!demo) await provisioner.restore();
const store = storage.state;
let settings = { workspace: process.env.FLUTTER_WORKSPACE || '', targetIds: [] };
try { settings = { ...settings, ...JSON.parse(await readFile(path.join(store, 'settings.json'), 'utf8')) }; } catch {
  try { settings = { ...settings, ...JSON.parse(await readFile(path.join(root, '.snapkit/settings.json'), 'utf8')) }; } catch {}
}
if (demo) settings = { workspace: '/Users/developer/Projects/flutter_app', targetIds: [] };
delete settings.targetId;
if (!Array.isArray(settings.targetIds)) settings.targetIds = [];
let snapshot = { devices: demo ? structuredClone(demoDevices) : [], warnings: [], scannedAt: null };
let scanning = null;
const locks = new Set();
function emit(type, value) { for (const res of clients) res.write(`event: ${type}\ndata: ${JSON.stringify(value)}\n\n`); }
provisioner.on('jobs', jobs => emit('jobs', jobs));
provisioner.on('completed', () => scan().catch(e => console.error(e.message)));
async function persist() { if (!demo) { await mkdir(store, { recursive: true }); await writeFile(path.join(store, 'settings.json'), JSON.stringify(settings, null, 2)); } }
async function scan() {
  if (demo) { snapshot.scannedAt = new Date().toISOString(); return snapshot; }
  if (!scanning) scanning = discover().then(result => { snapshot = result; emit('devices', snapshot); return snapshot; }).finally(() => { scanning = null; });
  return scanning;
}
function device(id) { const d = snapshot.devices.find(d => d.id === id); if (!d) throw new Error('Device not found. Refresh the device list.'); return d; }
function requireWorkspace() { if (!settings.workspace) throw new Error('Select a Flutter workspace in Workspace settings first'); return settings.workspace; }
app.disable('x-powered-by');
app.use((req, res, next) => {
  // Loopback binding + exact Host/Origin checking protects against DNS rebinding and CSRF.
  if (![`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`].includes(req.headers.host)) return res.status(403).json({ error: 'Local host required' });
  const origin = req.headers.origin;
  const local = !origin || [`http://127.0.0.1:${port}`, `http://localhost:${port}`, `http://[::1]:${port}`].includes(origin);
  if (!local) {
    if (origin !== webOrigin || !req.path.startsWith('/api/')) return res.status(403).json({ error: 'Cross-origin requests are blocked' });
    res.setHeader('Access-Control-Allow-Origin', webOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    if (req.path !== '/api/pairing/claim') {
      const bearer = /^Bearer (\S+)$/.exec(req.headers.authorization || '')?.[1];
      if (!pairings.allows(bearer, origin)) return res.status(401).json({ error: 'Connect the website using a fresh code from the local Dashboard.' });
      if (req.path === '/api/pairing/code') return res.status(403).json({ error: 'Generate pairing codes from the local Dashboard only' });
      req.remoteToken = bearer; lastRemoteActivity = Date.now();
    }
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  if (req.path === '/api/pairing/claim' && origin !== webOrigin) return res.status(403).json({ error: 'Pairing claims must come from the configured website' });
  if (req.path.startsWith('/api/') && !['GET', 'HEAD'].includes(req.method) && !req.remoteToken && req.path !== '/api/pairing/claim' && req.headers['x-snapkit-token'] !== token) return res.status(403).json({ error: 'Invalid local session token. Reload the dashboard.' });
  next();
});
app.use(express.json({ limit: '16kb' }));
app.post('/api/pairing/code', (_req, res) => res.json({ ...pairings.create(), webUrl: `${webOrigin}/snapkit/control/` }));
app.post('/api/pairing/claim', (req, res) => res.json(pairings.claim(req.body.code, req.headers.origin)));
app.post('/api/pairing/revoke', (req, res) => { pairings.revoke(req.remoteToken); res.json({ message: req.remoteToken ? 'Website disconnected' : 'All website connections revoked' }); });
app.get('/api/state', async (req, res) => res.json({ storage: await storageStatus(), jobs: provisioner.jobs, ...snapshot, settings, demo, token: req.remoteToken ? undefined : token, host: os.hostname(), platform: demo ? 'darwin' : process.platform, scanning: !!scanning }));
app.post('/api/scan', async (_req, res) => res.json(await scan()));
let pickingFolder = false;
app.post('/api/folders/pick', async (_req, res) => {
  if (pickingFolder) return res.status(409).json({ error: 'A folder picker is already open on your computer' });
  if (demo) return res.json({ path: '/Volumes/SanDiskSSDData/flutter_projects/demo_app', demo: true });
  pickingFolder = true;
  try { res.json(await chooseFolder()); } finally { pickingFolder = false; }
});
app.get('/api/provision/catalog', async (req, res) => res.json(demo ? demoCatalog : await provisioner.catalog(req.query.remote === '1')));
app.post('/api/provision/create', async (req, res) => {
  if (demo) {
    const models = req.body.platform === 'ios' ? demoCatalog.ios.models : demoCatalog.android.models;
    const model = models.find(m => m.id === req.body.model);
    if (!model || !(model.runtimeIds || model.imageIds).includes(req.body.runtime)) throw new Error(model?.reason || 'Unsupported model/version pair');
    const image = demoCatalog.android.images.find(i => i.id === req.body.runtime);
    if (req.body.platform === 'android' && !image?.installed) throw new Error('Install this image first');
    const id = `demo-created-${Date.now()}`;
    snapshot.devices.push({ id, name: req.body.name || model.name, group: req.body.platform, platform: req.body.platform, state: 'offline', os: req.body.platform === 'ios' ? demoCatalog.ios.runtimes.find(r => r.id === req.body.runtime)?.name : image.name });
    emit('devices', snapshot);
    return res.status(202).json({ job: { id, title: 'Demo device created', status: 'completed', logs: [], result: { id } }, demo: true });
  }
  res.status(202).json({ job: await provisioner.create(req.body) });
});
app.post('/api/provision/android/install', async (req, res) => {
  if (demo) { const image = demoCatalog.android.images.find(i => i.id === req.body.image); if (!image) throw new Error('Image not found'); image.installed = true; return res.json({ job: { id: 'demo-install', title: 'Demo image installed', status: 'completed', logs: [] } }); }
  res.status(202).json({ job: await provisioner.installAndroid(req.body.image) });
});
app.get('/api/provision/ios/runtimes', async (_req, res) => res.json(demo ? { runtimes: demoCatalog.ios.downloadable } : await provisioner.iosDownloads()));
app.post('/api/provision/ios/xcode', async (_req, res) => {
  if (demo) return res.json({ message: 'Demo: open Xcode → Settings → Components to install simulator runtimes.' });
  if (process.platform !== 'darwin') throw new Error('Xcode requires macOS');
  await run('open', ['-a', 'Xcode']);
  res.json({ message: 'Xcode opened. Choose Xcode → Settings → Components (Platforms in older Xcode), then install the required iOS runtime. Refresh installed versions afterwards.' });
});
app.post('/api/provision/ios/download', async (req, res) => {
  if (demo && demoCatalog.ios.models.find(m => m.id === req.body.model)?.unsupported) throw new Error('This legacy model cannot be supported by downloading a runtime in this Xcode.');
  if (demo) return res.json({ job: { id: 'demo-download', title: 'Demo runtime download simulated', status: 'completed', logs: [] } });
  res.status(202).json({ job: await provisioner.downloadIOSForModel(req.body.version, req.body.model) });
});
app.post('/api/provision/ios/import', async (req, res) => {
  if (demo) return res.json({ job: { id: 'demo-import', title: 'Demo runtime import simulated', status: 'completed', logs: [] } });
  res.status(202).json({ job: await provisioner.importIOS(req.body.file) });
});
app.get('/api/workspace/profiles', async (req, res) => {
  if (demo) return res.json({ profiles: [], flavors: [] });
  res.json(await workspaceProfiles(await validateWorkspace(req.query.path || requireWorkspace())));
});
let savingIDE = false;
function targetDevices(ids) {
  if (!Array.isArray(ids) || ids.length > 20 || ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) throw new Error('Select a list of unique device IDs');
  return ids.map(id => { const d = device(id); if (d.state !== 'online' || !d.flutterId) throw new Error(`${d.name} is unavailable. Start it and refresh, or uncheck it before saving.`); return d; });
}
app.post('/api/workspace', async (req, res) => {
  if (savingIDE) return res.status(409).json({ error: 'Another IDE configuration update is running' });
  savingIDE = true;
  try {
    const workspace = demo ? req.body.path || settings.workspace : await validateWorkspace(req.body.path);
    const build = demo ? {} : await validateBuild(workspace, req.body);
    const targetIds = workspace === settings.workspace ? settings.targetIds : [];
    if (!demo && targetIds.length) await writeTargets(workspace, targetDevices(targetIds), build);
    settings = { ...settings, ...build, workspace, targetIds };
    await persist(); emit('settings', settings); res.json({ settings, message: demo ? 'Demo IDE setup saved' : 'Antigravity debug setup saved. Select devices, then press F5 in your IDE.' });
  } finally { savingIDE = false; }
});
app.post('/api/targets', async (req, res) => {
  if (savingIDE) return res.status(409).json({ error: 'Another IDE configuration update is running' });
  savingIDE = true;
  try {
    const devices = targetDevices(req.body.ids);
    let launchFile = null;
    if (!demo) { const workspace = await validateWorkspace(requireWorkspace()); launchFile = await writeTargets(workspace, devices, devices.length ? await validateBuild(workspace, settings) : {}); }
    settings.targetIds = devices.map(d => d.id); await persist(); emit('settings', settings);
    res.json({ settings, launchFile, message: devices.length ? `${devices.length} device(s) selected. In Antigravity choose “Snapkit: Selected Devices” and press F5.` : 'IDE device selection cleared' });
  } finally { savingIDE = false; }
});
app.post('/api/devices/:id/boot', async (req, res) => {
  const d = device(req.params.id);
  if (locks.has(d.id)) return res.status(409).json({ error: 'This device is already starting' });
  locks.add(d.id);
  try {
    if (demo) {
      if (d.group === 'physical') throw new Error('Turn on physical devices manually');
      d.state = 'online'; d.flutterId ||= d.id; emit('devices', snapshot); return res.json({ message: 'Demo: boot completed' });
    }
    res.json(await bootDevice(d));
    scan().catch(e => console.error(e.message));
  } finally { locks.delete(d.id); }
});
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream'); res.setHeader('Cache-Control', 'no-cache'); res.setHeader('Connection', 'keep-alive'); res.flushHeaders();
  clients.add(res); res.write(': connected\n\n');
  const timer = setInterval(() => res.write(': keepalive\n\n'), 20000);
  req.on('close', () => { clearInterval(timer); clients.delete(res); });
});
app.use('/api', (_req, res) => res.status(404).json({ error: 'API not available. Snapkit only creates/starts devices and configures IDE targets.' }));
app.use('/vendor', express.static(path.join(root, 'node_modules/lucide/dist/umd')));
app.use(express.static(path.join(root, 'public')));
app.use((error, _req, res, _next) => { console.error(error.message); res.status(400).json({ error: error.message }); });
const server = app.listen(port, '127.0.0.1', () => {
  console.log(`\n  Snapkit Device Center → http://127.0.0.1:${port}${demo ? ' (DEMO — no device commands)' : ''}\n`);
  if (!demo) scan().catch(e => console.error(e.message));
});
server.on('error', e => { console.error(e.message); process.exitCode = 1; });
const poll = setInterval(() => { if ((clients.size || Date.now() - lastRemoteActivity < 60000) && !demo) scan().catch(e => console.error(e.message)); }, 30000);
function stop() { clearInterval(poll); for (const res of clients) res.end(); server.close(); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
