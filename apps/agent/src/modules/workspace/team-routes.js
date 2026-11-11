import express from 'express';
import {createTeamDeviceHosts} from './team-device-hosts.js';
import {createTeamRuntime} from './team-runtime.js';
import { readFile, writeFile, mkdir, rename, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { workspaceFramework } from './workspace.js';

export function teamRoutes({ account, store, demo,getDevices,getSessions,stopSessions }) {
  const router = express.Router(), file = path.join(store, 'teams-local.json');
  let queue = Promise.resolve();
  router.use((req, res, next) => {
    if (req.remoteToken) return res.status(403).json({ error: 'Open the local Snapkit app to use Teams.' });
    if (demo) return res.status(503).json({ error: 'Teams requires a signed-in local app. Demo mode does not create shared workspaces.' });
    next();
  });
  async function context(input) {
    const { workspaceId, projectId } = input || {};
    if (![workspaceId, projectId].every(id => typeof id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(id))) throw Object.assign(Error('Select a team workspace and project.'), { status: 400 });
    const workspace = await account.request('/v1/teams/' + workspaceId);
    const project = workspace.projects.find(p => p.id === projectId), member = workspace.membership;
    if (!project || !member.permissions.includes('sessions.prepare') || !(input.environment?member.environments.includes(input.environment):member.environments.some(e=>['development','staging'].includes(e)))) throw Object.assign(Error('Your team role or scope does not allow this action.'), { status: 403 });
    return { workspace, project, key: `${member.userId}/${workspaceId}/${projectId}` };
  }
  async function read() {
    try { const saved = JSON.parse(await readFile(file, 'utf8')); if (saved.version !== 1 || !Array.isArray(saved.sessions)) throw Error('Invalid local Teams data'); return saved; }
    catch (error) { if (error.code === 'ENOENT') return { version: 1, sessions: [] }; throw error; }
  }
  router.startKit=async input=>{const {key,project}=await context({...input,environment:'development'});const binding=(await read()).sessions.find(s=>s.key===key);if(!binding)throw Error('Connect the team project to a local folder first');if(!project.startKit)throw Error('Your team has not saved a shared start kit');return {path:binding.path,plan:project.startKit};};
  router.get('/local-session', async (req, res) => {
    const { key } = await context(req.query);
    res.json({ session: (await read()).sessions.find(s => s.key === key) || null });
  });
  router.post('/local-session', async (req, res) => {
    const { key, project } = await context(req.body);
    if (typeof req.body.path !== 'string' || !path.isAbsolute(req.body.path)) throw Object.assign(Error('Enter an absolute project path.'), { status: 400 });
    const directory = await realpath(req.body.path);
    if (!(await stat(directory)).isDirectory()) throw Object.assign(Error('Choose a project folder.'), { status: 400 });
    const framework = await workspaceFramework(directory).catch(() => 'other');
    const session = { key, path: directory, framework, blueprintVersion: project.blueprint.version, preparedAt: new Date().toISOString(), status: 'prepared' };
    const pending = queue.catch(() => {}).then(async () => {
      // Re-check after waiting for a prior write; revoked scopes never commit.
      await context(req.body);
      const saved = await read(); saved.sessions = [...saved.sessions.filter(s => s.key !== key), session].slice(-200);
      await mkdir(store, { recursive: true }); await writeFile(file + '.tmp', JSON.stringify(saved), { mode: 0o600 }); await rename(file + '.tmp', file);
    }); queue = pending; await pending;
    res.json({ session });
  });
  const deviceHosts=createTeamDeviceHosts({account,store,getDevices});router.deviceHosts=deviceHosts;
  router.get('/local-devices',(_req,res)=>res.json({devices:deviceHosts.localDevices()}));
  router.post('/local-devices/bind',async(req,res)=>res.json(await deviceHosts.bind(req.body)));
  const runtime=createTeamRuntime({account,store,getDevices,getSessions,resources:deviceHosts.resources,binding:async(input)=>{const {key}=await context(input);return (await read()).sessions.find(s=>s.key===key)||null;}});
  router.teamRuntime=runtime;
  router.get('/local-debug',async(req,res)=>res.json(await runtime.options(req.query)));
  router.post('/local-debug/start',async(req,res)=>res.json(await runtime.start(req.body)));
  router.post('/local-debug/deactivate',async(_req,res)=>{await runtime.deactivate();res.json({active:false});});
  router.post('/local-debug/stop',async(_req,res)=>res.json(await runtime.confirmStop(stopSessions)));
  router.use(async (req, res) => {
    let segments;
    try { segments = req.path.split('/').filter(Boolean).map(segment => decodeURIComponent(segment)); } catch { return res.status(400).json({ error: 'Invalid Teams request.' }); }
    if (!['GET', 'POST'].includes(req.method) || segments.some(segment => !/^[a-zA-Z0-9:_-]{1,180}$/.test(segment)) || req.url.includes('?')) return res.status(400).json({ error: 'Invalid Teams request.' });
    const suffix = segments.length ? '/' + segments.map(segment => encodeURIComponent(segment)).join('/') : '';
    const result = await account.request('/v1/teams' + suffix, req.method === 'POST' ? req.body : undefined);
    res.json(result);
  });
  router.use((error, _req, res, _next) => {
    const status = [400, 401, 403, 404, 409, 429, 503].includes(error.status) ? error.status : 503;
    res.status(status).json({ error: status === 404 ? 'Teams is not available on this account service yet.' : error.status ? error.message : 'Could not connect to Teams or prepare the local project. Check your connection and project folder.' });
  });
  return router;
}
