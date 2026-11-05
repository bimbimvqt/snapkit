'use strict';

function createRestartSync({ enabled, report, onReady = () => {}, onStarting = () => {} }) {
  const sessions = new Map();
  let pending = null;

  function createDebugAdapterTracker(session) {
    const state = { session, ready: false };
    sessions.set(session.id, state);
    return {
      onWillStartSession() { void onStarting(session); },
      onDidSendMessage(message) {
        if (message.type !== 'event') return;
        if (message.event === 'flutter.appStarted') { state.ready = true; void onReady(session); }
        if (message.event === 'terminated' || message.event === 'exited') {
          sessions.delete(session.id);
        }
      },
      onWillReceiveMessage(message) {
        // The source adapter handles the original restart. Forward only to peers;
        // custom hotRestart requests do not enter this branch, avoiding recursion.
        if (message.type !== 'request' || message.command !== 'restart'
            || !state.ready || !enabled(session) || pending) return;
        const peers = [...sessions.values()].filter(other =>
          other !== state && other.ready && enabled(other.session));
        pending = Promise.allSettled(peers.map(async ({ session: peer }) => {
          await peer.customRequest('hotRestart', { reason: 'manual' });
          report(`Restarted: ${peer.name}`);
        })).then(results => {
          results.forEach((result, index) => {
            if (result.status === 'rejected') {
              report(`Restart failed: ${peers[index].session.name}: ${result.reason?.message || 'unknown error'}`, true);
            }
          });
        }).finally(() => { pending = null; });
        report(`Restart button: ${session.name}; forwarding to ${peers.length} Flutter session(s).`);
      },
      onExit() { sessions.delete(session.id); },
      onError() { sessions.delete(session.id); },
    };
  }

  return { createDebugAdapterTracker, idle: () => pending || Promise.resolve() };
}

function activate(context) {
  const vscode = require('vscode');
  const output = vscode.window.createOutputChannel('Snapkit Debug Sync');
  const report = message => output.appendLine(`${new Date().toISOString()} ${message}`);
  const dashboard = require('./dashboard-debug.cjs').createDashboardDebug(vscode, { report });
  const native = require('./react-native-debug.cjs').createNativeDebug(vscode, {report});
  const control = require('./session-control.cjs').createSessionControl(vscode, { report });
  const sync = createRestartSync({
    onStarting: session => dashboard.started(session),
    enabled: session => vscode.workspace.getConfiguration('snapkit', session.workspaceFolder?.uri)
      .get('syncFlutterRestart', true),
    report: (message, failed) => {
      output.appendLine(`${new Date().toISOString()} ${message}`);
      if (failed) void vscode.window.showWarningMessage(`Snapkit: ${message}`);
    },
  });
  context.subscriptions.push(output, dashboard, control, native,
    vscode.debug.registerDebugConfigurationProvider('snapkit-react-native', native.provider),
    vscode.debug.registerDebugAdapterTrackerFactory('pwa-node', native),
    vscode.commands.registerCommand('snapkit.reloadReactNative', () => native.reloadAll()),
    vscode.commands.registerCommand('snapkit.debugReactNative', async () => {
      const folders = vscode.workspace.workspaceFolders || [];
      const folder = folders.length === 1 ? folders[0] : await vscode.window.showWorkspaceFolderPick({placeHolder: 'Select the React Native project connected to Snapkit'});
      if (folder) return vscode.debug.startDebugging(folder, {name: 'Snapkit: React Native', type: 'snapkit-react-native', request: 'launch'});
    }),
    vscode.debug.registerDebugAdapterTrackerFactory('dart', sync),
    vscode.debug.registerDebugConfigurationProvider('dart', dashboard.provider),
    vscode.debug.registerDebugConfigurationProvider('reactnative', native.legacyProvider),
    vscode.debug.registerDebugConfigurationProvider('reactnativedirect', native.legacyProvider),
    vscode.debug.onDidStartDebugSession(session => { control.started(session); void native.started(session); void dashboard.started(session); }),
    vscode.debug.onDidTerminateDebugSession(session => { control.terminated(session); native.terminated(session); void dashboard.terminated(session); }),
    vscode.commands.registerCommand('snapkit.toggleDashboardTargets', async () => {
      const settings = vscode.workspace.getConfiguration('snapkit');
      const enabled = !settings.get('useDashboardTargets', true);
      await settings.update('useDashboardTargets', enabled, vscode.ConfigurationTarget.Global);
      void vscode.window.showInformationMessage(enabled ? 'Snapkit: Dashboard targets enabled when the local agent is available.' : 'Snapkit: Using normal IDE debug configurations.');
    }));
  output.appendLine('Snapkit Debug Sync 1.5.0 ready. Parallel launches begin before adapter initialization.');
}

module.exports = { activate, createRestartSync };
