'use strict';

function createRestartSync({ enabled, report, onReady = () => {} }) {
  const sessions = new Map();
  let pending = null;

  function createDebugAdapterTracker(session) {
    const state = { session, ready: false };
    sessions.set(session.id, state);
    return {
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
  const sync = createRestartSync({
    enabled: session => vscode.workspace.getConfiguration('snapkit', session.workspaceFolder?.uri)
      .get('syncFlutterRestart', true),
    report: (message, failed) => {
      output.appendLine(`${new Date().toISOString()} ${message}`);
      if (failed) void vscode.window.showWarningMessage(`Snapkit: ${message}`);
    },
    onReady: session => dashboard.ready(session),
  });
  context.subscriptions.push(output, dashboard,
    vscode.debug.registerDebugAdapterTrackerFactory('dart', sync),
    vscode.debug.registerDebugConfigurationProvider('dart', dashboard.provider),
    vscode.debug.onDidStartDebugSession(session => dashboard.started(session)),
    vscode.debug.onDidTerminateDebugSession(session => { void dashboard.terminated(session); }),
    vscode.commands.registerCommand('snapkit.toggleDashboardTargets', async () => {
      const settings = vscode.workspace.getConfiguration('snapkit');
      const enabled = !settings.get('useDashboardTargets', true);
      await settings.update('useDashboardTargets', enabled, vscode.ConfigurationTarget.Global);
      void vscode.window.showInformationMessage(enabled ? 'Snapkit: Dashboard targets enabled when the local agent is available.' : 'Snapkit: Using normal IDE debug configurations.');
    }));
  output.appendLine('Ready. The Restart button synchronizes running Flutter sessions.');
}

module.exports = { activate, createRestartSync };
