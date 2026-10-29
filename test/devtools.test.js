import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { DevTools } from '../server/devtools.js';
import { Sessions } from '../server/sessions.js';

function fakeProcess() {
  const child = new EventEmitter();
  child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
  child.kill = () => { child.emit('close', 0); return true; };
  return child;
}
test('sessions capture split debugPort events without putting VM credentials in public state or logs', () => {
  const child = fakeProcess();
  const sessions = new Sessions(() => child);
  sessions.start({ id: 'sim', name: 'iPhone' }, '/tmp');
  child.stdout.write('[{"event":"app.start","params":{"appId":"one"}},{"event":"app.debug');
  child.stdout.write('Port","params":{"appId":"one","wsUri":"ws://127.0.0.1:1234/private-token=/ws"}},{"event":"app.started"}]\n');
  assert.equal(sessions.list()[0].devtoolsReady, true);
  assert.equal(sessions.vmService('sim'), 'ws://127.0.0.1:1234/private-token=/ws');
  assert.equal(JSON.stringify(sessions.list()).includes('private-token'), false);
  assert.equal(JSON.stringify(sessions.logs).includes('private-token'), false);
  child.stdout.write('[{"event":"app.debugPort","params":{"appId":"other","wsUri":"ws://127.0.0.1:5678/wrong"}}]\n');
  assert.ok(sessions.vmService('sim').includes('1234'));
  child.kill();
  assert.equal(sessions.list()[0].devtoolsReady, false);
  assert.throws(() => sessions.vmService('sim'), /Wait for/);
});
test('remote VM services cannot make a session DevTools ready', () => {
  const child = fakeProcess(); const sessions = new Sessions(() => child);
  sessions.start({ id: 'sim' }, '/tmp');
  child.stdout.write('[{"event":"app.debugPort","params":{"wsUri":"ws://example.com:1234/ws"}},{"event":"app.started"}]\n');
  assert.equal(sessions.list()[0].devtoolsReady, false);
  child.kill();
});
test('DevTools serializes server startup, connects the chosen app and screen, and restarts after exit', async () => {
  const children = []; let command;
  const tools = new DevTools((name, args) => { command = { name, args }; const c = fakeProcess(); children.push(c); return c; });
  const first = tools.open('ws://127.0.0.1:1234/secret=/ws', 'inspector');
  const second = tools.open('ws://127.0.0.1:2345/other=/ws', 'network');
  assert.equal(children.length, 1);
  assert.equal(command.name, 'dart');
  assert.ok(command.args.includes('--host=127.0.0.1'));
  children[0].stdout.write('{"event":"server.st');
  children[0].stdout.write('arted","params":{"host":"127.0.0.1","port":9100}}\n');
  const a = new URL(await first), b = new URL(await second);
  assert.equal(a.origin, 'http://127.0.0.1:9100'); assert.equal(a.searchParams.get('page'), 'inspector');
  assert.equal(a.searchParams.get('uri'), 'ws://127.0.0.1:1234/secret=/ws');
  assert.equal(b.searchParams.get('page'), 'network'); assert.equal(b.searchParams.get('uri'), 'ws://127.0.0.1:2345/other=/ws');
  children[0].kill();
  const restarted = tools.open('http://127.0.0.1:1234/auth=/', 'memory');
  assert.equal(children.length, 2);
  children[1].stdout.write('{"event":"server.started","params":{"host":"127.0.0.1","port":9200}}\n');
  assert.equal(new URL(await restarted).port, '9200');
  tools.close();
  await assert.rejects(tools.start(), /shutting down/);
});
test('DevTools rejects hostile service URLs and invalid screens before spawning a process', async () => {
  const tools = new DevTools(() => { throw new Error('Must not spawn'); });
  for (const uri of ['http://example.com:1234/', 'http://127.0.0.1.example.com:1234/', 'file:///tmp/vm', 'http://user:pass@127.0.0.1:1234/']) await assert.rejects(tools.open(uri), /local VM/);
  await assert.rejects(tools.open('ws://127.0.0.1:1234/ws', 'unknown'), /Unknown/);
});
test('DevTools startup failures and timeouts release the pending request for retry', async () => {
  const child = fakeProcess(); const tools = new DevTools(() => child, 5);
  await assert.rejects(tools.start(), /timed out/);
  assert.equal(tools.pending, null);
  const pending = tools.start();
  child.stdout.write('{"event":"server.started","params":{"host":"0.0.0.0","port":9100}}\n');
  await assert.rejects(pending, /invalid local/);
  tools.close();
});
