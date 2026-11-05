import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { mergeDevices, parseIni } from '../../apps/agent/src/domain/device-catalog.js';
import { parseJsonOutput } from '../../apps/agent/src/infrastructure/process/cli.js';
import { launchPlan, stripLegacyTargets, validateWorkspace, validateBuild, workspaceProfiles } from '../../apps/agent/src/modules/workspace/workspace.js';
import { deleteDevice } from '../../apps/agent/src/modules/devices/device-control.js';
import { createRequire } from 'node:module';
const { createRestartSync } = createRequire(import.meta.url)('../../apps/ide-extension/extension.cjs');
const { createDashboardDebug } = createRequire(import.meta.url)('../../apps/ide-extension/dashboard-debug.cjs');

test('native IDE debugging falls back unchanged offline and launches Dashboard groups only for the matching enabled workspace', async () => {
  const root = path.resolve('flutter-project');
  const folder = { uri: { fsPath: root } };
  const original = { name: 'Native dev', type: 'dart', request: 'launch', program: 'lib/main.dart', args: ['--flavor', 'original'] };
  const before = JSON.stringify(original);
  const launches = [], stops = [], messages = [];
  let enabled = true, offline = false, project = root, status = 'ready', launchSuccess = true;
  const vscode = {
    workspace: { isTrusted: true, getConfiguration: () => ({ get: (name, fallback) => name === 'useDashboardTargets' ? enabled : fallback }) },
    window: { showErrorMessage: s => messages.push(s), showWarningMessage: s => messages.push(s) },
    debug: { startDebugging: async (f, c) => { launches.push(c); return launchSuccess; }, stopDebugging: async s => stops.push(s.id) },
  };
  const plan = () => ({ protocol: 1, status, workspace: project, configurations: [1, 2, 3].map(id => ({
    name: `Device ${id}`, type: 'dart', request: 'launch', flutterMode: 'debug', deviceId: String(id), cwd: root,
    program: path.join(root, 'lib/main_dev.dart'), toolArgs: ['--flavor', 'dev'],
  })) });
  const sync = createDashboardDebug(vscode, { canonical: async p => p, flutterProject: async () => true, readPlan: async () => {
    if (offline) throw Error('Connection refused');
    return plan();
  } });
  const resolve = c => sync.provider.resolveDebugConfiguration(folder, c);
  try {
    offline = true;
    assert.equal(await resolve(original), original);
    offline = false; enabled = false;
    assert.equal(await resolve(original), original);
    enabled = true; project = path.resolve('different-project');
    assert.equal(await resolve(original), original);
    project = root; status = 'inactive';
    assert.equal(await resolve(original), original);
    status = 'ready';
    for (const extra of [{ request: 'attach' }, { flutterMode: 'profile' }, { noDebug: true }, { program: 'test/widget_test.dart' }]) {
      const config = { ...original, ...extra };
      assert.equal(await resolve(config), config);
    }
    status = 'invalid';
    assert.equal(await resolve(original), undefined);
    assert.equal(launches.length, 0);
    status = 'ready';
    const first = await resolve(original);
    assert.equal(first.deviceId, '1');
    assert.equal(first.program, path.join(root, 'lib/main_dev.dart'));
    assert.deepEqual(first.args, []);
    assert.equal(JSON.stringify(original), before);
    const source = { id: 'source', configuration: first };
    await sync.started(source);
    assert.equal(await resolve(original), undefined, 'Prevent duplicate Dashboard groups');
    assert.equal(launches.length, 2, 'Both peers launch before any app is ready');
    assert.equal(launches[0].deviceId, '2');
    assert.equal(await resolve(launches[0]), launches[0], 'Peer bypasses the resolver fan-out');
    const peer = { id: 'peer', configuration: launches[0] };
    await sync.started(peer);
    assert.equal(launches.length, 2, 'Peer start does not launch duplicates');
    assert.equal(launches[1].deviceId, '3');
    const last = { id: 'last', configuration: launches[1] };
    await sync.started(last);
    await sync.terminated(peer);
    assert.deepEqual(stops, [], 'Stopping one device keeps peer sessions alive');
    await sync.terminated(source);
    await sync.terminated(last);
    const canceledPeer = { id: 'late', configuration: launches[1] };
    await sync.started(canceledPeer);
    assert(stops.includes('late'), 'Cancel a peer that started after its group stopped');
    assert.equal(await resolve(launches[0]), undefined, 'A canceled group cannot launch more peers');
    launches.length = 0; stops.length = 0; launchSuccess = false;
    const next = { id: 'next', configuration: await resolve(original) };
    await sync.started(next);
    assert(stops.includes('next'));
    assert(messages.some(message => message.includes('group has been stopped')));
  } finally { sync.dispose(); }
});

