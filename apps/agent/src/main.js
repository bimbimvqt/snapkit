import {DevLab} from './modules/dev-lab/lab.js';
import {McpAccess} from './modules/dev-lab/mcp.js';
import {labRoutes} from './modules/dev-lab/routes.js';
import {demoVolumes} from '../../../packages/domain/demo-volumes.js';
import express from 'express';
import {kitRoutes} from './modules/kit/kit.js';
import { WorkspaceSpaces } from './modules/workspace/spaces.js';
import { teamRoutes } from './modules/workspace/team-routes.js';
import { ReleaseBuilds } from './modules/releases/release-builds.js';
import { selectIDETargets } from './application/select-ide-targets.js';
import { DeviceTools } from './modules/device-tools/device-tools.js';
import { LocalAccount } from './modules/accounts/local-account.js';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { IDESessions } from './modules/ide/ide-sessions.js';
import { deviceStatus } from './modules/devices/device-status.js';
import { discover } from './modules/devices/discovery.js';
import { bootDevice, deleteDevice, shutdownDevice } from './modules/devices/device-control.js';
import { validateWorkspace, launchPlan, workspaceProfiles, validateBuild } from './modules/workspace/workspace.js';
import { chooseFolder } from './infrastructure/filesystem/folder-picker.js';
import { storage, configureStorage, storageStatus } from './infrastructure/storage/device-storage.js';
import { Provisioner } from './modules/provisioning/provisioner.js';
import { demoCatalog, demoDevices } from './fixtures/demo.js';
import { run, stopCommands } from './infrastructure/process/cli.js';
import { Pairings } from './modules/pairing/pairings.js';
import { reviewInput } from './modules/accounts/reviews.js';
import { RunProfiles } from './modules/workspace/run-profiles.js';
import { projectDoctor } from './modules/diagnostics/project-doctor.js';
import { readyTargets } from './domain/device-selection.js';
import { diagnostics } from './modules/diagnostics/diagnostics.js';
import { getPreferences, savePreferences } from './infrastructure/storage/preferences.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const demo = process.argv.includes('--demo');
const port = Number(process.env.PORT || 4310);
const packageInfo = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const token = randomBytes(32).toString('hex');
const app = express();
const account = new LocalAccount();
let demoPreferences = { flutterSDK: '', androidSDK: '', editor: 'vscode', onboardingComplete: false };
const webOrigin = new URL(process.env.SNAPKIT_WEB_ORIGIN || 'https://snapkit.vn').origin;
if (!webOrigin.startsWith('https://') && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(webOrigin)) throw new Error('Website origin must use HTTPS or loopback HTTP');
const pairings = new Pairings(webOrigin);
let lastRemoteActivity = 0;
const clients = new Set();
if (!demo) await configureStorage();
const provisioner = new Provisioner();
if (!demo) await provisioner.restore();
const store = storage.state;
const deviceTools = new DeviceTools({ demo });
await deviceTools.restore();
const releaseBuilds = new ReleaseBuilds({ demo });
await releaseBuilds.restore();
let settings = { workspace: process.env.FLUTTER_WORKSPACE || '', targetIds: [], ideEnabled: true };
try { settings = { ...settings, ...JSON.parse(await readFile(path.join(store, 'settings.json'), 'utf8')) }; } catch {
  try { settings = { ...settings, ...JSON.parse(await readFile(path.join(root, '.snapkit/settings.json'), 'utf8')) }; } catch {}
}
if (demo) settings = { workspace: '/Users/developer/Projects/flutter_app', targetIds: [], ideEnabled: true };
delete settings.targetId;
if (!Array.isArray(settings.targetIds)) settings.targetIds = [];
let workspaceSetups = {};
try {
  const saved = JSON.parse(await readFile(path.join(store, 'workspaces.json'), 'utf8'));
  if (saved && typeof saved === 'object' && !Array.isArray(saved)) workspaceSetups = saved;
} catch {}
function rememberWorkspace() {
  if (settings.workspace) workspaceSetups[settings.workspace] = {
    framework: settings.framework || 'flutter', flavor: settings.flavor || '', target: settings.target || 'lib/main.dart', defineFile: settings.defineFile || '',
    selectedSetId: settings.selectedSetId || '', targetIds: [...settings.targetIds], ideEnabled: settings.ideEnabled !== false,
  };
}
rememberWorkspace();
let savedSpaces = [];
if (!demo) {try {savedSpaces = JSON.parse(await readFile(path.join(store, 'spaces.json'), 'utf8'));} catch {}}
if(savedSpaces?.version === 1 && Array.isArray(savedSpaces.entries) && savedSpaces.settings && Array.isArray(savedSpaces.settings.targetIds)) {settings = {...settings, ...savedSpaces.settings}; savedSpaces = savedSpaces.entries;}
const spaces = new WorkspaceSpaces(savedSpaces, settings);
let snapshot = { devices: demo ? structuredClone(demoDevices) : [], warnings: [], scannedAt: null };
let scanning = null;
const locks = new Set();
function emit(type, value) { for (const res of clients) res.write(`event: ${type}\ndata: ${JSON.stringify(value)}\n\n`); }
let debugRevision = 0;
const ideSessions = new IDESessions({ changed: () => emit('debug', { debugSessions: ideSessions.list(), debugRevision: ++debugRevision }) });
provisioner.on('jobs', jobs => emit('jobs', jobs));
provisioner.on('completed', () => scan().catch(e => console.error(e.message)));
let persistence = Promise.resolve();
async function persist() {
  rememberWorkspace(); spaces.remember(settings);
  if (!demo) {
    const snapshot = structuredClone([['workspaces.json', workspaceSetups], ['settings.json', settings], ['spaces.json', {version: 1, entries: spaces.entries, settings}]]);
    const next = persistence.catch(() => {}).then(async () => {
    await mkdir(store, { recursive: true });
    // The registry is the authoritative snapshot: active settings and all spaces
    // commit together, even if the process exits between compatibility writes.
    for (const [name, value] of snapshot) {
      await writeFile(path.join(store, name + '.tmp'), JSON.stringify(value, null, 2));
      await rename(path.join(store, name + '.tmp'), path.join(store, name));
    }
    });
    persistence = next;
    await next;
  }
}
async function scan() {
  if (demo) { snapshot.scannedAt = new Date().toISOString(); return snapshot; }
  if (!scanning) scanning = discover({framework: settings.spaceId ? settings.framework : undefined}).then(async result => { const updates = await deviceStatus(result.devices); for (const d of result.devices) if (updates.has(d.id)) Object.assign(d, updates.get(d.id)); snapshot = result; emit('devices', snapshot); return snapshot; }).finally(() => { scanning = null; });
  return scanning;
}
function device(id) { const d = snapshot.devices.find(d => d.id === id); if (!d) throw new Error('Device not found. Refresh the device list.'); return d; }
function requireWorkspace() { if (!settings.workspace) throw new Error('Select a workspace in Workspace settings first'); return settings.workspace; }
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
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  if (req.path === '/api/pairing/claim' && origin !== webOrigin) return res.status(403).json({ error: 'Pairing claims must come from the configured website' });
  if (req.path.startsWith('/api/') && !['GET', 'HEAD'].includes(req.method) && !req.remoteToken && req.path !== '/api/pairing/claim' && req.path !== '/api/mcp' && req.headers['x-snapkit-token'] !== token) return res.status(403).json({ error: 'Invalid local session token. Reload the dashboard.' });
  next();
});
// Project icons are normalized raster images; keep their larger body budget scoped to Teams.
app.use('/api/teams', express.json({ limit: '128kb' }));
app.use('/api/account/profile', express.json({ limit: '128kb' }));
app.use(express.json({ limit: '16kb' }));
app.get('/api/auth/status', async (req, res) => {
  if (req.remoteToken) return res.status(403).json({ error: 'Open the local app to sign in.' });
  res.json({ ...(demo ? { required: false, authenticated: false } : await account.status(req.query.fresh === '1')), localToken: token });
});
app.post('/api/auth/start', async (req, res) => { if (demo || req.remoteToken) return res.status(403).json({ error: 'Sign-in is available in the local app.' }); res.json(await account.start()); });
app.post('/api/auth/poll', async (req, res) => { if (demo || req.remoteToken) return res.status(403).json({ error: 'Sign-in is available in the local app.' }); res.json(await account.poll()); });
app.post('/api/auth/logout', async (req, res) => {
  if (req.remoteToken) return res.status(403).json({ error: 'Sign out from the local app.' });
  await devLab.cancel(); await releaseBuilds.cancelActive(); await deviceTools.close(); await account.logout(); for (const client of clients) client.end(); clients.clear(); pairings.revoke(); res.json({ signedOut: true });
});
app.use('/api', async (req, res, next) => {
  if (demo || req.path === '/health') return next();
  const status = await account.status(req.method === 'POST');
  if (status.authenticated) return next();
  if (req.path === '/state') return res.json({ authRequired: true, activeKitTask:kitRouter.busy(), activeLabTask: !!devLab.active, activeReleaseTask: !!releaseBuilds.active || releaseBuilds.starting, devices: [], jobs: [], debugSessions: [], warnings: [], settings: { targetIds: [], ideEnabled: false }, token: req.remoteToken ? undefined : token, platform: process.platform, host: os.hostname(), demo: false });
  if (req.path === '/ide/plan') return res.json({ protocol: 1, status: 'inactive', workspace: '', configurations: [] });
  return res.status(401).json({ error: 'Sign in with Google to use Snapkit.' });
});
// Dev Lab owns its targets until the task has fully stopped.
app.use('/api',(req,res,next)=>{if(devLab.active&&req.method==='POST'&&(/^\/(?:workspace|workspaces|targets|ide|devices|releases|tools|kit|provision)(?:\/|$)/.test(req.path)||req.path==='/teams/local-debug/start'||req.path==='/teams/local-session'))return res.status(409).json({error:'Wait for Dev Lab to finish or cancel its active run'});next();});
const kitRouter=kitRoutes({store,demo,getTeamPlan:input=>teamRouter.startKit(input),getSettings:()=>settings,getDevices:()=>snapshot.devices,getEditor:()=>getPreferences().editor,diagnostics:()=>diagnostics({framework:settings.framework}),active:()=>!!releaseBuilds.active||releaseBuilds.starting||deviceTools.recordings.size>0,boot:async d=>{if(locks.has(d.id))throw Error('Device operation in progress');locks.add(d.id);try{if(demo){d.state='online';emit('devices',snapshot);}else{await bootDevice(d);void scan().catch(()=>{});}}finally{locks.delete(d.id);}}});
app.use('/api/kit',kitRouter);
app.get('/api/health', (_req, res) => res.json({ product: 'snapkit', version: packageInfo.version, protocol: 1, desktop: process.env.SNAPKIT_DESKTOP === '1', demo }));
const teamRouter=teamRoutes({account,store,demo,getDevices:()=>snapshot.devices,getSessions:()=>ideSessions.list(),stopSessions:ids=>ideSessions.requestStop(ids)});
app.use('/api/teams',teamRouter);
const devLab=new DevLab({store,demo,getSettings:()=>settings,getDevices:()=>snapshot.devices,conflict:()=>!!releaseBuilds.active||releaseBuilds.starting||deviceTools.recordings.size>0||ideSessions.list().length>0||kitRouter.busy()||locks.size>0});
await devLab.restore();
const mcpAccess=new McpAccess({store,demo,lab:devLab,port,context:()=>({workspace:settings.workspace,framework:settings.framework,devices:snapshot.devices.map(({id,name,platform,state,os})=>({id,name,platform,state,os})),sessions:ideSessions.list().map(({id,deviceId,status})=>({id,deviceId,status}))}),logs:id=>{device(id);return deviceTools.log(id,0);}});
await mcpAccess.restore();
app.use('/api/dev-lab',labRoutes(devLab,mcpAccess));
app.post('/api/mcp',async(req,res)=>{if(!mcpAccess.authorize(req))return res.status(403).json({error:'MCP is disabled or authentication failed'});res.json(await mcpAccess.dispatch(req.body));});

