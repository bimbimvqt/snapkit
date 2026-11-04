import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { shutdownDevice } from '../../apps/agent/src/modules/devices/device-control.js';
import { deviceStatus } from '../../apps/agent/src/modules/devices/device-status.js';
import { IDESessions } from '../../apps/agent/src/modules/ide/ide-sessions.js';
const { createSessionControl, agentRequest } = createRequire(import.meta.url)('../../apps/ide-extension/session-control.cjs');

test('fast lifecycle probes detect simulator shutdown without Flutter and preserve state on failure', async () => {
  const devices = [{ id: 'ios', group: 'ios', platform: 'ios', state: 'online', flutterId: 'ios' }, { id: 'avd:Pixel', avd: 'Pixel', group: 'android', platform: 'android', flutterId: 'emulator-5554' }];
  const calls = [];
  const updates = await deviceStatus(devices, { platform: 'darwin', execute: async (name, args) => {
    calls.push(name);
    if (name === 'xcrun') return JSON.stringify({ devices: { runtime: [{ udid: 'ios', state: 'Shutdown' }] } });
    if (args[0] === 'devices') return 'List of devices attached\nemulator-5556\tdevice\n';
    return 'Pixel\nOK';
  } });
  assert.deepEqual(updates.get('ios'), { state: 'offline', flutterId: undefined });
  assert.equal(updates.get('avd:Pixel').flutterId, 'emulator-5556');
  assert.ok(!calls.includes('flutter'));
  assert.equal((await deviceStatus(devices, { platform: 'darwin', execute: async () => { throw Error('unavailable'); } })).size, 0);
});

test('shutdown targets one simulator or verified AVD and never deletes data or powers off a phone', async () => {
  const calls = [], id = '12345678-1234-1234-1234-123456789012';
  const execute = async (name, args) => {
    calls.push([name, args]);
    if (name === 'xcrun' && args.includes('list')) return JSON.stringify({ devices: { runtime: [{ udid: id, state: 'Booted' }] } });
    if (args[0] === 'devices') return 'List of devices attached\nemulator-5554\tdevice\nemulator-5556\tdevice\nphone\tdevice\n';
    if (args.at(-1) === 'name') return args[1] === 'emulator-5554' ? 'Other\nOK' : 'Pixel\nOK';
    return '';
  };
  await shutdownDevice({ id, group: 'ios', platform: 'ios' }, { execute });
  assert.deepEqual(calls.at(-1), ['xcrun', ['simctl', 'shutdown', id]]);
  await shutdownDevice({ id: 'avd:Pixel', avd: 'Pixel', group: 'android', platform: 'android' }, { execute });
  assert.deepEqual(calls.filter(c => c[1].includes('kill')), [['adb', ['-s', 'emulator-5556', 'emu', 'kill']]]);
  await assert.rejects(shutdownDevice({ id: 'phone', group: 'physical', platform: 'android' }, { execute }), /Only simulators/);
  assert.ok(!calls.some(c => c[1].includes('delete')));
});

test('IDE stop commands stay with their owner, repeat until terminated, and expire with disconnected owners', () => {
  let now = 0;
  const registry = new IDESessions({ now: () => now });
  registry.exchange({ ownerId: 'ide1', sessions: [{ id: 's1', deviceId: 'one', name: 'First' }] });
  registry.exchange({ ownerId: 'ide2', sessions: [{ id: 's2', deviceId: 'two', name: 'Second' }] });
  assert.equal(registry.requestStop(['one']), 1);
  assert.deepEqual(registry.exchange({ ownerId: 'ide2', sessions: [{ id: 's2', deviceId: 'two', name: 'Second' }] }).stopSessionIds, []);
  assert.deepEqual(registry.exchange({ ownerId: 'ide1', sessions: [{ id: 's1', deviceId: 'one', name: 'First' }] }).stopSessionIds, ['s1']);
  registry.exchange({ ownerId: 'ide1', sessions: [] });
  assert.equal(registry.list().length, 1);
  now = 10001;
  assert.deepEqual(registry.list(), []);
  assert.equal(registry.requestStop(['two']), 0);
});

test('extension bridge authenticates reports and stops only the requested session, tolerating agent loss', async () => {
  let stopped = [], sent = [], commands = ['s1'], offline = false;
  const vscode = { workspace: { isTrusted: true, getConfiguration: () => ({ get: (_key, fallback) => fallback }) }, debug: { stopDebugging: async session => { stopped.push(session.id); } } };
  const control = createSessionControl(vscode, { request: async (_base, route, body, token) => {
    if (offline) throw Error('offline');
    if (route === '/api/state') return { token: 'local-token' };
    assert.equal(token, 'local-token'); sent.push(body.sessions);
    return { stopSessionIds: commands };
  } });
  const session = id => ({ id, name: id, type: 'dart', configuration: { deviceId: id } });
  try {
    control.started(session('s1')); control.started(session('s2'));
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(stopped.includes('s1')); assert.ok(!stopped.includes('s2'));
    commands = []; control.terminated(session('s1'));
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(sent.at(-1).map(s => s.id), ['s2']);
    offline = true; await control.tick();
    assert.ok(!stopped.includes('s2'));
    await assert.rejects(agentRequest('https://external.example/', '/api/state'), /loopback/);
  } finally { control.dispose(); }
});
