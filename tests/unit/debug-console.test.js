import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { DebugConsole } from '../../apps/agent/src/modules/ide/debug-console.js';
const { createSessionControl } = createRequire(import.meta.url)('../../apps/ide-extension/session-control.cjs');
const session = { id: 'debug1', deviceId: 'device1', name: 'Dev', workspace: '/project/one' };
const entry = (sequence, text, sessionId = session.id) => ({ sequence, text, sessionId, category: 'stdout' });

test('Debug Console scopes output to project/device, deduplicates retries and bounds retained output', () => {
  const console = new DebugConsole();
  assert.equal(console.exchange('ide1', [entry(1, 'hello'), entry(2, ' world\n')], [session]), 2);
  console.exchange('ide1', [entry(1, 'hello'), entry(2, ' world\n')], [session]);
  assert.equal(console.read('/project/one', 'device1').lines.map(line => line.text).join(''), 'hello world\n');
  assert.deepEqual(console.read('/project/two', '').lines, []);
  assert.deepEqual(console.read('/project/one', 'device2').lines, []);
  console.exchange('ide2', [entry(1, 'unknown', 'unregistered')], [session]);
  assert.equal(console.read('/project/one', '').lines.length, 2);
  for (let i = 3; i < 1100; i++) console.exchange('ide1', [entry(i, `line ${i}\n`)], [session]);
  assert.equal(console.read('/project/one', '').lines.length, 1000);
  assert.equal(console.read('/project/one', '', console.next - 2).lines.length, 1);
  assert.throws(() => console.exchange('ide1', [entry(1101, 'x'.repeat(2049))], [session]), /Invalid/);
  assert.throws(() => console.exchange('ide1', [{...entry(1101, 'secret'),category:'telemetry'}], [session]), /Invalid/);
});

test('extension mirrors only trusted debug output and flushes final output after session ends', async () => {
  const sent = [];
  let offline = false;
  const vscode = { workspace: { isTrusted: true, workspaceFolders: [{uri:{fsPath:process.cwd()}}], getConfiguration: () => ({get: (_key, fallback) => fallback}) }, debug: {} };
  const control = createSessionControl(vscode, {request: async (_base, path, body) => {
    if (offline) throw Error('offline');
    if (path === '/api/state') return {token:'local'};
    sent.push(body);
    return { consoleAck: body.consoleOutput.at(-1)?.sequence || 0 };
  }});
  const debug = {id:'debug1',type:'dart',name:'Dev',workspaceFolder:{uri:{fsPath:process.cwd()}},configuration:{deviceId:'device1'}};
  const tracker = control.createDebugAdapterTracker(debug);
  const flush = async () => { await new Promise(resolve => setTimeout(resolve, 25)); await control.tick(); await new Promise(resolve => setTimeout(resolve, 25)); };
  const emit = (output, category='stdout') => tracker.onDidSendMessage({type:'event',event:'output',body:{output,category}});
  try {
    emit('before start'); tracker.onWillStartSession(); await flush();
    emit('private metric', 'telemetry');
    vscode.workspace.isTrusted = false; emit('untrusted'); vscode.workspace.isTrusted = true;
    offline = true; emit('print: hello\n'); await flush();
    offline = false; control.terminated(debug); await flush();
    const batch = sent.find(body => body.consoleOutput.length);
    assert.ok(batch); assert.equal(batch.consoleOutput.map(entry=>entry.text).join(''), 'print: hello\n');
    assert.deepEqual(batch.sessions, []); assert.equal(batch.consoleSessions[0].id, 'debug1');
    await flush(); assert.equal(sent.at(-1).consoleOutput.length, 0);
    const noDebug = {...debug,id:'no-debug',configuration:{deviceId:'device1',noDebug:true}};
    const ignored = control.createDebugAdapterTracker(noDebug); ignored.onWillStartSession();
    ignored.onDidSendMessage({type:'event',event:'output',body:{output:'ignored'}});
    await flush(); assert.equal(sent.at(-1).consoleOutput.length, 0);
  } finally { control.dispose(); }
});
