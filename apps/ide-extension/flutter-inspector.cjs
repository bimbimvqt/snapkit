'use strict';

const { randomUUID } = require('node:crypto');
const { realpath } = require('node:fs/promises');
const path = require('node:path');
const { fileURLToPath } = require('node:url');
const prefix = 'ext.flutter.inspector.';

function loopbackSocket(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'ws:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
        || !url.port || url.username || url.password || url.hash || url.search) return null;
    url.protocol = 'ws:';
    if (!url.pathname.endsWith('/ws')) url.pathname = `${url.pathname.replace(/\/$/, '')}/ws`;
    return url.href;
  } catch { return null; }
}

function connect(url, notify, disconnect) {
  const WebSocket = require('ws');
  const socket = new WebSocket(url, { handshakeTimeout: 3000, maxPayload: 4 * 1024 * 1024 });
  const pending = new Map();
  let sequence = 0;
  const ready = new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('close', () => reject(Error('Flutter VM Service disconnected')));
  });
  socket.on('error', () => {});
  socket.on('close', () => {
    for (const finish of pending.values()) finish(Error('Flutter VM Service disconnected'));
    disconnect();
  });
  socket.on('message', raw => {
    let message;
    try { message = JSON.parse(raw); } catch { return; }
    if (message?.method === 'streamNotify') notify(message.params?.event);
    else pending.get(message?.id)?.(message.error ? Error('Flutter Inspector request failed') : null, message.result);
  });
  return {
    async call(method, params = {}) {
      await ready;
      if (socket.readyState !== WebSocket.OPEN) throw Error('Flutter VM Service disconnected');
      return new Promise((resolve, reject) => {
        const id = ++sequence;
        const finish = (error, result) => {
          clearTimeout(timeout); pending.delete(id);
          if (error) reject(error); else resolve(result);
        };
        const timeout = setTimeout(() => finish(Error('Flutter Inspector timed out')), 2500);
        pending.set(id, finish);
        socket.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }), error => { if (error) finish(error); });
      });
    },
    close() { socket.terminate(); },
  };
}

function location(node, fallback) {
  const loc = node?.creationLocation || fallback;
  if (!loc || typeof loc.file !== 'string' || !Number.isSafeInteger(loc.line) || loc.line < 1) return null;
  return { file: loc.file, line: loc.line, column: Number.isSafeInteger(loc.column) && loc.column > 0 ? loc.column : 1 };
}

async function projectFile(root, file) {
  try {
    const resolved = await realpath(fileURLToPath(file));
    const relative = path.relative(root, resolved);
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)
        || path.extname(resolved) !== '.dart') return null;
    return { resolved, relative: relative.split(path.sep).join('/') };
  } catch { return null; }
}

function containingFunction(vscode, symbols, position) {
  const kinds = [vscode.SymbolKind.Function, vscode.SymbolKind.Method, vscode.SymbolKind.Constructor];
  for (const symbol of Array.isArray(symbols) ? symbols : []) {
    if (!symbol.range?.contains(position)) continue;
    const nested = containingFunction(vscode, symbol.children, position);
    if (nested) return nested;
    if (kinds.includes(symbol.kind)) return symbol.name;
  }
  return null;
}

