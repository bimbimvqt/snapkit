import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { mergeDevices, parseIni } from '../server/discovery.js';
import { parseJsonOutput } from '../server/cli.js';
import { writeTargets, validateWorkspace, validateBuild, workspaceProfiles } from '../server/workspace.js';

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
test('IDE target updates preserve JSONC profiles and compounds across two, one and zero selected devices', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'snapkit-test-'));
  try {
    await assert.rejects(validateWorkspace(root), /pubspec/);
    await writeFile(path.join(root, 'pubspec.yaml'), 'name: example\ndependencies:\n  flutter:\n    sdk: flutter\n');
    await validateWorkspace(root);
    await mkdir(path.join(root, '.vscode'));
    const file = path.join(root, '.vscode/launch.json');
    const original = '// keep comment\n{"configurations": [{"name":"Custom","type":"dart","request":"launch",}],"compounds":[{"name":"Custom group","configurations":["Custom"]}],}';
    await writeFile(file, original);
    const devices = [{ id: 'sim', name: 'iPhone', flutterId: 'sim-serial' }, { id: 'android', name: 'Pixel', flutterId: 'emulator-5554' }];
    const build = { flavor: 'dev', target: 'lib/main_dev.dart', defineFile: '../defines.dev.json' };
    const { parse } = await import('jsonc-parser');
    await writeTargets(root, devices, build);
    let raw = await readFile(file, 'utf8'), config = parse(raw);
    assert.ok(raw.includes('// keep comment'));
    assert.equal(await readFile(file + '.snapkit.bak', 'utf8'), original);
    assert.equal(config.configurations.length, 3);
    assert.deepEqual(config.configurations.slice(0, 2).map(c => c.deviceId), ['sim-serial', 'emulator-5554']);
    assert.deepEqual(config.configurations[0].toolArgs, ['--flavor', 'dev', '--dart-define-from-file', '../defines.dev.json']);
    assert.equal(config.configurations[0].program, 'lib/main_dev.dart');
    assert.equal(config.compounds[0].name, 'Snapkit: Selected Devices');
    assert.equal(config.compounds[0].stopAll, true);
    assert.deepEqual(config.compounds[0].configurations, config.configurations.slice(0, 2).map(c => c.name));
    assert.equal((await workspaceProfiles(root)).profiles.length, 1);
    await writeTargets(root, devices.slice(0, 1), build);
    config = parse(await readFile(file, 'utf8'));
    assert.equal(config.configurations.length, 2); assert.equal(config.compounds[0].configurations.length, 1);
    await writeTargets(root, [], build);
    config = parse(await readFile(file, 'utf8'));
    assert.deepEqual(config.configurations.map(c => c.name), ['Custom']);
    assert.deepEqual(config.compounds.map(c => c.name), ['Custom group']);
    await writeFile(file, 'invalid JSON');
    await assert.rejects(writeTargets(root, devices, build), /preserved/);
    assert.equal(await readFile(file, 'utf8'), 'invalid JSON');
    await writeFile(file, '{"compounds":{}}');
    await assert.rejects(writeTargets(root, devices, build), /compounds must be an array/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('IDE profile import retains flavor, entrypoint and defines path and validates existing files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'snapkit-flavors-'));
  try {
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
