import express from 'express';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { discover } from './discovery.js';
import { deviceAction } from './devices.js';
import { validateWorkspace, writeLaunch } from './workspace.js';
import { Sessions } from './sessions.js';
import { chooseFolder } from './folders.js';
import { storage, configureStorage, storageStatus, screenshotFolder } from './storage.js';
import { Provisioner } from './provision.js';
import { demoCatalog, demoDevices } from './demo.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const demo = process.argv.includes('--demo');
const port = Number(process.env.PORT || 4310);
const token = randomBytes(32).toString('hex');
const app = express();
const sessions = new Sessions();
const clients = new Set();
if (!demo) await configureStorage();
const provisioner = new Provisioner();
if (!demo) await provisioner.restore();
const store = storage.state;
let settings = { workspace: process.env.FLUTTER_WORKSPACE || '', targetId: null };
try { settings = { ...settings, ...JSON.parse(await readFile(path.join(store, 'settings.json'), 'utf8')) }; } catch {
  try { settings = { ...settings, ...JSON.parse(await readFile(path.join(root, '.snapkit/settings.json'), 'utf8')) }; } catch {}
}
if (demo) settings = { workspace: '/Users/developer/Projects/flutter_app', targetId: 'demo-ios-1' };
let snapshot = { devices: demo ? structuredClone(demoDevices) : [], warnings: [], scannedAt: null };
let scanning = null;
const locks = new Set();
const demoSessions = [];
function emit(type, value) { for (const res of clients) res.write(`event: ${type}\ndata: ${JSON.stringify(value)}\n\n`); }
sessions.on('log', entry => emit('log', entry));
sessions.on('sessions', list => emit('sessions', list));
provisioner.on('jobs', jobs => emit('jobs', jobs));
provisioner.on('completed', job => { sessions.log('snapkit', `${job.title} completed`); scan().catch(e => sessions.log('snapkit', e.message, 'error')); });
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
  if (req.headers.origin && ![`http://127.0.0.1:${port}`, `http://localhost:${port}`, `http://[::1]:${port}`].includes(req.headers.origin)) return res.status(403).json({ error: 'Cross-origin requests are blocked' });
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  if (req.path.startsWith('/api/') && !['GET', 'HEAD'].includes(req.method) && req.headers['x-snapkit-token'] !== token) return res.status(403).json({ error: 'Invalid local session token. Reload the dashboard.' });
  next();
});
app.use(express.json({ limit: '16kb' }));
app.get('/api/state', async (_req, res) => res.json({ storage: await storageStatus(), screenshotDirectory: settings.workspace ? screenshotFolder(settings.workspace) : storage.screenshots, jobs: provisioner.jobs, ...snapshot, settings: demo ? { workspace: '/Users/developer/Projects/flutter_app', targetId: settings.targetId || 'demo-ios-1' } : settings, sessions: demo ? demoSessions : sessions.list(), logs: sessions.logs, demo, token, host: os.hostname(), platform: demo ? 'darwin' : process.platform, scanning: !!scanning }));
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
app.post('/api/provision/ios/download', (req, res) => {
  if (demo) return res.json({ job: { id: 'demo-download', title: 'Demo runtime download simulated', status: 'completed', logs: [] } });
  res.status(202).json({ job: provisioner.downloadIOS(req.body.version) });
});
app.post('/api/provision/ios/import', async (req, res) => {
  if (demo) return res.json({ job: { id: 'demo-import', title: 'Demo runtime import simulated', status: 'completed', logs: [] } });
  res.status(202).json({ job: await provisioner.importIOS(req.body.file) });
});
app.post('/api/workspace', async (req, res) => {
  if (!demo) {
    const workspace = await validateWorkspace(req.body.path);
    if (workspace !== settings.workspace) settings.targetId = null;
    settings.workspace = workspace;
  }
  await persist(); emit('settings', settings); res.json({ settings, message: demo ? 'Demo workspace selected' : 'Flutter workspace selected' });
});
app.post('/api/target', async (req, res) => {
  const d = device(req.body.id);
  let launchFile = null;
  if (!demo) { const workspace = requireWorkspace(); if (!d.flutterId) throw new Error('Boot the device and refresh before selecting a VS Code target'); launchFile = await writeLaunch(workspace, d); }
  settings.targetId = d.id; await persist(); emit('settings', settings);
  res.json({ settings, launchFile, message: demo ? 'Demo target selected' : 'Target saved to .vscode/launch.json' });
});
app.post('/api/devices/:id/:action', async (req, res) => {
  const d = device(req.params.id); const action = req.params.action;
  if (!['boot', 'shutdown', 'cold-boot', 'erase', 'screenshot', 'appearance', 'locale', 'resolution', 'window-size'].includes(action)) return res.status(400).json({ error: 'Unknown action' });
  if (locks.has(d.id)) return res.status(409).json({ error: 'Another operation is running on this device' });
  if ((demo ? demoSessions : sessions.list()).some(s => s.deviceId === d.id && ['starting', 'running'].includes(s.status)) && ['erase', 'shutdown', 'cold-boot', 'locale'].includes(action)) throw new Error('Stop the Flutter session before changing device lifecycle or locale');
  locks.add(d.id);
  try {
    if (demo) {
      if (['boot', 'cold-boot'].includes(action)) { d.state = 'online'; d.flutterId = d.id; }
      if (['shutdown', 'erase'].includes(action)) d.state = 'offline';
      if (action === 'screenshot') return res.json({ message: 'Demo mode: connect a real device to capture screenshots' });
      emit('devices', snapshot); return res.json({ message: `Demo: ${action} completed` });
    }
    const result = await deviceAction(d, action, req.body, settings.workspace);
    sessions.log(d.id, result.message);
    res.json(result);
    if (['boot', 'shutdown', 'erase', 'cold-boot', 'locale', 'resolution'].includes(action)) scan().catch(e => sessions.log(d.id, e.message, 'error'));
  } finally { locks.delete(d.id); }
});
app.post('/api/sessions', async (req, res) => {
  const d = device(req.body.id || settings.targetId);
  if (d.state !== 'online' || !d.flutterId) throw new Error('Start the device and refresh until Flutter detects it');
  if (demo) {
    if (!demoSessions.some(s => s.deviceId === d.id && s.status === 'running')) demoSessions.push({ deviceId: d.id, name: d.name, status: 'running', startedAt: new Date().toISOString() });
    emit('sessions', demoSessions); sessions.log(d.id, 'Demo Flutter session started'); return res.json({ sessions: demoSessions });
  }
  const workspace = await validateWorkspace(requireWorkspace());
  res.json({ sessions: sessions.start(d, workspace) });
});
app.post('/api/sessions/reload-all', async (_req, res) => {
  const results = demo ? demoSessions.filter(s => s.status === 'running').map(s => ({ deviceId: s.deviceId, ok: true })) : await sessions.reloadAll();
  res.json({ results, message: `${results.filter(r => r.ok).length}/${results.length} sessions reloaded` });
});
app.post('/api/sessions/:id/:action', async (req, res) => {
  if (!['reload', 'restart', 'stop'].includes(req.params.action)) throw new Error('Unknown session action');
  if (demo) { const s = demoSessions.find(s => s.deviceId === req.params.id && s.status === 'running'); if (!s) throw new Error('Start a demo session first'); if (req.params.action === 'stop') s.status = 'stopped'; emit('sessions', demoSessions); }
  else await sessions.action(req.params.id, req.params.action);
  res.json({ message: `${req.params.action} completed` });
});
app.get('/api/screenshots', async (_req, res) => {
  if (demo || !settings.workspace) return res.json([]);
  const folder = screenshotFolder(settings.workspace);
  const files = await readdir(folder).catch(() => []);
  res.json(files.filter(f => f.endsWith('.png')).sort().reverse().map(filename => ({ filename, url: `/api/screenshots/${encodeURIComponent(filename)}` })));
});
app.get('/api/screenshots/:file', (req, res) => {
  if (!settings.workspace || path.basename(req.params.file) !== req.params.file || !req.params.file.endsWith('.png')) return res.sendStatus(404);
  res.sendFile(path.join(screenshotFolder(settings.workspace), req.params.file), e => { if (e && !res.headersSent) res.sendStatus(404); });
});
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream'); res.setHeader('Cache-Control', 'no-cache'); res.setHeader('Connection', 'keep-alive'); res.flushHeaders();
  clients.add(res); res.write(': connected\n\n');
  const timer = setInterval(() => res.write(': keepalive\n\n'), 20000);
  req.on('close', () => { clearInterval(timer); clients.delete(res); });
});
app.use('/vendor', express.static(path.join(root, 'node_modules/lucide/dist/umd')));
app.use(express.static(path.join(root, 'public')));
app.use((error, _req, res, _next) => { console.error(error.message); res.status(400).json({ error: error.message }); });
const server = app.listen(port, '127.0.0.1', () => {
  console.log(`\n  Snapkit Device Center → http://127.0.0.1:${port}${demo ? ' (DEMO — no device commands)' : ''}\n`);
  if (!demo) scan().catch(e => console.error(e.message));
});
server.on('error', e => { console.error(e.message); process.exitCode = 1; });
const poll = setInterval(() => { if (clients.size && !demo) scan().catch(e => console.error(e.message)); }, 30000);
function stop() { clearInterval(poll); sessions.close(); for (const res of clients) res.end(); server.close(); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