function createFlutterInspector(vscode, { transport = connect } = {}) {
  const targets = new Map();
  const canUse = session => vscode.workspace.isTrusted && session.type === 'dart'
    && !session.configuration.noDebug && (!session.configuration.flutterMode || session.configuration.flutterMode === 'debug');
  const update = (target, phase, widget, project) => { target.state = { phase, widget, project }; };
  const toggle = (run, enabled) => run.rpc.call(`${prefix}show`, { isolateId: run.isolateId, enabled: String(enabled) });
  async function stop(target, phase = 'idle') {
    const run = target.run;
    target.run = null;
    update(target, phase);
    if (!run) return;
    clearTimeout(run.timer);
    try {
      await run.enabling?.catch(() => {});
      if (run.restore) await toggle(run, false);
    } catch {} finally { run.rpc.close(); }
  }
  async function readSelection(target, run, event) {
    const objectGroup = `snapkit-${randomUUID()}`;
    const args = { isolateId: run.isolateId, objectGroup };
    async function node(method) {
      const result = (await run.rpc.call(prefix + method, args))?.result;
      return typeof result === 'string' ? JSON.parse(result) : result;
    }
    const nameOf = value => String(value?.widgetRuntimeType || value?.description || value?.name || 'Widget').slice(0, 160);
    try {
      const selected = await node('getSelectedWidget');
      if (!selected || target.run !== run) return;
      const loc = location(selected);
      const displayLocation = loc ? { file: loc.file.startsWith('package:') ? loc.file.slice(0, 512) : loc.file.split(/[\\/]/).pop().slice(0, 512), line: loc.line, column: loc.column } : undefined;
      const widget = { name: nameOf(selected), ...displayLocation };
      let parent = selected;
      let origin = loc;
      let file = loc && await projectFile(run.root, loc.file);
      if (!file) {
        parent = await node('getSelectedSummaryWidget');
        origin = location(parent, { file: event?.extensionData?.fileUri, line: event?.extensionData?.line, column: event?.extensionData?.column });
        file = origin && await projectFile(run.root, origin.file);
      }
      if (target.run !== run) return;
      target.source = file && { ...file, line: origin.line, column: origin.column };
      const project = target.source && { name: nameOf(parent), file: file.relative, line: origin.line, column: origin.column };
      update(target, 'selected', widget, project || undefined);
      if (project) {
        const previous = target.source;
        const uri = vscode.Uri.file(file.resolved);
        const symbols = await Promise.race([
          vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', uri),
          new Promise(resolve => setTimeout(resolve, 1200)),
        ]).catch(() => null);
        if (target.run !== run || target.source !== previous) return;
        const enclosing = containingFunction(vscode, symbols, new vscode.Position(origin.line - 1, origin.column - 1));
        if (enclosing) update(target, 'selected', widget, { ...project, enclosing });
      }
    } finally {
      await run.rpc.call(`${prefix}disposeGroup`, args).catch(() => {});
    }
  }
  async function start(target, session) {
    if (target.run) return;
    target.source = null;
    update(target, 'starting');
    const run = {};
    target.run = run;
    let reading = false, next;
    run.rpc = transport(target.url, event => {
      if (target.run !== run || event?.isolate?.id !== run.isolateId || !run.isolateId) return;
      if (event.kind !== 'Inspect' && !(event.extensionKind === 'navigate' && event.extensionData?.source === 'flutter.inspector')) return;
      next = event;
      if (reading) return;
      reading = true;
      void (async () => {
        while (next && target.run === run) {
          const selected = next; next = null;
          await readSelection(target, run, selected).catch(() => { if (target.run === run) update(target, 'waiting'); });
        }
      })().finally(() => { reading = false; });
    }, () => { if (target.run === run) void stop(target, 'unavailable'); });
    run.timer = setTimeout(() => { if (target.run === run) void stop(target, 'expired'); }, 120000);
    run.timer.unref?.();
    try {
      const folder = session.workspaceFolder?.uri.fsPath || session.configuration.cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      run.root = await realpath(folder);
      const vm = await run.rpc.call('getVM');
      for (const ref of vm.isolates || []) {
        const isolate = await run.rpc.call('getIsolate', { isolateId: ref.id });
        if (isolate.extensionRPCs?.includes(`${prefix}show`)) { run.isolateId = ref.id; break; }
      }
      if (!run.isolateId || target.run !== run) throw Error('Flutter Inspector is not available');
      await run.rpc.call('streamListen', { streamId: 'Debug' });
      await run.rpc.call('streamListen', { streamId: 'ToolEvent' }).catch(() => {});
      const previous = await run.rpc.call(`${prefix}show`, { isolateId: run.isolateId });
      if (target.run !== run) return;
      run.restore = previous?.enabled !== 'true' && previous?.enabled !== true;
      run.enabling = toggle(run, true);
      await run.enabling;
      if (target.run === run && target.state.phase === 'starting') update(target, 'waiting');
    } catch { if (target.run === run) await stop(target, 'unavailable'); }
  }
  return {
    event(session, message) {
      if (!canUse(session) || message.event !== 'dart.debuggerUris') return;
      const url = loopbackSocket(message.body?.vmServiceUri);
      if (!url || targets.get(session.id)?.url === url) return;
      this.end(session);
      targets.set(session.id, { url, state: { phase: 'idle' } });
    },
    status(session) { return canUse(session) ? targets.get(session.id)?.state : undefined; },
    async action(session, command) {
      const target = targets.get(session.id);
      if (!target || !canUse(session)) return;
      if (command === 'inspectUI') await start(target, session);
      if (command === 'closeInspector') await stop(target);
      if (command === 'openInspectedSource' && target.source && target.run) {
        const { resolved, line, column } = target.source;
        const uri = vscode.Uri.file(resolved);
        const position = new vscode.Position(line - 1, column - 1);
        await vscode.window.showTextDocument(uri, { selection: new vscode.Range(position, position), preview: true });
      }
    },
    end(session) {
      const target = targets.get(session.id);
      if (!target) return;
      targets.delete(session.id);
      void stop(target);
    },
    async dispose() { await Promise.all([...targets.values()].map(target => stop(target))); targets.clear(); },
  };
}

module.exports = { createFlutterInspector, loopbackSocket, containingFunction };
