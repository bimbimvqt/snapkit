'use strict';
const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { realpath } = require('node:fs/promises');
const canonical = async p => { if (!p) return ''; const root = await realpath(p); return process.platform === 'win32' ? root.toLowerCase() : root; };
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
  const launches = new Map(), actions = new Set(), outputSessions = new Map();
  let outputSequence = 0, outputQueue = [];
  let timer, pending = false, dirty = false, disposed = false, credentials = null;
  const schedule = () => { if (!disposed && (sessions.size || vscode.workspace.workspaceFolders?.length)) { clearTimeout(timer); timer = setTimeout(tick, 1000); timer.unref?.(); } };
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
      const describe = async s => ({ workspace: await canonical(s.workspaceFolder?.uri.fsPath || s.configuration.cwd || (vscode.workspace.workspaceFolders?.length === 1 ? vscode.workspace.workspaceFolders[0].uri.fsPath : '') || '').catch(() => ''), id: s.id, deviceId: s.configuration.deviceId, name: s.name || 'App debug',...(s.configuration.__snapkitTeamSession?{teamSessionId:s.configuration.__snapkitTeamSession}:{}) });
      const listed = await Promise.all([...sessions.values()].map(describe));
      const folders = vscode.workspace.isTrusted ? vscode.workspace.workspaceFolders || [] : [];
      const roots = await Promise.all(folders.map(async folder => ({ folder, root: await canonical(folder.uri.fsPath).catch(() => '') })));
      const launchResults = [...launches].filter(([, result]) => result.status).map(([id, result]) => ({ id, ...result }));
      const outputBatch = vscode.workspace.isTrusted ? outputQueue.slice(0, 16) : [];
      const consoleSessions = await Promise.all([...new Set(outputBatch.map(entry => entry.sessionId))].map(id => describe(outputSessions.get(id))));
      const result = await request(base, '/api/ide/sessions', { ownerId, sessions: listed,
        workspaces: roots.map(item => item.root).filter(Boolean), consoleOutput: outputBatch, consoleSessions, capabilities: ['ide-profiles'], launchResults, actionResults: [...actions] }, credentials.token);
      if (Number.isSafeInteger(result.consoleAck)) outputQueue = outputQueue.filter(entry => entry.sequence > result.consoleAck);
      for (const id of outputSessions.keys()) if (!outputQueue.some(entry => entry.sessionId === id)) outputSessions.delete(id);
      for (const { id } of launchResults) launches.delete(id);
      const activeActions = new Set((result.actions || []).map(action => action.id));
      for (const id of actions) if (!activeActions.has(id)) actions.delete(id);
      for (const command of result.launches || []) {
        if (launches.has(command.id)) continue;
        const entry = roots.find(item => item.root === command.plan?.workspace);
        if (!entry || !vscode.workspace.isTrusted) continue;
        launches.set(command.id, {});
        // Launching/building may take minutes. Keep heartbeats and Stop working.
        void (async () => {
          try {
            if (command.plan.status !== 'ready' || command.plan.framework === 'react-native') throw Error('Invalid Flutter launch');
            let configuration = { name: 'Snapkit Debug', type: 'dart', request: 'launch' };
            if (command.plan.ideProfile) {
              const configs = vscode.workspace.getConfiguration('launch', entry.folder.uri).get('configurations', []);
              const matching = configs.filter(c => c.name === command.plan.ideProfile.name && c.type === 'dart' && c.request === 'launch');
              if (matching.length !== 1 || matching[0].noDebug || (matching[0].flutterMode && matching[0].flutterMode !== 'debug') || matching[0].__snapkitGroup) throw Error('The selected IDE debug profile is missing or ambiguous. Refresh profiles in Snapkit.');
              configuration = { ...matching[0] };
            }
            const started = await vscode.debug.startDebugging(entry.folder, { ...configuration, __snapkitLaunchPlan: command.plan });
            launches.set(command.id, { status: started ? 'started' : 'failed', error: started ? '' : 'IDE cancelled debug. Check the Debug Console.' });
          } catch (error) { launches.set(command.id, { status: 'failed', error: error.message }); }
          if (!disposed) void tick();
        })();
      }
      for (const action of result.actions || []) {
        if (actions.has(action.id)) continue;
        actions.add(action.id);
        const session = sessions.get(action.sessionId);
        if (!session || session.type !== 'dart' || !['hotReload', 'hotRestart'].includes(action.command)) continue;
        try { await session.customRequest(action.command, { reason: 'manual' }); report(`${action.command}: ${session.name}`); }
        catch (error) { report(error.message); void vscode.window?.showErrorMessage?.(`Snapkit: ${error.message}`); }
      }
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
  const thisControl = {
    started(session) {
      if (!vscode.workspace.isTrusted || !(['dart', 'reactnative', 'reactnativedirect'].includes(session.type) || (session.type === 'pwa-node' && session.configuration.__snapkitNativeGroup)) || session.configuration.noDebug || typeof session.configuration.deviceId !== 'string' || !session.configuration.deviceId) return;
      sessions.set(session.id, session); dirty = true; void tick();
    },
    terminated(session) { if (!sessions.has(session.id)) return; sessions.delete(session.id); stopping.delete(session.id); clearTimeout(timer); dirty = true; void tick(); },
    createDebugAdapterTracker(session) {
      return {
        onWillStartSession() { thisControl.started(session); },
        onDidSendMessage(message) {
          if (message.type !== 'event' || message.event !== 'output' || !sessions.has(session.id) || !vscode.workspace.isTrusted) return;
          const { output, category = 'console' } = message.body || {};
          if (typeof output !== 'string' || !output || !['console', 'stdout', 'stderr', 'important'].includes(category)) return;
          // Bound both individual events and the offline queue. Adapter telemetry
          // and input requests are never forwarded to the console.
          outputSessions.set(session.id, session);
          for (let offset = 0; offset < Math.min(output.length, 65536); offset += 2048) {
            outputQueue.push({ sequence: ++outputSequence, sessionId: session.id, category, text: output.slice(offset, offset + 2048) });
          }
          outputQueue = outputQueue.slice(-256);
          for (const id of outputSessions.keys()) if (!outputQueue.some(entry => entry.sessionId === id)) outputSessions.delete(id);
        },
      };
    },
    tick,
    connect() { void tick(); },
    dispose() { disposed = true; clearTimeout(timer); sessions.clear(); outputQueue = []; outputSessions.clear(); },
  };
  return thisControl;
}
module.exports = { createSessionControl, agentRequest };
