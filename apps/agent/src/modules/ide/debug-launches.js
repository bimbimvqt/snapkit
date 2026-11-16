import { randomUUID } from 'node:crypto';

// Only a trusted extension with the matching project open can consume a launch.
export class DebugLaunches {
  constructor({ now = Date.now } = {}) { this.now = now; this.clients = new Map(); this.jobs = new Map(); }
  exchange(ownerId, workspaces = [], results = []) {
    if (!Array.isArray(workspaces) || workspaces.length > 32 || workspaces.some(p => typeof p !== 'string' || !p || p.length > 4096)
        || !Array.isArray(results) || results.length > 32) throw new Error('Invalid debug launch report');
    this.prune();
    if (!this.clients.has(ownerId) && this.clients.size >= 32) throw new Error('Too many IDE clients');
    this.clients.set(ownerId, { workspaces, seen: this.now() });
    for (const result of results) {
      const job = this.jobs.get(result?.id);
      if (job?.ownerId === ownerId && job.status === 'queued' && ['started', 'failed'].includes(result.status)) {
        job.status = result.status; job.error = typeof result.error === 'string' ? result.error.slice(0, 512) : '';
      }
    }
    this.prune();
    return [...this.jobs.values()].filter(job => job.ownerId === ownerId && job.status === 'queued')
      .map(({ id, plan }) => ({ id, plan }));
  }
  prune() {
    for (const [id, client] of this.clients) if (this.now() - client.seen > 10000) this.clients.delete(id);
    for (const [id, job] of this.jobs) {
      if (this.now() - job.at > 120000 && job.status === 'queued') { job.status = 'failed'; job.error = 'Debug launch timed out. Check your IDE before trying again.'; }
      if (this.now() - job.at > 600000) this.jobs.delete(id);
    }
  }
  start(plan) {
    this.prune();
    if ([...this.jobs.values()].some(job => job.plan.workspace === plan.workspace && job.status === 'queued')) throw new Error('Debug is already starting for this project.');
    const owners = [...this.clients].filter(([, client]) => client.workspaces.includes(plan.workspace));
    if (!owners.length) throw new Error('Open this project in your IDE with Snapkit Debug Sync 1.7 or newer, then reload the IDE window.');
    if (owners.length > 1) throw new Error('This project is open in multiple IDE windows. Keep one connected window to start debug.');
    const job = { id: randomUUID(), ownerId: owners[0][0], plan: structuredClone(plan), status: 'queued', at: this.now() };
    this.jobs.set(job.id, job); return this.status(job.id);
  }
  status(id) {
    this.prune(); const job = this.jobs.get(id);
    if (!job) throw new Error('Debug launch not found.');
    return { id: job.id, status: job.status, error: job.error || '' };
  }
}
