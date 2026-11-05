import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile, realpath } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { validateWorkspace, validateBuild, workspaceProfiles, launchPlan } from '../../apps/agent/src/modules/workspace/workspace.js';
const { createDashboardDebug } = createRequire(import.meta.url)('../../apps/ide-extension/dashboard-debug.cjs');

test('React Native projects are detected, Flutter options are cleared, Expo Go is rejected for IDE debug', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'snapkit-rn-'));
  try {
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ dependencies: { 'react-native': '0.81.0', expo: '~54' } }));
    assert.equal(await validateWorkspace(root), await realpath(root));
    assert.equal((await workspaceProfiles(root)).framework, 'react-native');
    await assert.rejects(validateBuild(root), /Expo Go is not supported/);
    await mkdir(path.join(root, 'android'));
    assert.deepEqual(await validateBuild(root, { target: 'lib/main.dart', flavor: 'dev' }), { framework: 'react-native', target: '', flavor: '', defineFile: '' });
    await writeFile(path.join(root, 'package.json'), '{}');
    await assert.rejects(validateWorkspace(root), /Choose a Flutter project/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('React Native launch plans reach the IDE provider with per-device targets and retain offline fallback', async () => {
  const root = path.resolve('native-project');
  const devices = [{ id: 'android', flutterId: 'emulator-5554', state: 'online', platform: 'android', group: 'android', name: 'Pixel' }, { id: 'ios', flutterId: 'sim-uuid', state: 'online', platform: 'ios', group: 'ios', name: 'iPhone' }];
  const settings = { workspace: root, framework: 'react-native', targetIds: ['android', 'ios'] };
  let plan = launchPlan(settings, devices), offline = false;
  const launches = [], errors = [];
  const vscode = { workspace: { isTrusted: true, getConfiguration: () => ({ get: (_, fallback) => fallback }) }, window: { showErrorMessage: text => errors.push(text), showWarningMessage: text => errors.push(text) }, debug: { startDebugging: async (_, config) => { launches.push(config); return true; }, stopDebugging: async () => {} } };
  const sync = createDashboardDebug(vscode, { canonical: async p => p, reactNativeProject: async () => true, readPlan: async () => { if (offline) throw Error('offline'); return plan; } });
  const original = { type: 'reactnativedirect', request: 'launch', name: 'Debug Android', platform: 'android' };
  const resolve = () => sync.provider.resolveDebugConfiguration({ uri: { fsPath: root } }, original);
  try {
    offline = true; assert.equal(await resolve(), original); offline = false;
    const first = await resolve();
    assert.equal(first.type, 'reactnativedirect'); assert.equal(first.target, 'emulator-5554');
    assert.deepEqual(first.runArguments, ['--deviceId', 'emulator-5554']);
    await sync.started({ id: 'first', configuration: first });
    assert.equal(launches.length, 1); assert.equal(launches[0].target, 'sim-uuid');
    assert.deepEqual(launches[0].runArguments, ['--udid', 'sim-uuid']);
    await sync.terminated({ id: 'first', configuration: first });
    plan = { ...plan, configurations: [{ ...plan.configurations[0], runArguments: ['--unknown', 'anything'] }] };
    assert.equal(await resolve(), undefined); assert.match(errors.at(-1), /Invalid IDE/);
    assert.equal(launchPlan(settings, devices.map(d => ({ ...d, state: 'offline' }))).status, 'invalid');
    assert.equal(launchPlan(settings, devices.map(d => ({ ...d, group: 'physical' }))).status, 'invalid');
  } finally { sync.dispose(); }
});

test('developer profiles validate and survive a new agent process', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'snapkit-profile-'));
  const module = new URL('../../apps/agent/src/infrastructure/storage/preferences.js', import.meta.url).href;
  const run = script => execFileSync(process.execPath, ['--input-type=module', '-e', `const {savePreferences,getPreferences}=await import(${JSON.stringify(module)}); ${script}`], { env: { ...process.env, SNAPKIT_DATA_ROOT: root }, encoding: 'utf8' }).trim();
  try {
    run(`await savePreferences({developerProfile:{role:'frontend', framework:'react-native'}})`);
    assert.equal(JSON.parse(run('console.log(JSON.stringify(getPreferences()))')).developerProfile.framework, 'react-native');
    run(`try { await savePreferences({developerProfile:{role:'frontend',framework:'unknown'}}); process.exit(1); } catch {}`);
    assert.equal(JSON.parse(await readFile(path.join(root, 'state/preferences.json'))).developerProfile.framework, 'react-native');
    run(`await savePreferences({developerProfile:{role:'backend',framework:'flutter'}})`);
    assert.deepEqual(JSON.parse(run('console.log(JSON.stringify(getPreferences()))')).developerProfile, { role: 'backend', framework: null });
  } finally { await rm(root, { recursive: true, force: true }); }
});
