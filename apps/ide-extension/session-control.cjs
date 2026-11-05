'use strict';
const http = require('node:http');
const { randomUUID } = require('node:crypto');
function agentRequest(base, pathname, body, token) {
  const url = new URL(base);
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return Promise.reject(new Error('Snapkit agent must be a loopback HTTP address'));
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request(new URL(pathname, url), { method: data ? 'POST' : 'GET', timeout: 1500, headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'X-Snapkit-Token': token } : {} }, res => {
      let raw = ''; res.setEncoding('utf8');
      res.on('data', chunk => { raw += chunk; if (raw.length > 256 * 1024) req.destroy(new Error('Agent response too large')); });
      res.on('error', reject);
      res.on('end', () => { try { if (res.statusCode !== 200) throw new Error('Snapkit agent unavailable'); resolve(JSON.parse(raw)); } catch (e) { reject(e); } });
    });
    req.on('error', reject); req.on('timeout', () => req.destroy(new Error('Snapkit agent timed out')));
    req.end(data);
  });
}
function createSessionControl(vscode, { request = agentRequest, report = () => {} } = {}) {
  const ownerId = randomUUID(), sessions = new Map(), stopping = new Set();
  let timer, pending = false, dirty = false, disposed = false, credentials = null;
  const schedule = () => { if (!disposed && sessions.size) { clearTimeout(timer); timer = setTimeout(tick, 1000); timer.unref?.(); } };
  async function tick() {
    if (pending || disposed) return;
    pending = true; dirty = false;
    try {
      const base = vscode.workspace.getConfiguration('snapkit').get('agentUrl', 'http://127.0.0.1:4310');
      if (!credentials || credentials.base !== base) {
        const state = await request(base, '/api/state');
        if (typeof state.token !== 'string') throw new Error('No local session token');
        credentials = { base, token: state.token };
      }
      const listed = [...sessions.values()].map(s => ({ id: s.id, deviceId: s.configuration.deviceId, name: s.name || 'App debug' }));
      const result = await request(base, '/api/ide/sessions', { ownerId, sessions: listed }, credentials.token);
      for (const id of result.stopSessionIds || []) {
        const session = sessions.get(id);
        if (!session || stopping.has(id)) continue;
        stopping.add(id);
        try { await vscode.debug.stopDebugging(session); report(`Stop requested for ${session.name}`); }
        catch (error) { report(`Could not stop ${session.name}: ${error.message}`); }
        finally { stopping.delete(id); }
      }
    } catch { credentials = null; /* Losing the agent never interrupts debugging. */ }
    finally { pending = false; if (dirty && !disposed) queueMicrotask(tick); else schedule(); }
  }
  return {
    started(session) {
      if (!vscode.workspace.isTrusted || !(['dart', 'reactnative', 'reactnativedirect'].includes(session.type) || (session.type === 'pwa-node' && session.configuration.__snapkitNativeGroup)) || session.configuration.noDebug || typeof session.configuration.deviceId !== 'string' || !session.configuration.deviceId) return;
      sessions.set(session.id, session); dirty = true; void tick();
    },
    terminated(session) { if (!sessions.has(session.id)) return; sessions.delete(session.id); stopping.delete(session.id); clearTimeout(timer); dirty = true; void tick(); },
    tick,
    dispose() { disposed = true; clearTimeout(timer); sessions.clear(); },
  };
}
module.exports = { createSessionControl, agentRequest };
