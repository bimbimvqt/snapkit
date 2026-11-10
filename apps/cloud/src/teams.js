import express from 'express';
import { invitationMailer } from './infrastructure/invitation-mail.js';
import { randomUUID, createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { teamRoles, teamEnvironments, teamLayers, teamPermissions, teamCan, teamProjectVisible } from './domain/team-access.js';

const fail = (status, message) => { const error = Error(message); error.status = status; throw error; };
const text = (value, max = 80, optional = false) => {
  if (optional && (value === undefined || value === '')) return '';
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) fail(400, 'Invalid team field.');
  return value.trim();
};
const note = (value, max = 2000) => {
  if (value === undefined || value === '') return '';
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) fail(400, 'Invalid team notes.');
  return value.trim();
};
function publicUrl(value, required = false) {
  if (!value && !required) return '';
  const raw = text(value, 2000); let url;
  try { url = new URL(raw); } catch { fail(400, 'Use an HTTPS URL without credentials or query parameters.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) fail(400, 'Use an HTTPS URL without credentials or query parameters.');
  return url.href;
}
const now = () => new Date().toISOString();
const memberOf = (workspace, userId) => workspace.members.find(m => m.userId === userId);
function workspaceOf(db, id, userId) {
  const workspace = db.workspaces.find(w => w.id === id);
  if (!workspace || !memberOf(workspace, userId)) fail(404, 'Team workspace not found.');
  return workspace;
}
function projectOf(workspace, id, member) {
  const project = workspace.projects.find(p => p.id === id);
  if (!project || !teamProjectVisible(member, id)) fail(404, 'Team project not found.');
  return project;
}
function permit(member, permission, projectId, environment) {
  if (!teamCan(member, permission, projectId, environment)) fail(403, 'Your team role or scope does not allow this action.');
}
function scope(input, workspace) {
  const projectIds = input.projectIds === null ? null : input.projectIds;
  if (projectIds !== null && (!Array.isArray(projectIds) || projectIds.length > 100 || projectIds.some(id => typeof id !== 'string' || !workspace.projects.some(p => p.id === id)))) fail(400, 'Select valid project scopes.');
  const environments = input.environments;
  if (!Array.isArray(environments) || !environments.length || environments.length > 3 || environments.some(e => !teamEnvironments.includes(e))) fail(400, 'Select valid environment scopes.');
  const serviceLayers = input.serviceLayers ?? teamLayers;
  if (!Array.isArray(serviceLayers) || serviceLayers.length > 5 || serviceLayers.some(layer => !teamLayers.includes(layer))) fail(400, 'Select valid service layers.');
  return { projectIds: projectIds === null ? null : [...new Set(projectIds)], environments: [...new Set(environments)], serviceLayers: [...new Set(serviceLayers)] };
}
function audit(workspace, user, action, projectId = null, environment = null) {
  workspace.audit.push({ id: randomUUID(), at: now(), actorId: user.id, actorName: user.name || user.email, action, projectId, environment });
  workspace.audit = workspace.audit.slice(-500);
  workspace.updatedAt = now();
}
function view(workspace, userId) {
  const member = memberOf(workspace, userId);
  const visible = id => teamProjectVisible(member, id);
  const layers = member.serviceLayers ?? teamLayers;
  const blueprintView = blueprint => ({ ...blueprint, hasServices: blueprint.services.length > 0, services: blueprint.services.filter(s => layers.includes(s.kind)) });
  return {
    id: workspace.id, name: workspace.name, createdAt: workspace.createdAt, updatedAt: workspace.updatedAt,
    membership: { ...member, permissions: teamPermissions(member.role) },
    members: workspace.members.map(m => ({ ...m, projectIds: m.projectIds === null ? null : m.projectIds.filter(visible) })),
    invitations: member.role === 'owner' ? workspace.invitations.filter(i => i.expiresAt > Date.now()).map(({delivery,...i}) => ({ ...i, delivery:delivery?{status:delivery.status,attemptedAt:delivery.attemptedAt,sentAt:delivery.sentAt}: {status:'not_sent'} })) : [],
    projects: workspace.projects.filter(p => visible(p.id)).map(p => ({ ...p, blueprint: blueprintView(p.blueprint), history: p.history.map(blueprintView) })),
    devices: workspace.devices.filter(d => visible(d.projectId)).map(d => ({ ...d, reservation: d.reservation?.expiresAt > Date.now() && memberOf(workspace, d.reservation.userId) ? d.reservation : null })),
    handoffs: workspace.handoffs.filter(h => visible(h.projectId) && member.environments.includes(h.environment)).map(h => ({ ...h, blueprint: blueprintView(h.blueprint) })),
    audit: workspace.audit.filter(a => (!a.projectId || visible(a.projectId)) && (!a.environment || member.environments.includes(a.environment))).slice().reverse(),
  };
}

// Separate from account/admin data and every local personal workspace. One writer
// serializes permission checks and atomic commits; never serve uncommitted state.
export function createTeams({ env, accounts, fetcher=fetch }) {
  const mailer=invitationMailer({env,fetcher});
  const file = path.join(env.SNAPKIT_CLOUD_DATA || 'cloud-data', 'teams.json');
  let db = { version: 1, workspaces: [] }, queue = Promise.resolve();
  const loaded = readFile(file, 'utf8').then(raw => {
    const saved = JSON.parse(raw);
    if (saved.version !== 1 || !Array.isArray(saved.workspaces)) throw Error('Invalid Teams database');
    db = saved;
  }).catch(error => { if (error.code !== 'ENOENT') throw error; });
  loaded.catch(() => {});
  async function transaction(req, task) {
    const pending = queue.catch(() => {}).then(async () => {
      await loaded;
      // Revalidate identity and membership inside the serialized write, not from
      // a client-provided user id or a stale role cached in the local agent.
      const identity = await accounts.identity(req);
      if (!identity) fail(401, 'Sign in to Snapkit again.');
      const next = structuredClone(db), result = task(next, identity.user);
      const serialized = JSON.stringify(next);
      if (Buffer.byteLength(serialized) > 16 * 1024 * 1024) fail(409, 'Teams storage limit reached. Contact your workspace administrator.');
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file + '.tmp', serialized, { mode: 0o600 });
      await rename(file + '.tmp', file); db = next;
      return result;
    });
    queue = pending; return pending;
  }
  const router = express.Router();
  // Platform oversight exposes inventory only, never tenant contents or membership.
  router.adminOverview = async (req, res) => {
    try { await loaded; } catch { return res.status(503).json({ error: 'Teams storage is unavailable. Try again later.' }); }
    const query = String(req.query.search || '').slice(0, 160).toLowerCase();
    const offset = Math.max(0, Math.min(10000, Number.parseInt(req.query.offset, 10) || 0));
    const workspaces = db.workspaces.filter(w => !query || w.name.toLowerCase().includes(query));
    const count = key => db.workspaces.reduce((sum, w) => sum + w[key].length, 0);
    res.json({ totals: { workspaces: db.workspaces.length, memberships: count('members'), projects: count('projects'), devices: count('devices'), handoffs: count('handoffs') },
      total: workspaces.length, offset, entries: workspaces.slice().reverse().slice(offset, offset + 50).map(w => ({ id: w.id, name: w.name, createdAt: w.createdAt, updatedAt: w.updatedAt,
        members: w.members.length, projects: w.projects.length, devices: w.devices.length, handoffs: w.handoffs.length,
        reservations: w.devices.filter(d => d.reservation?.expiresAt > Date.now() && memberOf(w, d.reservation.userId)).length })) });
  };
  router.use(async (req, res, next) => {
    try {
      await loaded; const identity = await accounts.identity(req);
      if (!identity) return res.status(401).json({ error: 'Sign in to Snapkit again.' });
      if (req.method !== 'GET' && !identity.bearer && (req.headers.origin !== accounts.origin || req.headers['x-snapkit-request'] !== '1')) return res.status(403).json({ error: 'Invalid request origin.' });
      req.teamUser = identity.user; next();
    } catch { res.status(503).json({ error: 'Teams storage is unavailable. Try again later.' }); }
  });
  router.get('/', (req, res) => res.json({
    emailDeliveryConfigured:mailer.configured, userId: req.teamUser.id, roles: teamRoles, environments: teamEnvironments,
    workspaces: db.workspaces.filter(w => memberOf(w, req.teamUser.id)).map(w => ({ id: w.id, name: w.name, role: memberOf(w, req.teamUser.id).role })),
    invitations: db.workspaces.flatMap(w => w.invitations.filter(i => i.expiresAt > Date.now() && i.email === req.teamUser.email.toLowerCase() && !memberOf(w, req.teamUser.id)).map(i => ({ id: i.id, workspaceName: w.name, role: i.role, expiresAt: i.expiresAt }))),
  }));
  router.post('/', async (req, res) => {
    const result = await transaction(req, (next, user) => {
      if (next.workspaces.filter(w => memberOf(w, user.id)?.role === 'owner').length >= 20 || next.workspaces.length >= 10000) fail(409, 'Team workspace limit reached.');
      const workspace = { id: randomUUID(), name: text(req.body?.name), createdAt: now(), updatedAt: now(),
        members: [{ userId: user.id, name: user.name || '', email: user.email.toLowerCase(), role: 'owner', projectIds: null, environments: [...teamEnvironments], serviceLayers: [...teamLayers], joinedAt: now() }],
        invitations: [], projects: [], devices: [], handoffs: [], audit: [] };
      audit(workspace, user, 'workspace.created'); next.workspaces.push(workspace); return view(workspace, user.id);
    }); res.status(201).json(result);
  });
  router.post('/invitations/:invitationId/accept', async (req, res) => {
    const result = await transaction(req, (next, user) => {
      const workspace = next.workspaces.find(w => w.invitations.some(i => i.id === req.params.invitationId && i.expiresAt > Date.now() && i.email === user.email.toLowerCase()));
      if (!workspace) fail(404, 'Team invitation not found or expired.');
      const invitation = workspace.invitations.find(i => i.id === req.params.invitationId);
      if (memberOf(workspace, user.id)) fail(409, 'You already belong to this workspace.');
      if (workspace.members.length >= 200) fail(409, 'Team member limit reached.');
      workspace.members.push({ userId: user.id, name: user.name || '', email: user.email.toLowerCase(), role: invitation.role, projectIds: invitation.projectIds, environments: invitation.environments, serviceLayers: invitation.serviceLayers ?? [...teamLayers], joinedAt: now() });
      workspace.invitations = workspace.invitations.filter(i => i.id !== invitation.id);
      audit(workspace, user, 'invitation.accepted'); return view(workspace, user.id);
    }); res.json(result);
  });
  router.get('/:workspaceId', (req, res) => res.json(view(workspaceOf(db, req.params.workspaceId, req.teamUser.id), req.teamUser.id)));
  const mutate = (suffix, permission, task) => router.post('/:workspaceId' + suffix, async (req, res) => {
    const result = await transaction(req, (next, user) => {
      const workspace = workspaceOf(next, req.params.workspaceId, user.id), member = memberOf(workspace, user.id);
      if (permission) permit(member, permission);
      task(workspace, member, user, req.body || {}, req.params);
      return view(workspace, user.id);
    }); res.json(result);
  });
  async function sendInvitation(req,invitationId) {
    let message;
    await transaction(req,(next,user)=>{
      const workspace=workspaceOf(next,req.params.workspaceId,user.id);permit(memberOf(workspace,user.id),'members.manage');
      const invitation=workspace.invitations.find(i=>i.id===invitationId&&i.expiresAt>Date.now());
      if(!invitation)fail(404,'Team invitation not found or expired.');
      if(!mailer.configured){invitation.delivery={status:'not_configured'};return;}
      if(invitation.delivery?.attemptedAt>Date.now()-60000)fail(429,'Wait one minute before sending this invitation again.');
      const emailHash=createHash('sha256').update(invitation.email).digest('hex');
      workspace.mailAttempts=(workspace.mailAttempts||[]).filter(a=>a.at>Date.now()-86400000);
      if(workspace.mailAttempts.filter(a=>a.at>Date.now()-3600000).length>=50||workspace.mailAttempts.filter(a=>a.emailHash===emailHash).length>=5)fail(429,'Invitation email limit reached. Try again later.');
      workspace.mailAttempts.push({at:Date.now(),emailHash});
      const key=invitation.delivery?.status==='failed'||invitation.delivery?.status==='sending'?invitation.delivery.key:'team-invitation-'+randomUUID();
      invitation.delivery={status:'sending',key,attemptedAt:Date.now()};
      message={invitation:{...invitation},workspace:workspace.name,inviter:user.name||'Workspace Owner',idempotencyKey:key};
    });
    if(message){
      let sent=false;try{await mailer.send(message);sent=true;}catch{/* Provider responses and credentials never leave the server. */}
      await transaction(req,(next,user)=>{
        const workspace=workspaceOf(next,req.params.workspaceId,user.id),invitation=workspace.invitations.find(i=>i.id===invitationId);
        if(invitation?.delivery?.key===message.idempotencyKey){invitation.delivery.status=sent?'sent':'failed';if(sent)invitation.delivery.sentAt=Date.now();audit(workspace,user,sent?'invitation.email.sent':'invitation.email.failed');}
      });
    }
    return view(workspaceOf(db,req.params.workspaceId,req.teamUser.id),req.teamUser.id);
  }
  router.post('/:workspaceId/invitations',async(req,res)=>{
    const invitationId=await transaction(req,(next,user)=>{
      const workspace=workspaceOf(next,req.params.workspaceId,user.id);permit(memberOf(workspace,user.id),'members.manage');
      const input=req.body||{};
      const email = text(input.email, 254).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Enter a valid email address.');
      if (!teamRoles.includes(input.role) || input.role === 'owner') fail(400, 'Select a member role.');
      if (workspace.members.some(m => m.email === email) || workspace.invitations.some(i => i.email === email && i.expiresAt > Date.now())) fail(409, 'This person is already a member or has a pending invitation.');
      workspace.invitations = workspace.invitations.filter(i => i.expiresAt > Date.now());
      if (workspace.invitations.length >= 200) fail(409, 'Team invitation limit reached.');
      const invitation={ id: randomUUID(), email, role: input.role, ...scope(input, workspace), expiresAt: Date.now() + 7 * 86400000 };
      workspace.invitations.push(invitation);

      audit(workspace,user,'invitation.created');return invitation.id;
    });
    try{res.json(await sendInvitation(req,invitationId));}catch(error){if(error.status!==429)throw error;res.json(view(workspaceOf(db,req.params.workspaceId,req.teamUser.id),req.teamUser.id));}
  });
  router.post('/:workspaceId/invitations/:invitationId/resend',async(req,res)=>res.json(await sendInvitation(req,req.params.invitationId)));
  mutate('/invitations/:invitationId/revoke', 'members.manage', (workspace, _member, user, _input, params) => {
    if (!workspace.invitations.some(i => i.id === params.invitationId)) fail(404, 'Team invitation not found.');
    workspace.invitations = workspace.invitations.filter(i => i.id !== params.invitationId); audit(workspace, user, 'invitation.revoked');
  });
  mutate('/members/:memberId', 'members.manage', (workspace, _member, user, input, params) => {
    const target = memberOf(workspace, params.memberId);
    if (!target) fail(404, 'Team member not found.');
    if (target.role === 'owner' || input.role === 'owner') fail(409, 'The workspace owner cannot be changed here.');
    if (!teamRoles.includes(input.role)) fail(400, 'Select a member role.');
    Object.assign(target, { role: input.role, ...scope(input, workspace) });
    for (const device of workspace.devices) if (device.reservation?.userId === target.userId && !teamCan(target, 'devices.reserve', device.projectId, 'development')) device.reservation = null;
    audit(workspace, user, 'member.access.updated');
  });
  mutate('/members/:memberId/remove', 'members.manage', (workspace, _member, user, _input, params) => {
    const target = memberOf(workspace, params.memberId);
    if (!target) fail(404, 'Team member not found.');
    if (target.role === 'owner') fail(409, 'The workspace owner cannot be removed.');
    workspace.members = workspace.members.filter(m => m.userId !== target.userId);
    for (const device of workspace.devices) if (device.reservation?.userId === target.userId) device.reservation = null;
    audit(workspace, user, 'member.removed');
  });
  mutate('/projects', 'projects.create', (workspace, member, user, input) => {
    if (member.role !== 'owner' && member.projectIds !== null) fail(403, 'Only a workspace-wide Lead can create projects.');
    if (workspace.projects.length >= 100) fail(409, 'Team project limit reached.');
    const name = text(input.name);
    if (workspace.projects.some(p => p.name.toLowerCase() === name.toLowerCase())) fail(409, 'A project with this name already exists.');
    const project = { id: randomUUID(), name, description: note(input.description, 500), createdBy: user.id, createdAt: now(), blueprint: { version: 1, services: [], updatedAt: now(), updatedBy: user.id }, history: [] };
    workspace.projects.push(project); audit(workspace, user, 'project.created', project.id);
  });
  mutate('/projects/:projectId/blueprint', null, (workspace, member, user, input, params) => {
    const project = projectOf(workspace, params.projectId, member); permit(member, 'blueprint.write', project.id, 'development');
    if (input.version !== project.blueprint.version) fail(409, 'The blueprint changed. Refresh before saving.');
    if (!Array.isArray(input.services) || input.services.length > 30) fail(400, 'Add up to 30 services.');
    const layers = member.serviceLayers ?? teamLayers;
    const services = input.services.map(s => {
      if (!teamLayers.includes(s?.kind)) fail(400, 'Select a valid service layer.');
      if (!layers.includes(s.kind)) fail(403, 'Your team scope does not include this service layer.');
      const ownerId = text(s.ownerId, 160, true), owner = ownerId && memberOf(workspace, ownerId);
      if (ownerId && (!owner || !teamProjectVisible(owner, project.id) || !(owner.serviceLayers ?? teamLayers).includes(s.kind))) fail(400, 'Select an owner with access to this project and service layer.');
      return { name: text(s.name), kind: s.kind, repository: publicUrl(s.repository), runtime: text(s.runtime, 120, true), ownerId };
    });
    services.push(...project.blueprint.services.filter(s => !layers.includes(s.kind)));
    if (services.length > 30) fail(400, 'Add up to 30 services.');
    if (new Set(services.map(s => s.name.toLowerCase())).size !== services.length) fail(400, 'Service names must be unique.');
    project.history.push(project.blueprint); project.history = project.history.slice(-49);
    project.blueprint = { version: project.blueprint.version + 1, services, updatedAt: now(), updatedBy: user.id };
    audit(workspace, user, 'blueprint.updated', project.id, 'development');
  });
  mutate('/devices', null, (workspace, member, user, input) => {
    projectOf(workspace, input.projectId, member); permit(member, 'devices.manage', input.projectId, 'development');
    if (!['android', 'ios'].includes(input.platform)) fail(400, 'Select a device platform.');
    if (workspace.devices.length >= 200) fail(409, 'Team device limit reached.');
    workspace.devices.push({ id: randomUUID(), name: text(input.name), platform: input.platform, projectId: input.projectId, host: text(input.host, 120, true), reservation: null, createdAt: now() });
    audit(workspace, user, 'device.registered', input.projectId);
  });
  mutate('/devices/:deviceId/reserve', null, (workspace, member, user, input, params) => {
    const device = workspace.devices.find(d => d.id === params.deviceId);
    if (!device) fail(404, 'Team device not found.');
    projectOf(workspace, device.projectId, member); permit(member, 'devices.reserve', device.projectId, 'development');
    if (!Number.isInteger(input.minutes) || input.minutes < 5 || input.minutes > 120) fail(400, 'Reserve a device for 5 to 120 minutes.');
    if (device.reservation?.expiresAt > Date.now()) fail(409, 'This device is already reserved.');
    device.reservation = { userId: user.id, name: user.name || user.email, expiresAt: Date.now() + input.minutes * 60000 };
    audit(workspace, user, 'device.reserved', device.projectId);
  });
  mutate('/devices/:deviceId/release', null, (workspace, member, user, _input, params) => {
    const device = workspace.devices.find(d => d.id === params.deviceId);
    if (!device) fail(404, 'Team device not found.');
    projectOf(workspace, device.projectId, member);
    if (device.reservation?.userId !== user.id) permit(member, 'devices.manage', device.projectId, 'development');
    device.reservation = null; audit(workspace, user, 'device.released', device.projectId);
  });
  mutate('/handoffs', null, (workspace, member, user, input) => {
    const project = projectOf(workspace, input.projectId, member);
    if (!teamEnvironments.includes(input.environment)) fail(400, 'Select an environment.');
    permit(member, 'handoffs.create', project.id, input.environment);
    if (workspace.handoffs.length >= 1000) fail(409, 'Team handoff limit reached.');
    if (!/^[0-9a-f]{7,40}$/i.test(input.commit || '')) fail(400, 'Enter a commit hash of 7 to 40 hexadecimal characters.');
    if (!/^[0-9a-f]{64}$/i.test(input.artifactSha256 || '')) fail(400, 'Enter the 64-character SHA-256 of this build artifact.');
    if (input.blueprintVersion !== project.blueprint.version) fail(409, 'The blueprint changed. Refresh before handing off.');
    workspace.handoffs.push({ id: randomUUID(), projectId: project.id, title: text(input.title, 160), environment: input.environment, commit: input.commit, buildUrl: publicUrl(input.buildUrl, true), artifactSha256: input.artifactSha256.toLowerCase(), fixture: text(input.fixture, 160, true), steps: note(input.steps, 4000), blueprintVersion: project.blueprint.version, blueprint: structuredClone(project.blueprint), createdBy: user.id, createdAt: now(), status: 'pending', qa: null, approval: null });
    audit(workspace, user, 'handoff.created', project.id, input.environment);
  });
  mutate('/handoffs/:handoffId/review', null, (workspace, member, user, input, params) => {
    const handoff = workspace.handoffs.find(h => h.id === params.handoffId);
    if (!handoff) fail(404, 'Team handoff not found.');
    projectOf(workspace, handoff.projectId, member);
    if (input.decision === 'approve') {
      permit(member, 'release.approve', handoff.projectId, handoff.environment);
      if (handoff.status !== 'qa-approved' || handoff.createdBy === user.id || handoff.qa?.userId === user.id) fail(409, 'QA must confirm this handoff and a different reviewer must approve it.');
      handoff.status = 'approved'; handoff.approval = { userId: user.id, at: now() };
    } else {
      permit(member, 'qa.confirm', handoff.projectId, handoff.environment);
      if (!['pass', 'changes'].includes(input.decision) || handoff.status !== 'pending' || handoff.createdBy === user.id) fail(409, 'A different QA member must review a pending handoff.');
      handoff.status = input.decision === 'pass' ? 'qa-approved' : 'changes-requested'; handoff.qa = { userId: user.id, at: now(), note: note(input.note, 1000) };
    }
    audit(workspace, user, 'handoff.' + handoff.status, handoff.projectId, handoff.environment);
  });
  router.use((_req, res) => res.status(404).json({ error: 'Teams endpoint not found.' }));
  router.use((error, _req, res, _next) => res.status([400, 401, 403, 404, 409, 429].includes(error.status) ? error.status : 503).json({ error: error.status ? error.message : 'Teams could not save this change. Try again.' }));
  return router;
}
