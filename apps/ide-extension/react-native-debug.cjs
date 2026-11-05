'use strict';
const {randomUUID} = require('node:crypto');
const {realpath} = require('node:fs/promises');
const {getPlan} = require('./dashboard-debug.cjs');
const {createRuntime, communityCli} = require('./react-native-runtime.cjs');
const {createInspectorBridge, inspectorCommand} = require('./react-native-transport.cjs');
function createNativeDebug(vscode, {report = () => {}, runtime = createRuntime({output: report}), readPlan = getPlan, resolveCli = communityCli, makeBridge = createInspectorBridge} = {}) {
  const groups = new Map();
  const clean = group => {clearTimeout(group.expiry); for (const bridge of group.bridges.values()) bridge.dispose(); groups.delete(group.id);};
  const provider = {
    provideDebugConfigurations() {return [{name: 'Snapkit: React Native selected devices', type: 'snapkit-react-native', request: 'launch'}];},
    async resolveDebugConfiguration(folder, config, token) {
      if (!folder || !vscode.workspace.isTrusted) return undefined;
      let group;
      const abort = new AbortController();
      if (token?.isCancellationRequested) return undefined;
      const cancellation = token?.onCancellationRequested(() => abort.abort());
      try {
        const root = await realpath(folder.uri.fsPath);
        if ([...groups.values()].some(g => g.root === root)) throw Error('Selected devices are already debugging. Stop those sessions before starting again.');
        const base = vscode.workspace.getConfiguration('snapkit').get('agentUrl', 'http://127.0.0.1:4310');
        const plan = await readPlan(base);
        if (plan.protocol !== 1 || plan.framework !== 'react-native' || await realpath(plan.workspace) !== root || plan.status !== 'ready') throw Error(plan.reason || 'Open this React Native project in Snapkit and select devices.');
        const configs = plan.configurations;
        if (!Array.isArray(configs) || !configs.length || configs.length > 32 || configs.some(c => c.type !== 'reactnative' || c.request !== 'launch' || c.cwd !== plan.workspace || !['ios', 'android'].includes(c.platform) || typeof c.deviceId !== 'string' || !/^[\w.:-]+$/.test(c.deviceId)) || new Set(configs.map(c => c.deviceId)).size !== configs.length) throw Error('Invalid device plan');
        const port = config.metroPort ?? 8081;
        if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('metroPort must be between 1024 and 65535');
        const node = config.nodePath || 'node', cli = await resolveCli(root);
        group = {id: randomUUID(), root, folder, sessions: new Map(), bridges: new Map(), queue: [], targets: new Map(), port};
        groups.set(group.id, group);
        await vscode.window.withProgress({location: vscode.ProgressLocation.Notification, title: 'Snapkit: Preparing React Native devices', cancellable: true}, async (progress, cancel) => {
          const listener = cancel.onCancellationRequested(() => abort.abort());
          try {
            await runtime.ensureMetro(root, port, cli, node, abort.signal);
            for (const device of configs) {
              if (abort.signal.aborted) throw Error('React Native launch cancelled');
              progress.report({message: device.name});
              const target = await runtime.launch(root, device, {port, node, cli, signal: abort.signal});
              const bridge = await makeBridge(target, port);
              group.bridges.set(device.deviceId, bridge); group.targets.set(device.deviceId, target);
              group.queue.push({name: device.name, type: 'pwa-node', request: 'attach', address: '127.0.0.1', port: bridge.port, cwd: root, localRoot: root, remoteRoot: root, sourceMaps: true, autoAttachChildProcesses: false, attachExistingChildren: false, restart: false, timeout: 30000, deviceId: device.deviceId, __snapkitNativeGroup: group.id, resolveSourceMapLocations: ['**'], sourceMapPathOverrides: {'/[metro-project]/*': root + '/*', ['http://127.0.0.1:' + port + '/[metro-project]/*']: root + '/*', ['http://localhost:' + port + '/[metro-project]/*']: root + '/*'}, skipFiles: ['<node_internals>/**']});
            }
          } finally {listener.dispose();}
        });
        if (abort.signal.aborted) throw Error('React Native launch cancelled');
        group.expiry = setTimeout(() => {if (!group.sessions.size) clean(group);}, 60000); group.expiry.unref?.();
        return group.queue.shift();
      } catch (error) {if (group) clean(group); report(error.stack || error.message); void vscode.window.showErrorMessage(`Snapkit: ${error.message}`); return undefined;}
      finally {cancellation?.dispose();}
    },
  };
  async function reload(group) {
    if (group.reloading) return group.reloading;
    group.reloading = Promise.all([...group.sessions.values()].map(async session => {
      await inspectorCommand(group.targets.get(session.configuration.deviceId), group.port, 'Page.reload');
      report(`Reloaded React Native: ${session.name}`);
    })).catch(error => {report(error.message); void vscode.window.showErrorMessage(`Snapkit: Reload failed: ${error.message}`);}).finally(() => {group.reloading = null;});
    return group.reloading;
  }
  const legacyProvider = {async resolveDebugConfiguration(folder, config, token) {
    if (!folder || !vscode.workspace.isTrusted || config.__snapkitGroup || config.noDebug || config.request !== 'launch') return config;
    const settings = vscode.workspace.getConfiguration('snapkit', folder.uri);
    if (!settings.get('useDashboardTargets', true)) return config;
    try {
      const plan = await readPlan(settings.get('agentUrl', 'http://127.0.0.1:4310'));
      if (plan.protocol !== 1 || plan.framework !== 'react-native' || !plan.workspace || await realpath(plan.workspace) !== await realpath(folder.uri.fsPath) || plan.status === 'inactive') return config;
    } catch {return config;}
    return provider.resolveDebugConfiguration(folder, config, token);
  }};
  return {provider, legacyProvider,
    async reloadAll() {await Promise.all([...groups.values()].map(reload));},
    createDebugAdapterTracker(session) {
      const id = session.configuration.__snapkitNativeGroup || session.parentSession?.configuration.__snapkitNativeGroup;
      if (!id) return undefined;
      return {onWillReceiveMessage(message) {
        if (message.type === 'request' && message.command === 'restart') {
          const group = groups.get(id);
          if (group) void reload(group);
        }
      }};
    },
    async started(session) {
      const group = groups.get(session.configuration.__snapkitNativeGroup);
      if (!group) return;
      group.sessions.set(session.id, session); clearTimeout(group.expiry);
      const peers = group.queue.splice(0);
      for (const peer of peers) {
        let started = false;
        try {started = await vscode.debug.startDebugging(group.folder, peer);} catch (error) {report(error.message);}
        if (!started) {
          await Promise.allSettled([...group.sessions.values()].map(s => vscode.debug.stopDebugging(s))); clean(group);
          void vscode.window.showErrorMessage(`Snapkit: Could not attach ${peer.name}`); break;
        }
      }
    },
    terminated(session) {
      const group = groups.get(session.configuration.__snapkitNativeGroup);
      if (!group) return;
      group.sessions.delete(session.id); group.bridges.get(session.configuration.deviceId)?.dispose(); group.bridges.delete(session.configuration.deviceId);
      if (!group.sessions.size) clean(group);
    },
    dispose() {for (const group of groups.values()) clean(group); runtime.dispose();},
  };
}
module.exports = {createNativeDebug};