app.post('/api/reviews', async (req, res) => {
  if (demo || req.remoteToken) return res.status(403).json({error: 'Open Snapkit Desktop to send a review. Demo reviews are not submitted.'});
  const receipt = await account.review(reviewInput(req.body));
  if (receipt.received !== true || typeof receipt.id !== 'string') throw Error('Review delivery could not be confirmed. Please try again.');
  res.status(201).json({received: true, id: receipt.id});
});
app.post('/api/account/profile', async (req, res) => { if (demo || req.remoteToken) return res.status(403).json({ error: 'Edit your profile in the signed-in local app.' }); res.json(await account.updateProfile(req.body)); });
app.get('/api/account/content', async (_req, res) => res.json(await account.request('/v1/public/content', undefined, '')));
app.get('/api/product', (_req, res) => res.json({ version: packageInfo.version, channel: 'beta', desktop: process.env.SNAPKIT_DESKTOP === '1', preferences: demo ? demoPreferences : getPreferences(), billing: { provider: 'revenuecat', phase: 'free-beta', checkoutEnabled: false }, integrations: [
  { id: 'vscode', name: 'Visual Studio Code', mode: 'extension' }, { id: 'cursor', name: 'Cursor', mode: 'extension-beta' }, { id: 'antigravity', name: 'Antigravity IDE', mode: 'extension-beta' }
] }));
app.get('/api/diagnostics', (req, res) => demo ? res.json({ volumes:demoVolumes, ready: true, platform: 'darwin', arch: 'arm64', memoryGB: 16, computer: { model: 'Mac mini', name: 'Sample Mac', chip: 'Apple M4', osName: 'macOS', osVersion: 'macOS 26', form: 'mini' }, checkedAt: Date.now(), checks: [(settings.spaceId ? settings.framework : demoPreferences.developerProfile?.framework || settings.framework) === 'react-native' ? { id: 'node', title: 'Node.js', status: 'ready', detail: 'Node.js is ready', help: 'https://reactnative.dev/docs/set-up-your-environment' } : { id: 'flutter', title: 'Flutter', status: 'ready', detail: 'Flutter is ready', help: 'https://docs.flutter.dev/get-started/install' }, { id: 'android', title: 'Android tools', status: 'ready', detail: 'Android tools are ready', help: 'https://developer.android.com/studio' }, { id: 'ios', title: 'iOS Simulator', status: 'ready', detail: 'Simulator is ready', help: 'https://developer.apple.com/xcode/' }], preferences: getPreferences(), storage: { root: 'Your computer', android: 'Android devices', ios: 'iOS devices' }, advice: 'Start only the devices you need.' }) : diagnostics({ fresh: req.query.fresh === '1', framework: settings.spaceId ? settings.framework : undefined }).then(value => res.json(value)));
let savingPreferences = false;
app.post('/api/preferences', async (req, res) => {
  if (savingPreferences) return res.status(409).json({ error: 'Settings are being saved. Try again shortly.' });
  savingPreferences = true;
  try { res.json({ preferences: demo ? (demoPreferences = { ...demoPreferences, ...req.body }) : await savePreferences(req.body), message: 'Preferences saved. Restart Snapkit if you changed an SDK folder.' }); }
  finally { savingPreferences = false; }
});
app.get('/downloads/snapkit-debug-sync.vsix', (_req, res) => res.download(path.join(root, 'snapkit-debug-sync.vsix')));

