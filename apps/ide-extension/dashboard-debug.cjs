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
    const request = http.get(new URL('/api/ide/plan', url), { timeout: 120000 }, response => {
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

function createDashboardDebug(vscode, { readPlan = getPlan, canonical = canonicalWorkspace, report = () => {}, reactNativeProject = async root => { const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')); return !!(pkg.dependencies?.['react-native'] || pkg.devDependencies?.['react-native']); }, flutterProject = async root => /^\s*flutter\s*:/m.test(await readFile(path.join(root, 'pubspec.yaml'), 'utf8')) } = {}) {
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
      const native = ['reactnative', 'reactnativedirect'].includes(config.type);
      const program = String(config.program || '').replaceAll('\\', '/');
      if (!folder || !vscode.workspace.isTrusted || !settings.get('useDashboardTargets', true)
          || (config.type && !['dart', 'reactnative', 'reactnativedirect'].includes(config.type)) || (config.request && config.request !== 'launch')
          || config.noDebug || (config.flutterMode && config.flutterMode !== 'debug')
          || config.testName || config.testSuite || config.runTestsOnDevice
          || /(^|\/)(test|integration_test)\//.test(program) || /_test\.dart(?:\?|$)/.test(program)) return config;
      let plan, root;
      try {
        root = await canonical(folder.uri.fsPath);
        if (!await (native ? reactNativeProject(root) : flutterProject(root))) return config;
        plan = await readPlan(settings.get('agentUrl', 'http://127.0.0.1:4310'));
        if (plan.protocol !== 1 || !plan.workspace || root !== await canonical(plan.workspace) || plan.status === 'inactive') return config;
      } catch {
        report('Snapkit unavailable; using the original IDE debug configuration.');
        return config;
      }
      if ((plan.framework === 'react-native') !== native) return config;
      if (token?.isCancellationRequested) return undefined;
      if (plan.status !== 'ready' || !Array.isArray(plan.configurations) || !plan.configurations.length) {
        void vscode.window.showErrorMessage(`Snapkit: ${plan.reason || 'Update the device selection in Dashboard.'}`);
        return undefined;
      }
      // Accept only device launch data, never adapter executables or commands.
      if (plan.configurations.some(c => c.request !== 'launch' || c.cwd !== plan.workspace || typeof c.deviceId !== 'string' || !c.deviceId
          || (native ? c.type !== 'reactnative' || !['android', 'ios'].includes(c.platform) || c.target !== c.deviceId
            || !Array.isArray(c.runArguments) || c.runArguments.length !== 2
            || c.runArguments[0] !== (c.platform === 'ios' ? '--udid' : '--deviceId') || c.runArguments[1] !== c.deviceId
            : c.type !== 'dart' || c.flutterMode !== 'debug' || !path.isAbsolute(c.program)
              || !Array.isArray(c.toolArgs) || c.toolArgs.some(a => typeof a !== 'string')))) {
        void vscode.window.showErrorMessage('Snapkit: Invalid IDE configuration from local agent.');
        return undefined;
      }
      if ([...groups.values()].some(group => group.root === root)) {
        void vscode.window.showWarningMessage('Snapkit: Selected devices are already debugging. Stop that group before starting another.');
        return undefined;
      }
      const group = { id: randomUUID(), root, folder, sessions: new Map(), queue: [], stopping: false };
      const configs = plan.configurations.map(c => {
        if (native) return member({ ...config, ...c, type: config.type }, group);
        const combined = { ...config, name: c.name, type: 'dart', request: 'launch', flutterMode: 'debug',
          ...(c.__snapkitTeamSession?{__snapkitTeamSession:c.__snapkitTeamSession}:{}),program: c.program, cwd: c.cwd, deviceId: c.deviceId, args: [], toolArgs: c.toolArgs };
        delete combined.dartCodeDebugSessionID;
        return member(combined, group);
      });
      group.queue = configs.slice(1);
      // Clean up a plan if the native Dart resolver cancels before any session starts.
      group.expiry = setTimeout(() => { if (!group.sessions.size) groups.delete(group.id); }, 120000);
      group.expiry.unref?.();
      groups.set(group.id, group);
      report(`Dashboard selected ${configs.length} device(s); launching concurrently in memory. Project files are unchanged.`);
      return configs[0];
    },
  };
  async function started(session) {
    const group = groups.get(session.configuration.__snapkitGroup);
    if (!group) {
      if (session.configuration.__snapkitGroup) await vscode.debug.stopDebugging(session);
      return;
    }
    group.sessions.set(session.id, session);
    clearTimeout(group.expiry);
    // Drain before launching: peer start events must not fan out again.
    // Start every peer now, without waiting for flutter.appStarted or a build.
    const pending = group.queue.splice(0);
    if (pending.length) report(`Starting ${pending.length} peer debug session(s) before app readiness.`);
    await Promise.allSettled(pending.map(async config => {
      if (group.stopping) return;
      try {
        report(`Requesting debug: ${config.name}`);
        if (!await vscode.debug.startDebugging(group.folder, config)) {
          throw new Error(`Could not start ${config.name}`);
        }
      } catch (error) {
        if (group.stopping) return;
        report(error.message);
        void vscode.window.showErrorMessage(`Snapkit: ${error.message}. The debug group has been stopped.`);
        await stop(group);
      }
    }));
  }
  async function terminated(session) {
    const group = groups.get(session.configuration.__snapkitGroup);
    if (!group) return;
    group.sessions.delete(session.id);
    // Ending one device must keep peer debug sessions alive. Startup failures
    // still stop the group through stop(group).
    if (!group.sessions.size) { groups.delete(group.id); clearTimeout(group.expiry); }
  }
  return { provider, started, terminated, dispose() {
    // IDE already owns running sessions. Disabling Snapkit must not stop them.
    for (const group of groups.values()) clearTimeout(group.expiry);
    groups.clear();
  } };
}

module.exports = { createDashboardDebug, getPlan };
