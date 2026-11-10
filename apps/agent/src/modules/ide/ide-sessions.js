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
  exchange({ ownerId, sessions } = {}) {
    if (typeof ownerId !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(ownerId) || !Array.isArray(sessions) || sessions.length > 64) throw new Error('Invalid IDE session report');
    if (sessions.some(s => !s || ['id', 'deviceId', 'name'].some(k => typeof s[k] !== 'string' || !s[k] || s[k].length > 512)) || new Set(sessions.map(s => s.id)).size !== sessions.length) throw new Error('Invalid IDE session report');
    this.prune();
    if (!this.owners.has(ownerId) && this.owners.size >= 32) throw new Error('Too many IDE clients');
    const before = JSON.stringify(this.list());
    const stops = this.owners.get(ownerId)?.stops || new Set();
    if(sessions.some(s=>s.teamSessionId!==undefined&&!/^[a-f0-9-]{36}$/.test(s.teamSessionId)))throw new Error('Invalid Teams session reference');
    const clean = sessions.map(({ id, deviceId, name,teamSessionId }) => ({ id, deviceId, name,...(teamSessionId?{teamSessionId}:{}) }));
    for (const id of stops) if (!clean.some(s => s.id === id)) stops.delete(id);
    if (clean.length) this.owners.set(ownerId, { sessions: clean, stops, seen: this.now() });
    else this.owners.delete(ownerId);
    if (before !== JSON.stringify(this.list())) this.changed();
    return { stopSessionIds: [...stops] };
  }
  requestStop(deviceIds) {
    this.prune(); let count = 0;
    for (const owner of this.owners.values()) for (const session of owner.sessions) if (deviceIds.includes(session.deviceId)) { owner.stops.add(session.id); count++; }
    if (count) this.changed();
    return count;
  }
}