app.post('/api/pairing/code', (_req, res) => res.json({ ...pairings.create(), webUrl: `${webOrigin}/control/` }));
app.post('/api/pairing/claim', (req, res) => res.json(pairings.claim(req.body.code, req.headers.origin)));
app.post('/api/pairing/revoke', (req, res) => { pairings.revoke(req.remoteToken); res.json({ message: req.remoteToken ? 'Website disconnected' : 'All website connections revoked' }); });
// Release commands execute only in the authenticated local agent, never on cloud.
// Team credentials and Apple account metadata are available only on this computer.
app.use('/api/apple', (req, res, next) => req.remoteToken ? res.status(403).json({ error: 'Manage Apple teams in the local desktop app.' }) : next());
app.get('/api/apple/teams', (_req, res) => res.json(releaseBuilds.apple.catalog(requireWorkspace())));
app.get('/api/apple/detected', async (_req, res) => res.json({ teams: demo ? [{ teamId: 'ABCDE12345', name: 'Demo Studio', source: 'project' }] : await releaseBuilds.apple.signing.detected(requireWorkspace()) }));
app.post('/api/apple/teams', async (req, res) => { if (releaseBuilds.active || releaseBuilds.starting) throw Error('Another release task is running.'); await releaseBuilds.apple.connect(req.body); res.json(releaseBuilds.apple.catalog(requireWorkspace())); });
app.post('/api/apple/teams/:teamId/refresh', async (req, res) => { await releaseBuilds.apple.refresh(req.params.teamId); res.json(releaseBuilds.apple.catalog(requireWorkspace())); });
app.post('/api/apple/teams/:teamId/remove', async (req, res) => { if (releaseBuilds.active || releaseBuilds.starting) throw Error('Another release task is running.'); await releaseBuilds.apple.remove(req.params.teamId); res.json(releaseBuilds.apple.catalog(requireWorkspace())); });
app.post('/api/apple/selection', async (req, res) => res.json(await releaseBuilds.apple.select(requireWorkspace(), req.body)));
app.use('/api/releases', (req, res, next) => { if (req.method !== 'GET' && settings.framework === 'react-native') return res.status(409).json({ error: 'React Native build and release is coming soon. Use your project CLI or Xcode.' }); next(); });
app.get('/api/releases/catalog', async (_req, res) => res.json(settings.framework === 'react-native' ? { workspace: settings.workspace, android: false, ios: false, flavors: [], profiles: [], framework: 'react-native' } : await releaseBuilds.catalog(settings.workspace, settings)));
app.get('/api/releases', (_req, res) => res.json(releaseBuilds.list(settings.workspace)));
app.get('/api/releases/activity', (req, res) => { if(req.remoteToken)return res.status(403).json({error:'Build activity is local only.'});res.json(releaseBuilds.activity()); });
app.get('/api/releases/:id', (req, res) => res.json(releaseBuilds.publicJob(releaseBuilds.find(requireWorkspace(), req.params.id), true)));
app.post('/api/releases/build', async (req, res) => {
  if (req.body.operation === 'run') throw Error('Use the Run Release action to select a physical device.');
  const workspace = requireWorkspace();
  if (req.body.expectedWorkspace !== undefined && req.body.expectedWorkspace !== workspace) return res.status(409).json({error:'Workspace changed. Review the build selection and try again.'});
  res.json(await releaseBuilds.start(workspace, req.body));
});
app.post('/api/releases/run', async (req, res) => {
  if (req.remoteToken) return res.status(403).json({ error: 'Run Release is available in the local app only.' });
  const target = device(req.body.deviceId);
  if (ideSessions.list().some(session => [target.id, target.flutterId].includes(session.deviceId))) throw Error('Stop debugging this device before running Release.');
  res.json(await releaseBuilds.start(requireWorkspace(), { ...req.body, operation: 'run' }, target));
});
app.post('/api/releases/:id/cancel', async (req, res) => { await releaseBuilds.cancel(requireWorkspace(), req.params.id); res.json({ ok: true }); });
app.post('/api/releases/:id/delete', async (req, res) => { await releaseBuilds.delete(requireWorkspace(), req.params.id); res.json({ ok: true }); });
app.get('/api/releases/:id/artifacts/:artifactId', async (req, res) => { const artifact = await releaseBuilds.artifact(requireWorkspace(), req.params.id, req.params.artifactId); res.download(artifact.file, artifact.name); });
app.post('/api/releases/testflight/config', async (req, res) => {
  if (req.remoteToken) return res.status(403).json({ error: 'Configure TestFlight in the local desktop app.' });
  await releaseBuilds.identity(requireWorkspace(), req.body); res.json({ configured: releaseBuilds.list(settings.workspace).uploadConfigured });
});
app.post('/api/releases/:id/upload', async (req, res) => {
  if (req.remoteToken) return res.status(403).json({ error: 'Upload to TestFlight from the local desktop app.' });
  res.json(await releaseBuilds.upload(requireWorkspace(), req.params.id, req.body.confirm));
});
app.get('/api/tools', (_req, res) => res.json(deviceTools.list(settings.workspace)));
app.post('/api/tools/sets/save', async (req, res) => {
  const set = await deviceTools.saveSet(requireWorkspace(), req.body, snapshot.devices);
  if (settings.selectedSetId === set.id) { settings.selectedSetId = ''; await persist(); emit('settings', settings); }
  res.json(set);
});
app.post('/api/tools/sets/:id/delete', async (req, res) => { await deviceTools.deleteSet(requireWorkspace(), req.params.id); if (settings.selectedSetId === req.params.id) { settings.selectedSetId = ''; await persist(); emit('settings', settings); } res.json({ ok: true }); });
app.post('/api/tools/sets/:id/start', (req, res) => res.json(deviceTools.startSet(requireWorkspace(), req.params.id, {
  devices: () => snapshot.devices, locks,
  boot: async d => { if (demo) { d.state = 'online'; d.flutterId ||= d.id; emit('devices', snapshot); } else await bootDevice(d); },
  refresh: async () => { if (demo) return; const updates = await deviceStatus(snapshot.devices); for (const d of snapshot.devices) if (updates.has(d.id)) Object.assign(d, updates.get(d.id)); emit('devices', snapshot); }
})));
app.post('/api/tools/logs/:id/start', async (req, res) => res.json(await deviceTools.startLog(device(req.params.id))));
app.post('/api/tools/logs/:id/stop', (req, res) => { deviceTools.stopLog(req.params.id); res.json({ ok: true }); });
app.get('/api/tools/logs/:id', (req, res) => res.json(deviceTools.log(req.params.id, Math.max(0, Number(req.query.after) || 0))));
app.post('/api/tools/captures/:id/screenshot', async (req, res) => res.json(await deviceTools.capture(requireWorkspace(), device(req.params.id))));
app.post('/api/tools/captures/:id/record', async (req, res) => res.json(await deviceTools.record(requireWorkspace(), device(req.params.id))));
app.post('/api/tools/recordings/:id/stop', async (req, res) => { await deviceTools.stopRecord(req.params.id); res.json({ ok: true }); });
app.post('/api/tools/captures/:id/delete', async (req, res) => { await deviceTools.deleteCapture(requireWorkspace(), req.params.id); res.json({ ok: true }); });
app.get('/api/tools/captures/:id/file', (req, res) => {
  const item = deviceTools.captures.find(x => x.id === req.params.id && x.project === deviceTools.project(requireWorkspace()) && x.status === 'ready');
  if (!item) return res.status(404).json({ error: 'Capture not found.' });
  res.download(deviceTools.file(item), `Snapkit-${item.createdAt.replace(/[:.]/g, '-')}.${item.kind === 'image' ? 'png' : 'mp4'}`, { dotfiles: 'allow' });
});
app.get('/api/state', async (req, res) => res.json({ debugSessions: ideSessions.list(), debugRevision, storage: await storageStatus(), jobs: provisioner.jobs, activeKitTask:kitRouter.busy(), activeLabTask: !!devLab.active, activeReleaseTask: !!releaseBuilds.active || releaseBuilds.starting, activeRecordings: deviceTools.recordings.size, ...snapshot, settings, demo, token: req.remoteToken ? undefined : token, host: os.hostname(), platform: demo ? 'darwin' : process.platform, scanning: !!scanning }));
app.post('/api/scan', async (_req, res) => res.json(await scan()));
let pickingFolder = false;
app.post('/api/folders/pick', async (req, res) => {
  if (pickingFolder) return res.status(409).json({ error: 'A folder picker is already open on your computer' });
  if (demo) return res.json({ path: { flutterSDK: '/Demo/Flutter SDK', androidSDK: '/Demo/Android SDK' }[req.body?.purpose] || '/Volumes/SanDiskSSDData/flutter_projects/demo_app', demo: true });
  pickingFolder = true;
  try { res.json(await chooseFolder({ purpose: req.body?.purpose, language: req.body?.language })); } finally { pickingFolder = false; }
});
app.get('/api/provision/catalog', async (req, res) => res.json(demo ? demoCatalog : await provisioner.catalog(req.query.remote === '1', ['ios', 'android'].includes(req.query.platform) ? req.query.platform : 'all')));
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
  const workspace = await validateWorkspace(req.query.path || requireWorkspace());
  res.json({ ...await workspaceProfiles(workspace), savedSetup: workspaceSetups[workspace] || null });
});
const runProfiles = new RunProfiles(store);
if (!demo) await runProfiles.restore();
else runProfiles.commit = async entries => { runProfiles.entries = entries; };
let savingIDE = false;
app.get('/api/workspace/doctor', async (_req, res) => {
  const workspace = requireWorkspace();
  if (demo) return res.json({workspace, framework: settings.framework || 'flutter', checkedAt: Date.now(), ready: true, checks: [{id: 'demo', title: 'Sample project', status: 'ready', detail: 'Demo only. Open your project in Snapkit Desktop to check its configuration.'}]});
  res.json(await projectDoctor(await validateWorkspace(workspace), settings));
});
app.get('/api/run-profiles', (_req, res) => res.json({profiles: runProfiles.list(settings)}));
app.post('/api/run-profiles/:action', async (req, res) => {
  if (kitRouter.busy()) return res.status(409).json({error:'Wait for your start kit to finish before changing projects'});
  if (savingIDE) return res.status(409).json({error: 'Another IDE configuration update is running'});
  if (settings.framework === 'backend') return res.status(409).json({error: 'Backend tools are coming soon'});
  if (!['save', 'activate', 'delete'].includes(req.params.action)) return res.status(404).json({error: 'Unknown profile action'});
  savingIDE = true;
  const before = {settings: structuredClone(settings), setups: structuredClone(workspaceSetups), entries: structuredClone(spaces.entries)};
  try {
    const workspace = requireWorkspace();
    const action = req.params.action;
    if (action === 'delete') await runProfiles.remove(settings, req.body.id);
    else if (action === 'save') {
      const build = demo ? {framework: settings.framework || 'flutter', flavor: settings.flavor || '', target: settings.target || 'lib/main.dart', defineFile: settings.defineFile || ''} : await validateBuild(await validateWorkspace(workspace), settings);
      await runProfiles.save(settings, req.body.name, build);
    } else {
      if (ideSessions.list().length || releaseBuilds.active || releaseBuilds.starting) return res.status(409).json({error: 'Stop active debug sessions and builds before changing run profiles'});
      const profile = runProfiles.find(settings, req.body.id);
      const build = demo ? {framework: profile.framework, flavor: profile.flavor, target: profile.target, defineFile: profile.defineFile} : await validateBuild(await validateWorkspace(workspace), profile);
      if (build.framework !== profile.framework || (settings.spaceId && spaces.get(settings.spaceId)?.type !== build.framework)) throw Error('The project does not match this run profile');
      const targets = readyTargets(profile.targetIds, snapshot.devices);
      settings = {...settings, ...build, targetIds: targets.map(d => d.id), selectedSetId: '', ideEnabled: profile.ideEnabled};
      await persist(); emit('settings', settings);
    }
    res.json({profiles: runProfiles.list(settings), settings});
  } catch (error) { settings = before.settings; workspaceSetups = before.setups; spaces.entries = before.entries; throw error; }
  finally { savingIDE = false; }
});
app.get('/api/workspaces', (_req, res) => res.json(spaces.list(settings)));
async function changeSpace(req, res, create) {
  if (kitRouter.busy()) return res.status(409).json({error:'Wait for your start kit to finish before changing projects'});
  if (savingIDE) return res.status(409).json({error: 'Another IDE configuration update is running'});
  if (releaseBuilds.active || releaseBuilds.starting || deviceTools.recordings.size || ideSessions.list().length) return res.status(409).json({error: 'Stop active debug sessions, builds and recordings before switching workspaces'});
  savingIDE = true;
  const before = {settings: structuredClone(settings), entries: structuredClone(spaces.entries), setups: structuredClone(workspaceSetups)};
  try {
    const id = create ? spaces.create(req.body) : req.body.id;
    settings = spaces.activate(id, settings);
    await persist(); emit('settings', settings);
    res.json({...spaces.list(settings), settings});
    if (!demo) void scan().catch(error => console.error(error.message));
  } catch(error) {
    settings = before.settings; spaces.entries = before.entries; workspaceSetups = before.setups;
    throw error;
  } finally {savingIDE = false;}
}
app.post('/api/workspaces/create', (req, res) => changeSpace(req, res, true));
app.post('/api/workspaces/activate', (req, res) => changeSpace(req, res, false));
app.post('/api/workspace', async (req, res) => {
  if (kitRouter.busy()) return res.status(409).json({error:'Wait for your start kit to finish before changing projects'});
  if (savingIDE) return res.status(409).json({ error: 'Another IDE configuration update is running' });
  savingIDE = true;
  try {
    const workspace = demo ? req.body.path || settings.workspace : await validateWorkspace(req.body.path);
    const build = demo ? { framework: req.body.framework === 'react-native' ? 'react-native' : 'flutter' } : await validateBuild(workspace, req.body);
    const activeSpace = spaces.get(settings.spaceId);
    if (activeSpace && activeSpace.type !== build.framework) throw Error('The project does not match this workspace type. Switch or create a matching workspace.');
    const previous = settings.spaceId ? null : workspaceSetups[workspace];
    const targetIds = workspace === settings.workspace ? settings.targetIds : previous?.targetIds || [];
    const ideEnabled = workspace === settings.workspace ? settings.ideEnabled !== false : previous?.ideEnabled !== false;
    const selectedSetId = workspace === settings.workspace ? settings.selectedSetId || '' : previous?.selectedSetId || '';
    settings = { ...settings, ...build, workspace, targetIds, ideEnabled, selectedSetId };
    await persist(); emit('settings', settings); res.json({ settings, message: demo ? 'Demo IDE setup saved' : 'Antigravity debug setup saved. Select devices, then press F5 in your IDE.' });
  } finally { savingIDE = false; }
});
app.post('/api/targets', async (req, res) => {
  if (settings.framework === 'backend') return res.status(409).json({error: 'Backend tools are coming soon'});
  if (kitRouter.busy()) return res.status(409).json({error:'Wait for your start kit to finish before changing projects'});
  if (savingIDE) return res.status(409).json({ error: 'Another IDE configuration update is running' });
  savingIDE = true;
  try {
    const devices = await selectIDETargets(req.body, {
      devices: snapshot.devices,
      validateProject: async targets => { if (!demo) { const workspace = await validateWorkspace(requireWorkspace()); if (targets.length) await validateBuild(workspace, settings); } },
      listSets: () => deviceTools.list(requireWorkspace()).sets,
      saveSelection: async selection => { Object.assign(settings, selection); await persist(); emit('settings', settings); }
    });
    res.json({ settings, message: devices.length ? `${devices.length} device(s) selected. Press F5 or Run/Debug in your IDE with the Snapkit extension. Project files are unchanged.` : 'IDE device selection cleared' });
  } finally { savingIDE = false; }
});
app.post('/api/ide/mode', async (req, res) => {
  if (kitRouter.busy()) return res.status(409).json({error:'Wait for your start kit to finish before changing projects'});
  if (savingIDE) return res.status(409).json({ error: 'Another IDE configuration update is running' });
  if (typeof req.body.enabled !== 'boolean') throw new Error('enabled must be a boolean');
  savingIDE = true;
  try {
    settings.ideEnabled = req.body.enabled;
    await persist(); emit('settings', settings);
    res.json({ settings, message: settings.ideEnabled ? 'IDE uses Dashboard targets when Snapkit is available' : 'IDE uses its normal debug configuration' });
  } finally { savingIDE = false; }
});
app.get('/api/ide/plan', async (_req, res) => {
  // Demo state is never used to launch real IDE sessions.
  if (demo) return res.json({ protocol: 1, status: 'inactive', workspace: '', configurations: [] });
  const teamPlan=await teamRouter.teamRuntime.plan();if(teamPlan)return res.json(teamPlan);
  let plan = launchPlan(settings, snapshot.devices);
  if (plan.status === 'ready') {
    try { await validateBuild(await validateWorkspace(settings.workspace), settings); }
    catch (e) { plan = { ...plan, status: 'invalid', configurations: [], reason: e.message }; }
  }
  res.json(plan);
});
app.post('/api/ide/sessions', (req, res) => {
  if (req.remoteToken) return res.status(403).json({ error: 'IDE session reports require the local extension' });
  res.json(ideSessions.exchange(req.body));
});
app.post('/api/devices/:id/stop-debug', (req, res) => {
  const d = device(req.params.id);
  if (!ideSessions.requestStop([d.id, d.flutterId].filter(Boolean))) return res.status(409).json({ error: 'No connected IDE debug session for this device. Update Snapkit Debug Sync and start debug in your IDE.' });
  res.json({ message: 'Stop requested in your IDE. Other devices keep debugging.' });
});
app.post('/api/devices/:id/shutdown', async (req, res) => {
  const d = device(req.params.id);
  if (d.group === 'physical') throw new Error('Only simulators and emulators can be turned off. Disconnect physical devices manually.');
  if (locks.has(d.id)) return res.status(409).json({ error: 'Another operation is running for this device' });
  locks.add(d.id);
  try {
    ideSessions.requestStop([d.id, d.flutterId].filter(Boolean));
    const result = demo ? { message: 'Device shutdown requested. Device data is kept.' } : await shutdownDevice(d);
    if (demo || d.platform === 'ios') { d.state = 'offline'; d.flutterId = undefined; const current = snapshot.devices.find(item => item.id === d.id); if (current) Object.assign(current, { state: 'offline', flutterId: undefined }); }
    emit('devices', snapshot); res.json(result);
    if (!demo) refreshStatus().catch(e => console.error(e.message));
  } finally { locks.delete(d.id); }
});
app.post('/api/devices/:id/boot', async (req, res) => {
  const d = device(req.params.id);
  if (locks.has(d.id)) return res.status(409).json({ error: 'Another operation is running for this device' });
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
app.post('/api/devices/:id/delete', async (req, res) => {
  const d = device(req.params.id);
  if (d.group === 'physical') throw new Error('Physical devices cannot be deleted or erased from Snapkit');
  if (req.body.confirm !== d.id) throw new Error('Confirm the exact device before deleting its data');
  if (locks.has(d.id) || savingIDE) return res.status(409).json({ error: 'Another device or IDE configuration operation is running' });
  locks.add(d.id); savingIDE = true;
  try {
    const result = demo ? { message: `Demo: ${d.name} and its data were deleted. Shared OS runtimes were kept.` } : await deleteDevice(d);
    if (scanning) await scanning;
    snapshot.devices = snapshot.devices.filter(item => item.id !== d.id);
    settings.targetIds = settings.targetIds.filter(id => id !== d.id); settings.selectedSetId = '';
    // The device is already deleted. Report any settings failure separately so
    // the user is never told a destructive operation failed when it succeeded.
    let warning;
    try {
      await persist();
    } catch (e) { warning = `Device deleted, but IDE settings could not be updated: ${e.message}`; }
    emit('devices', snapshot); emit('settings', settings);
    res.json({ ...result, settings, warning });
    if (!demo) scan().catch(e => console.error(e.message));
  } finally { locks.delete(d.id); savingIDE = false; }
});
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream'); res.setHeader('Cache-Control', 'no-cache'); res.setHeader('Connection', 'keep-alive'); res.flushHeaders();
  clients.add(res); res.write(': connected\n\n');
  const timer = setInterval(() => res.write(': keepalive\n\n'), 20000);
  req.on('close', () => { clearInterval(timer); clients.delete(res); });
});
app.use('/api', (_req, res) => res.status(404).json({ error: 'API not available. Refresh Snapkit to access the latest device tools.' }));
app.use(express.static(path.join(root, 'apps/dashboard/build')));
app.use(express.static(path.join(root, 'packages/ui')));
app.use((error, _req, res, _next) => { console.error(error.message); res.status(400).json({ error: error.message }); });
const server = app.listen(port, '127.0.0.1', () => {
  console.log(`\n  Snapkit Device Center → http://127.0.0.1:${port}${demo ? ' (DEMO — no device commands)' : ''}\n`);
  if (!demo) scan().catch(e => console.error(e.message));
});
server.on('error', e => { console.error(e.message); process.exitCode = 1; });
let statusPending = null;
function refreshStatus() {
  if (statusPending || demo) return statusPending;
  statusPending = deviceStatus(snapshot.devices).then(updates => {
    let changed = false;
    for (const d of snapshot.devices) {
      const update = updates.get(d.id);
      if (!update || locks.has(d.id)) continue;
      if (d.state !== update.state || d.flutterId !== update.flutterId) { Object.assign(d, update); changed = true; }
    }
    if (changed) { snapshot.scannedAt = new Date().toISOString(); emit('devices', snapshot); }
  }).finally(() => { statusPending = null; });
  return statusPending;
}
const statusPoll = setInterval(() => {
  ideSessions.prune();if(!demo){void teamRouter.teamRuntime.sync();}
  if (!demo && clients.size) account.status().then(status => { if (!status.authenticated) { void devLab.cancel(); void deviceTools.close(); for (const client of clients) client.end(); clients.clear(); } }).catch(() => {});
  if (clients.size || Date.now() - lastRemoteActivity < 60000) refreshStatus()?.catch(e => console.error(e.message));
}, 2000);
const poll = setInterval(() => { if ((clients.size || Date.now() - lastRemoteActivity < 60000) && !demo) scan().catch(e => console.error(e.message)); }, 30000);
let stopping;
server.on('request',(_req,res)=>res.once('finish',()=>{if(stopping)server.closeIdleConnections();}));
function stop() {
  if(stopping)return stopping;
  stopping=(async()=>{
    // Stop accepting work before waiting for build/recording cleanup.
    clearInterval(poll);clearInterval(statusPoll);
    const closed=new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
    // Attach the rejection handler immediately while cleanup is still running.
    const drained=closed.then(()=>null,error=>error);
    for(const res of clients){res.shouldKeepAlive=false;res.end();}clients.clear();
    const results=await Promise.allSettled([devLab.close(),releaseBuilds.close(),deviceTools.close()]);
    stopCommands();server.closeIdleConnections();
    const serverError=await drained;
    const failed=results.some(result=>result.status==='rejected')||serverError;
    if(failed)console.error('Snapkit shutdown cleanup failed.');
    // Electron's parent IPC port can keep an otherwise idle utility process alive.
    // All owned task cleanup and HTTP responses have completed at this point.
    process.exit(failed?1:0);
  })().catch(error=>{console.error('Snapkit shutdown failed:',error.message);process.exit(1);});
  return stopping;
}
process.on('SIGINT', stop); process.on('SIGTERM', stop);
process.parentPort?.on('message', event => { if (event.data?.type === 'shutdown') void stop(); });
