import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { mergeDevices, parseIni } from '../server/discovery.js';
import { parseJsonOutput } from '../server/cli.js';
import { writeLaunch, validateWorkspace } from '../server/workspace.js';
import { Sessions } from '../server/sessions.js';

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
test('workspace validation and launch update preserve configurations and backup', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'snapkit-test-'));
  try {
    await assert.rejects(validateWorkspace(root), /pubspec/);
    await writeFile(path.join(root, 'pubspec.yaml'), 'name: example\ndependencies:\n  flutter:\n    sdk: flutter\n');
    assert.equal(await validateWorkspace(root), await import('node:fs/promises').then(fs => fs.realpath(root)));
    await mkdir(path.join(root, '.vscode'));
    const file = path.join(root, '.vscode/launch.json');
    const original = JSON.stringify({ version: '0.2.0', configurations: [{ name: 'Custom', type: 'dart' }] });
    await writeFile(file, original);
    await writeLaunch(root, { id: 'avd:Pixel', flutterId: 'emulator-5554' });
    const config = JSON.parse(await readFile(file, 'utf8'));
    assert.equal(config.configurations.length, 2);
    assert.equal(config.configurations[0].deviceId, 'emulator-5554');
    assert.equal(config.configurations[1].name, 'Custom');
    assert.equal(await readFile(`${file}.snapkit.bak`, 'utf8'), original);
    await writeFile(file, '// custom comment\n{"configurations": [{"name":"Custom",}],}');
    await writeLaunch(root, { id: 'test' });
    const jsonc = await readFile(file, 'utf8');
    assert.ok(jsonc.includes('// custom comment'));
    assert.ok(jsonc.includes('Custom'));
    await writeFile(file, 'invalid JSON');
    await assert.rejects(writeLaunch(root, { id: 'test' }), /preserved/);
    assert.equal(await readFile(file, 'utf8'), 'invalid JSON');
  } finally { await rm(root, { recursive: true, force: true }); }
});
function fakeProcess() {
  const child = new EventEmitter();
  child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough(); child.kill = () => child.emit('close', 0);
  return child;
}
test('Flutter machine RPC handles split lines, reload, restart, and errors', async () => {
  const child = fakeProcess(); const manager = new Sessions(() => child);
  manager.start({ id: 'device', flutterId: 'serial', name: 'Pixel' }, '/tmp');
  child.stdout.write('[{"event":"app.start","params":{"appId":"app-1"}}]\n[{"event":"app.st');
  child.stdout.write('arted","params":{"appId":"app-1"}}]\n');
  assert.equal(manager.list()[0].status, 'running');
  const request = manager.action('device', 'reload');
  const msg = JSON.parse(child.stdin.read().toString())[0];
  assert.equal(msg.method, 'app.restart'); assert.equal(msg.params.fullRestart, false); assert.equal(msg.params.appId, 'app-1');
  child.stdout.write(JSON.stringify([{ id: msg.id, result: { code: 0 } }]) + '\n'); await request;
  const restart = manager.action('device', 'restart');
  const msg2 = JSON.parse(child.stdin.read().toString())[0]; assert.equal(msg2.params.fullRestart, true);
  child.stdout.write(JSON.stringify([{ id: msg2.id, error: 'compile failed' }]) + '\n');
  await assert.rejects(restart, /compile failed/);
  child.kill(); assert.equal(manager.list()[0].status, 'stopped');
});
test('multicast reports each device failure without losing successful results', async () => {
  const manager = new Sessions();
  manager.items.set('one', { deviceId: 'one', status: 'running' });
  manager.items.set('two', { deviceId: 'two', status: 'running' });
  manager.items.set('three', { deviceId: 'three', status: 'starting' });
  manager.action = async id => { if (id === 'two') throw new Error('compile failed'); };
  assert.deepEqual(await manager.reloadAll(), [{ deviceId: 'one', ok: true }, { deviceId: 'two', ok: false, error: 'compile failed' }]);
});

test('workspace profiles retain dev entrypoint and defines path; Flutter and VS Code use the same flavor', async () => {
  const { workspaceProfiles, validateBuild } = await import('../server/workspace.js');
  const root = await mkdtemp(path.join(os.tmpdir(), 'snapkit-flavors-'));
  try {
    await mkdir(path.join(root, 'lib'));
    await mkdir(path.join(root, '.vscode'));
    await writeFile(path.join(root, 'lib/main_dev.dart'), 'void main() {}');
    await writeFile(path.join(root, 'defines.json'), '{}');
    await writeFile(path.join(root, '.vscode/launch.json'), JSON.stringify({ configurations: [
      { name: 'Development', type: 'dart', request: 'launch', program: 'lib/main_dev.dart', args: ['--flavor', 'dev', '--dart-define-from-file=${workspaceFolder}/defines.json'] },
      { name: 'Profile', type: 'dart', request: 'launch', flutterMode: 'profile', args: ['--flavor', 'prod'] }
    ] }));
    const catalog = await workspaceProfiles(root);
    assert.deepEqual(catalog.flavors, ['dev']);
    assert.equal(catalog.profiles.length, 1);
    assert.equal(catalog.profiles[0].defineFile, path.join(root, 'defines.json'));
    await assert.rejects(validateBuild(root, { target: 'lib/main_dev.dart' }), /Choose a flavor/);
    await assert.rejects(validateBuild(root, { flavor: '--release', target: 'lib/main_dev.dart' }), /flavor name/);
    await assert.rejects(validateBuild(root, { flavor: 'dev', target: '../outside.dart' }), /entrypoint/);
    await assert.rejects(validateBuild(root, { flavor: 'dev', target: 'lib/main_dev.dart', defineFile: 'missing.json' }), /defines file/);
    const options = await validateBuild(root, catalog.profiles[0]);
    let command;
    const child = fakeProcess();
    const manager = new Sessions((name, args, spawnOptions) => { command = { name, args, spawnOptions }; return child; });
    manager.start({ id: 'sim', name: 'iPhone' }, root, options);
    assert.deepEqual(command.args, ['run', '--machine', '-d', 'sim', '--flavor', 'dev', '--target', 'lib/main_dev.dart', '--dart-define-from-file', path.join(root, 'defines.json')]);
    assert.equal(command.spawnOptions.cwd, root);
    await writeLaunch(root, { id: 'sim' }, options);
    const launch = JSON.parse(await readFile(path.join(root, '.vscode/launch.json'), 'utf8'));
    assert.equal(launch.configurations[0].program, 'lib/main_dev.dart');
    assert.deepEqual(launch.configurations[0].toolArgs, ['--flavor', 'dev', '--dart-define-from-file', path.join(root, 'defines.json')]);
    assert.equal(launch.configurations[1].name, 'Development');
    child.kill();
  } finally { await rm(root, { recursive: true, force: true }); }
});
