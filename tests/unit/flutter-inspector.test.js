import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { IDESessions } from '../../apps/agent/src/modules/ide/ide-sessions.js';

const { createFlutterInspector, loopbackSocket } = createRequire(import.meta.url)('../../apps/ide-extension/flutter-inspector.cjs');

test('Flutter Inspector accepts only the local VM Service forwarded by the IDE', () => {
  assert.equal(loopbackSocket('http://127.0.0.1:61200/auth=/'), 'ws://127.0.0.1:61200/auth=/ws');
  assert.equal(loopbackSocket('ws://[::1]:61200/auth=/ws'), 'ws://[::1]:61200/auth=/ws');
  for (const url of ['ws://192.168.1.1:6000/ws', 'ws://127.0.0.1.example.com:6000/ws', 'http://localhost:6000/?url=ws://foo', 'http://user@localhost:6000/']) {
    assert.equal(loopbackSocket(url), null);
  }
});

test('selection reports the widget and project source, opens its exact position, and restores touch on close', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'snapkit-inspect-test-'));
  const source = join(await realpath(workspace), 'main.dart');
  await writeFile(source, '');
  const calls = [], opened = [];
  let notify;
  const vscode = {
    workspace: { isTrusted: true }, Uri: { file: value => value },
    SymbolKind: { Function: 1, Method: 2, Constructor: 3 },
    Position: class { constructor(line, column) { this.line = line; this.column = column; } },
    Range: class { constructor(start, end) { this.start = start; this.end = end; } },
    commands: { executeCommand: async () => [{ name: 'build', kind: 2, range: { contains: position => position.line === 20 } }] },
    window: { showTextDocument: async (...args) => opened.push(args) },
  };
  const inspector = createFlutterInspector(vscode, { transport(_url, listener) {
    notify = listener;
    return { async call(method, params) {
      calls.push([method, params]);
      if (method === 'getVM') return { isolates: [{ id: 'target' }] };
      if (method === 'getIsolate') return { extensionRPCs: ['ext.flutter.inspector.show'] };
      if (method.endsWith('.show')) return { enabled: params.enabled || 'false' };
      if (method.endsWith('.getSelectedWidget')) return { result: { description: 'RichText', creationLocation: { file: 'package:flutter/src/widgets/basic.dart', line: 2, column: 8 } } };
      if (method.endsWith('.getSelectedSummaryWidget')) return { result: { description: 'Text', creationLocation: { file: pathToFileURL(source).href, line: 21, column: 5 } } };
    }, close() {} };
  } });
  const session = { id: 'debug', type: 'dart', configuration: { cwd: workspace, flutterMode: 'debug' } };
  const registration = { event: 'dart.debuggerUris', body: { vmServiceUri: 'http://127.0.0.1:61200/auth=/' } };
  try {
    inspector.event({ ...session, id: 'profile', configuration: { flutterMode: 'profile' } }, registration);
    assert.equal(inspector.status({ ...session, id: 'profile' }), undefined);
    inspector.event(session, registration);
    await inspector.action(session, 'inspectUI');
    assert.equal(inspector.status(session).phase, 'waiting');
    notify({ kind: 'Inspect', isolate: { id: 'other' } });
    assert.equal(calls.some(([method]) => method.endsWith('.getSelectedWidget')), false);
    notify({ kind: 'Inspect', isolate: { id: 'target' } });
    for (let attempt = 0; !inspector.status(session).project?.enclosing && attempt < 50; attempt++) await delay(10);
    const result = inspector.status(session);
    assert.equal(result.widget.name, 'RichText');
    assert.deepEqual(result.project, { name: 'Text', file: 'main.dart', line: 21, column: 5, enclosing: 'build' });
    assert.equal(calls.filter(([method]) => method.endsWith('.disposeGroup')).length, 1);
    await inspector.action(session, 'openInspectedSource');
    assert.equal(opened[0][0], source);
    assert.equal(opened[0][1].selection.start.line, 20);
    assert.equal(opened[0][1].selection.start.column, 4);
    await inspector.action(session, 'closeInspector');
    assert.deepEqual(calls.filter(([method]) => method.endsWith('.show')).map(([, params]) => params.enabled), [undefined, 'true', 'false']);
    assert.equal(inspector.status(session).phase, 'idle');
  } finally { await inspector.dispose(); await rm(workspace, { force: true, recursive: true }); }
});

test('IDE bridge scopes inspector commands to one device/session and keeps source off the session list', () => {
  const bridge = new IDESessions();
  const report = { ownerId: 'ide1', sessions: [{ id: 'session1', deviceId: 'ios', workspace: '/project', name: 'Debug', inspection: { phase: 'selected', project: { name: 'Text', file: 'lib/main.dart', line: 4, column: 3 }, vmServiceUri: 'private' } }] };
  bridge.exchange(report);
  assert.deepEqual(bridge.list()[0], { id: 'session1', deviceId: 'ios', workspace: '/project', name: 'Debug', inspectable: true, stopping: false });
  assert.equal(bridge.inspect(['ios'], '/project', 'status').project.file, 'lib/main.dart');
  assert.equal(bridge.inspect(['ios'], '/project', 'status').vmServiceUri, undefined);
  assert.throws(() => bridge.inspect(['ios'], '/other', 'inspectUI'), /No inspectable/);
  assert.throws(() => bridge.inspect(['android'], '/project', 'inspectUI'), /No inspectable/);
  assert.throws(() => bridge.inspect(['ios'], '/project', 'openInspectedSource', 'old-session'), /No inspectable/);
  bridge.inspect(['ios'], '/project', 'openInspectedSource', 'session1');
  const { actions } = bridge.exchange(report);
  assert.deepEqual(actions.map(({ command, sessionId }) => ({ command, sessionId })), [{ command: 'openInspectedSource', sessionId: 'session1' }]);
});
