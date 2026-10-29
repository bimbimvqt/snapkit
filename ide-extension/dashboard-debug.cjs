'use strict';

const { randomUUID } = require('node:crypto');
const { realpath, readFile } = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');

async function canonicalWorkspace(value) {
  const resolved = await realpath(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function getPlan(base) {
  const url = new URL(base);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname)
      || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    return Promise.reject(new Error('Snapkit agent must be a loopback HTTP address'));
  }
  return new Promise((resolve, reject) => {
    // Native extension host HTTP: no browser CORS changes or stored bearer tokens.
    const request = http.get(new URL('/api/ide/plan', url), { timeout: 1500 }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
        if (body.length > 128 * 1024) request.destroy(new Error('IDE plan exceeds size limit'));
      });
      response.on('error', reject);
      response.on('end', () => {
        try {
          if (response.statusCode !== 200) throw new Error('Snapkit agent is unavailable');
          resolve(JSON.parse(body));
        } catch (error) { reject(error); }
      });
    });
    request.on('timeout', () => request.destroy(new Error('Snapkit agent timed out')));
    request.on('error', reject);
  });
}

function createDashboardDebug(vscode, { readPlan = getPlan, canonical = canonicalWorkspace, report = () => {}, flutterProject = async root => /^\s*flutter\s*:/m.test(await readFile(path.join(root, 'pubspec.yaml'), 'utf8')) } = {}) {
  const groups = new Map();
  const normal = config => !config.__snapkitGroup;
  async function stop(group) {
    if (group.stopping) return;
    group.stopping = true; group.queue = [];
    groups.delete(group.id); clearTimeout(group.expiry);
    await Promise.allSettled([...group.sessions.values()].map(session => vscode.debug.stopDebugging(session)));
  }
  function member(config, group) {
    return { ...config, __snapkitGroup: group.id };
  }
  const provider = {
    async resolveDebugConfiguration(folder, config, token) {
      if (!normal(config)) return groups.has(config.__snapkitGroup) ? config : undefined;
      const settings = vscode.workspace.getConfiguration('snapkit', folder?.uri);
      const program = String(config.program || '').replaceAll('\\', '/');
      if (!folder || !vscode.workspace.isTrusted || !settings.get('useDashboardTargets', true)
          || (config.type && config.type !== 'dart') || (config.request && config.request !== 'launch')
          || config.noDebug || (config.flutterMode && config.flutterMode !== 'debug')
          || config.testName || config.testSuite || config.runTestsOnDevice
          || /(^|\/)(test|integration_test)\//.test(program) || /_test\.dart(?:\?|$)/.test(program)) return config;
      let plan, root;
      try {
        root = await canonical(folder.uri.fsPath);
        if (!await flutterProject(root)) return config;
        plan = await readPlan(settings.get('agentUrl', 'http://127.0.0.1:4310'));
        if (plan.protocol !== 1 || !plan.workspace || root !== await canonical(plan.workspace) || plan.status === 'inactive') return config;
      } catch {
        report('Snapkit unavailable; using the original IDE debug configuration.');
        return config;
      }
      if (token?.isCancellationRequested) return undefined;
      if (plan.status !== 'ready' || !Array.isArray(plan.configurations) || !plan.configurations.length) {
        void vscode.window.showErrorMessage(`Snapkit: ${plan.reason || 'Update the device selection in Dashboard.'}`);
        return undefined;
      }
      // Accept a narrow Flutter launch schema, never adapter executables or commands.
      if (plan.configurations.some(c => c.type !== 'dart' || c.request !== 'launch' || c.flutterMode !== 'debug'
          || c.cwd !== plan.workspace || !path.isAbsolute(c.program) || typeof c.deviceId !== 'string'
          || !Array.isArray(c.toolArgs) || c.toolArgs.some(a => typeof a !== 'string'))) {
        void vscode.window.showErrorMessage('Snapkit: Invalid IDE configuration from local agent.');
        return undefined;
      }
      if ([...groups.values()].some(group => group.root === root && group.sessions.size)) {
        void vscode.window.showWarningMessage('Snapkit: Selected devices are already debugging. Stop that group before starting another.');
        return undefined;
      }
      const group = { id: randomUUID(), root, folder, sessions: new Map(), queue: [], stopping: false, launching: false };
      const configs = plan.configurations.map(c => {
        const combined = { ...config, name: c.name, type: 'dart', request: 'launch', flutterMode: 'debug',
          program: c.program, cwd: c.cwd, deviceId: c.deviceId, args: [], toolArgs: c.toolArgs };
        delete combined.dartCodeDebugSessionID;
        return member(combined, group);
      });
      group.queue = configs.slice(1);
      // Clean up a plan if the native Dart resolver cancels before any session starts.
      group.expiry = setTimeout(() => { if (!group.sessions.size) groups.delete(group.id); }, 120000);
      group.expiry.unref?.();
      groups.set(group.id, group);
      report(`Dashboard selected ${configs.length} device(s); launching in memory. Project files are unchanged.`);
      return configs[0];
    },
  };
  function started(session) {
    const group = groups.get(session.configuration.__snapkitGroup);
    if (group) { group.sessions.set(session.id, session); clearTimeout(group.expiry); }
    else if (session.configuration.__snapkitGroup) { void vscode.debug.stopDebugging(session); }
  }
  async function ready(session) {
    const group = groups.get(session.configuration.__snapkitGroup);
    if (!group || group.stopping || group.launching || !group.queue.length) return;
    group.launching = true;
    try {
      // Start the next device only after this app is ready, avoiding concurrent
      // Xcode builds into the same Flutter build directory.
      const next = group.queue.shift();
      if (!await vscode.debug.startDebugging(group.folder, next)) throw new Error(`Could not start ${next.name}`);
    } catch (error) {
      report(error.message);
      void vscode.window.showErrorMessage(`Snapkit: ${error.message}. The debug group has been stopped.`);
      await stop(group);
    } finally { group.launching = false; }
  }
  async function terminated(session) {
    const group = groups.get(session.configuration.__snapkitGroup);
    if (!group) return;
    group.sessions.delete(session.id);
    await stop(group);
  }
  return { provider, started, ready, terminated, dispose() {
    // IDE already owns running sessions. Disabling Snapkit must not stop them.
    for (const group of groups.values()) clearTimeout(group.expiry);
    groups.clear();
  } };
}

module.exports = { createDashboardDebug, getPlan };