test('Dashboard launches all peers while earlier launches are pending and stops late sessions after failure', async () => {
  const root = path.resolve('flutter-project');
  const launches = [], stops = [], pending = [];
  const vscode = {
    workspace: { isTrusted: true, getConfiguration: () => ({ get: (_name, fallback) => fallback }) },
    window: { showErrorMessage() {}, showWarningMessage() {} },
    debug: {
      startDebugging: (_folder, config) => {
        launches.push(config);
        return new Promise(resolve => pending.push(resolve));
      },
      stopDebugging: async session => { stops.push(session.id); },
    },
  };
  const sync = createDashboardDebug(vscode, {
    canonical: async value => value, flutterProject: async () => true,
    readPlan: async () => ({ protocol: 1, status: 'ready', workspace: root,
      configurations: [1, 2, 3].map(id => ({ name: `Device ${id}`, type: 'dart', request: 'launch',
        flutterMode: 'debug', cwd: root, program: path.join(root, 'lib/main.dart'), deviceId: String(id), toolArgs: [] })) }),
  });
  try {
    const config = await sync.provider.resolveDebugConfiguration({ uri: { fsPath: root } }, { type: 'dart' });
    let launching;
    const tracker = createRestartSync({ enabled: () => true, report() {},
      onStarting: session => { launching = sync.started(session); },
    }).createDebugAdapterTracker({ id: 'first', configuration: config });
    assert.equal(launches.length, 0);
    tracker.onWillStartSession();
    assert.equal(launches.length, 2, 'Both peers start before either launch promise resolves');
    await sync.started({ id: 'second', configuration: launches[0] });
    assert.equal(launches.length, 2, 'Peer events cannot repeat the fan-out');
    pending[0](false);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(stops.sort(), ['first', 'second']);
    await sync.started({ id: 'late-third', configuration: launches[1] });
    assert(stops.includes('late-third'));
    pending[1](true);
    await launching;
  } finally { sync.dispose(); }
});

test('device deletion uses native CLI, stops the specific emulator, and never erases physical devices or shared runtimes', async () => {
  const id = '00000000-0000-0000-0000-000000000001';
  const ios = { id, name: 'Disposable simulator', platform: 'ios', group: 'ios' };
  const calls = [];
  const execute = async (tool, args) => {
    calls.push([tool, args]);
    if (args.includes('--json')) return JSON.stringify({ devices: { runtime: [{ udid: id, state: 'Booted' }] } });
    return '';
  };
  await deleteDevice(ios, { execute });
  assert.deepEqual(calls.slice(1), [['xcrun', ['simctl', 'shutdown', id]], ['xcrun', ['simctl', 'delete', id]]]);
  calls.length = 0;
  await assert.rejects(deleteDevice({ ...ios, group: 'physical' }, { execute }), /Physical devices/);
  await assert.rejects(deleteDevice({ ...ios, id: '--all' }, { execute }), /Only registered/);
  assert.equal(calls.length, 0);

  let stopped = false;
  const android = { id: 'avd:My_AVD', name: 'My AVD', avd: 'My_AVD', platform: 'android', group: 'android', state: 'offline' };
  await deleteDevice(android, { sleep: async () => {}, execute: async (tool, args) => {
    calls.push([tool, args]);
    if (args[0] === 'devices') return `List of devices attached\nemulator-5554\tdevice\n${stopped ? '' : 'emulator-5556\tdevice\n'}physical\tdevice\n`;
    if (args.at(-1) === 'name') return args[1] === 'emulator-5554' ? 'Other_AVD\nOK' : 'My_AVD\nOK';
    if (args.at(-1) === 'kill') stopped = true;
    return '';
  } });
  assert.ok(calls.some(([tool, args]) => tool === 'adb' && args.join(' ') === '-s emulator-5556 emu kill'));
  assert.ok(!calls.some(([, args]) => args.join(' ') === '-s emulator-5554 emu kill'));
  assert.deepEqual(calls.at(-1), ['avdmanager', ['delete', 'avd', '-n', 'My_AVD']]);
  calls.length = 0;
  await assert.rejects(deleteDevice(android, { sleep: async () => {}, execute: async (tool, args) => {
    calls.push([tool, args]);
    if (args[0] === 'devices') return 'emulator-5556\tdevice\n';
    if (args.at(-1) === 'name') return 'My_AVD\nOK';
    return '';
  } }), /still running/);
  assert.ok(!calls.some(([tool]) => tool === 'avdmanager'));
});

