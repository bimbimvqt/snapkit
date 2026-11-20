import { randomUUID } from 'node:crypto';
const inspectorCommands = ['inspectUI', 'closeInspector', 'openInspectedSource'];
function inspectionReport(value) {
  if (!['idle', 'starting', 'waiting', 'selected', 'unavailable', 'expired'].includes(value?.phase)) return null;
  const result = { phase: value.phase };
  if (result.phase !== 'selected') return result;
  for (const key of ['widget', 'project']) {
    const node = value[key];
    if (!node || typeof node.name !== 'string') continue;
    const detail = { name: node.name.slice(0, 160) };
    if (typeof node.file === 'string' && Number.isSafeInteger(node.line) && node.line > 0) {
      detail.file = node.file.slice(0, 512);
      detail.line = node.line;
      detail.column = Number.isSafeInteger(node.column) && node.column > 0 ? node.column : 1;
      if (typeof node.enclosing === 'string') detail.enclosing = node.enclosing.slice(0, 160);
    }
    result[key] = detail;
  }
  return result;
}
// Ephemeral IDE ownership: the agent requests stops; only the owning extension
// invokes the IDE API. Expired owners never leave actionable sessions behind.
export class IDESessions {
  constructor({ now = Date.now, changed = () => {} } = {}) { this.now = now; this.changed = changed; this.owners = new Map(); }
  prune() {
    let removed = false;
    for (const [id, owner] of this.owners) if (this.now() - owner.seen > 10000) { this.owners.delete(id); removed = true; }
    if (removed) this.changed();
  }
  list() {
    this.prune();
    return [...this.owners.values()].flatMap(owner => owner.sessions.map(session => ({ ...session, stopping: owner.stops.has(session.id) })));
  }
  exchange({ ownerId, sessions, actionResults = [] } = {}) {
    if (typeof ownerId !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(ownerId) || !Array.isArray(sessions) || sessions.length > 64) throw new Error('Invalid IDE session report');
    if (sessions.some(s => !s || ['id', 'deviceId', 'name'].some(k => typeof s[k] !== 'string' || !s[k] || s[k].length > 512)) || new Set(sessions.map(s => s.id)).size !== sessions.length) throw new Error('Invalid IDE session report');
    this.prune();
    if (!this.owners.has(ownerId) && this.owners.size >= 32) throw new Error('Too many IDE clients');
    const before = JSON.stringify(this.list());
    const actions = this.owners.get(ownerId)?.actions || new Map();
    if (!Array.isArray(actionResults) || actionResults.length > 64) throw new Error('Invalid IDE action results');
    for (const id of actionResults) actions.delete(id);
    const stops = this.owners.get(ownerId)?.stops || new Set();
    if(sessions.some(s=>s.teamSessionId!==undefined&&!/^[a-f0-9-]{36}$/.test(s.teamSessionId)))throw new Error('Invalid Teams session reference');
    if (sessions.some(s => s.workspace !== undefined && (typeof s.workspace !== 'string' || s.workspace.length > 4096))) throw new Error('Invalid IDE workspace');
    const inspections = new Map(sessions.map(s => [s.id, inspectionReport(s.inspection)]).filter(([, state]) => state));
    const clean = sessions.map(({ id, deviceId, name,teamSessionId, workspace }) => ({ id, deviceId, name,...(workspace ? { workspace } : {}),...(teamSessionId?{teamSessionId}:{}), ...(inspections.has(id) ? { inspectable: true } : {}) }));
    for (const id of stops) if (!clean.some(s => s.id === id)) stops.delete(id);
    if (clean.length) this.owners.set(ownerId, { sessions: clean, stops, actions, inspections, seen: this.now() });
    else this.owners.delete(ownerId);
    if (before !== JSON.stringify(this.list())) this.changed();
    for (const [id, action] of actions) if (!clean.some(s => s.id === action.sessionId) || this.now() - action.at > 15000) actions.delete(id);
    return { stopSessionIds: [...stops], actions: [...actions.values()] };
  }
  requestAction(deviceIds, command) {
    if (!['hotReload', 'hotRestart'].includes(command)) throw new Error('Invalid debug action');
    this.prune(); let count = 0;
    for (const owner of this.owners.values()) for (const session of owner.sessions) if (deviceIds.includes(session.deviceId)) {
      if (![...owner.actions.values()].some(action => action.sessionId === session.id && action.command === command && this.now() - action.at < 15000)) {
        const id = randomUUID(); owner.actions.set(id, { id, sessionId: session.id, command, at: this.now() });
      }
      count++;
    }
    return count;
  }
  inspect(deviceIds, workspace, command, sessionId) {
    if (command !== 'status' && !inspectorCommands.includes(command)) throw Error('Invalid inspector action');
    this.prune();
    const matches = [...this.owners.values()].flatMap(owner => owner.sessions.filter(session =>
      session.inspectable && !owner.stops.has(session.id) && session.workspace === workspace && deviceIds.includes(session.deviceId)
      && (sessionId === undefined || sessionId === session.id)).map(session => ({ owner, session })));
    if (matches.length !== 1) throw Error(matches.length ? 'More than one Flutter Debug session is connected to this device.' : 'No inspectable Flutter Debug session. Update Debug Sync and restart debugging.');
    const { owner, session } = matches[0];
    const state = owner.inspections.get(session.id);
    if (command !== 'status') {
      if (command === 'openInspectedSource' && !state.project?.file) throw Error('No project source is available.');
      const id = randomUUID();
      if (owner.actions.size >= 64) throw Error('Too many pending IDE requests.');
      if (![...owner.actions.values()].some(action => action.sessionId === session.id && action.command === command)) {
        owner.actions.set(id, { id, sessionId: session.id, command, at: this.now() });
      }
    }
    return { sessionId: session.id, ...(command === 'inspectUI' ? { phase: 'starting' } : state) };
  }
  requestStop(deviceIds) {
    this.prune(); let count = 0;
    for (const owner of this.owners.values()) for (const session of owner.sessions) if (deviceIds.includes(session.deviceId)) { owner.stops.add(session.id); count++; }
    if (count) this.changed();
    return count;
  }
}
