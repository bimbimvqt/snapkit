// Debug adapter output only. Buffers are bounded, in memory, and scoped to the
// project reported by the owning IDE; no device logging process is started.
export class DebugConsole {
  constructor({ now = Date.now } = {}) { this.now = now; this.lines = []; this.next = 1; this.owners = new Map(); }
  exchange(ownerId, output = [], sessions = []) {
    if (!Array.isArray(output) || output.length > 64 || output.some(entry => !entry ||
        !Number.isSafeInteger(entry.sequence) || entry.sequence < 1 || typeof entry.sessionId !== 'string' ||
        !['console', 'stdout', 'stderr', 'important'].includes(entry.category) || typeof entry.text !== 'string' || entry.text.length > 2048)) throw new Error('Invalid debug console output');
    if (!Array.isArray(sessions) || sessions.length > 64 || sessions.some(s => !s || ['id', 'deviceId', 'name', 'workspace'].some(key => typeof s[key] !== 'string' || s[key].length > (key === 'workspace' ? 4096 : 512)))) throw new Error('Invalid debug console sessions');
    if (!this.owners.has(ownerId) && this.owners.size >= 32) {
      for (const [id, owner] of this.owners) if (this.now() - owner.seen > 60000) this.owners.delete(id);
    }
    if (!this.owners.has(ownerId) && this.owners.size >= 32) throw new Error('Too many debug console clients');
    const owner = this.owners.get(ownerId) || { sequence: 0 };
    for (const entry of output) {
      if (entry.sequence <= owner.sequence) continue;
      owner.sequence = entry.sequence;
      const session = sessions.find(s => s.id === entry.sessionId);
      if (!session?.workspace) continue;
      for (const text of entry.text.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\r\n/g, '\n').split(/(?<=\n)/)) {
        if (!text) continue;
        this.lines.push({ id: this.next++, sessionId: session.id, deviceId: session.deviceId, workspace: session.workspace,
          name: session.name, text, category: entry.category });
      }
    }
    this.lines = this.lines.slice(-1000); owner.seen = this.now(); this.owners.set(ownerId, owner);
    return owner.sequence;
  }
  read(workspace, deviceId, after = 0) {
    const normalize = value => process.platform === 'win32' ? value.toLowerCase() : value;
    return { next: this.next, lines: this.lines.filter(line => workspace && normalize(line.workspace) === normalize(workspace) &&
      (!deviceId || line.deviceId === deviceId) && line.id > after).map(({ workspace: _, ...line }) => line) };
  }
}