test('discovery merges AVD identity and keeps physical devices separate', () => {
  const result = mergeDevices([
    { id: 'emulator-5554', name: 'sdk phone', emulator: true, targetPlatform: 'android-arm64' },
    { id: 'physical-1', name: 'My Pixel', emulator: false, targetPlatform: 'android-arm64' },
    { id: 'sim-1', name: 'iPhone', emulator: true, targetPlatform: 'ios' },
    { id: 'chrome', name: 'Chrome', targetPlatform: 'web-javascript' }
  ], { devices: { 'com.apple.CoreSimulator.SimRuntime.iOS-18-2': [{ udid: 'sim-1', name: 'iPhone', state: 'Booted', isAvailable: true }, { udid: 'gone', isAvailable: false }] } }, [{ id: 'Pixel_API_35', name: 'Pixel' }], { 'emulator-5554': 'Pixel_API_35' });
  assert.equal(result.length, 3);
  assert.equal(result.find(d => d.avd).flutterId, 'emulator-5554');
  assert.equal(result.find(d => d.id === 'physical-1').group, 'physical');
  assert.equal(result.find(d => d.id === 'sim-1').os, 'iOS 18.2');
});
test('CLI parsing accepts startup notices and INI values containing equals', () => {
  assert.deepEqual(parseJsonOutput('Flutter startup notice\n[{"id":"test"}]\n'), [{ id: 'test' }]);
  assert.equal(parseIni('# ignore\n hw.ramSize = 4096\npath=a=b')['path'], 'a=b');
  assert.throws(() => parseJsonOutput('not JSON'));
});
test('IDE plans stay in memory and legacy cleanup preserves native JSONC profiles', async () => {
  const original = '// keep comment\n{"configurations": [{"name":"Custom","type":"dart","request":"launch",}],"compounds":[{"name":"Custom group","configurations":["Custom"]}],}';
  assert.equal(stripLegacyTargets(original), original);
  const { parse } = await import('jsonc-parser');
  const legacy = '// keep comment\n' + JSON.stringify({ configurations: [
    { name: 'Snapkit: Device · Old iPhone', deviceId: 'old' },
    { name: 'Custom', type: 'dart', request: 'launch' },
  ], compounds: [{ name: 'Snapkit: Selected Devices' }, { name: 'Custom group', configurations: ['Custom'] }] });
  const cleaned = stripLegacyTargets(legacy);
  assert(cleaned.includes('// keep comment'));
  assert.deepEqual(parse(cleaned), parse(original));
  assert.throws(() => stripLegacyTargets('bad JSON'), /preserved/);
  assert.throws(() => stripLegacyTargets('{"compounds":{}}'), /array/);
  const root = path.resolve('in-memory-project');
  const devices = [{ id: 'ios', name: 'iPhone', state: 'online', flutterId: 'ios-serial' }, { id: 'avd', name: 'Android', state: 'online', flutterId: 'emulator-5554' }];
  const settings = { workspace: root, targetIds: ['ios', 'avd'], flavor: 'dev', target: 'lib/main_dev.dart', defineFile: '../defines.json' };
  const plan = launchPlan(settings, devices);
  assert.equal(plan.status, 'ready');
  assert.deepEqual(plan.configurations.map(c => c.deviceId), ['ios-serial', 'emulator-5554']);
  assert.equal(plan.configurations[0].program, path.join(root, 'lib/main_dev.dart'));
  assert.deepEqual(plan.configurations[0].toolArgs, ['--flavor', 'dev', '--dart-define-from-file', path.resolve(root, '../defines.json')]);
  assert.equal(launchPlan({ ...settings, ideEnabled: false }, devices).status, 'inactive');
  assert.equal(launchPlan({ ...settings, targetIds: [] }, devices).status, 'inactive');
  assert.equal(launchPlan(settings, devices.slice(0, 1)).status, 'invalid');
  assert.equal(launchPlan(settings, devices.map(d => ({ ...d, state: 'offline' }))).status, 'invalid');
});

test('IDE profile import retains flavor, entrypoint and defines path and validates existing files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'snapkit-flavors-'));
  try {
    await writeFile(path.join(root, 'pubspec.yaml'), 'dependencies:\n  flutter:\n    sdk: flutter\n');
    await mkdir(path.join(root, 'lib')); await mkdir(path.join(root, '.vscode'));
    await writeFile(path.join(root, 'lib/main_dev.dart'), 'void main() {}');
    await writeFile(path.join(root, 'defines.json'), '{}');
    await writeFile(path.join(root, '.vscode/launch.json'), JSON.stringify({ configurations: [
      { name: 'Development', type: 'dart', request: 'launch', program: 'lib/main_dev.dart', args: ['--flavor', 'dev', '--dart-define-from-file=${workspaceFolder}/defines.json'] },
      { name: 'Profile', type: 'dart', request: 'launch', flutterMode: 'profile', args: ['--flavor', 'prod'] }
    ] }));
    const catalog = await workspaceProfiles(root);
    assert.deepEqual(catalog.flavors, ['dev']); assert.equal(catalog.profiles.length, 1);
    assert.equal(catalog.profiles[0].defineFile, path.join(root, 'defines.json'));
    const options = await validateBuild(root, catalog.profiles[0]);
    assert.equal(options.flavor, 'dev'); assert.equal(options.target, 'lib/main_dev.dart');
    await assert.rejects(validateBuild(root, { target: 'lib/main_dev.dart' }), /Choose a flavor/);
    await assert.rejects(validateBuild(root, { flavor: '--release', target: 'lib/main_dev.dart' }), /flavor name/);
    await assert.rejects(validateBuild(root, { flavor: 'dev', target: '../outside.dart' }), /entrypoint/);
    await assert.rejects(validateBuild(root, { ...options, defineFile: 'missing.json' }), /defines file/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
