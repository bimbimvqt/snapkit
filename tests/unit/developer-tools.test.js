import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { RunProfiles } from '../../apps/agent/src/modules/workspace/run-profiles.js';
import { projectDoctor } from '../../apps/agent/src/modules/diagnostics/project-doctor.js';
import { logLevel, filterLogs } from '../../apps/dashboard/src/features/device-tools/log-model.js';

async function fixture(fn) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'snapkit-developer-'));
  try { await fn(root); } finally { await rm(root, {recursive: true, force: true}); }
}
test('run profiles survive restart, isolate workspace and project, reject duplicates and roll back failed writes', () => fixture(async root => {
  const store = new RunProfiles(root), settings = {spaceId: 'one', workspace: '/project', targetIds: ['phone']};
  const profile = await store.save(settings, 'Dev', {framework: 'flutter', flavor: 'dev', target: 'lib/dev.dart', defineFile: 'dev.json'});
  settings.targetIds.push('other'); assert.deepEqual(profile.targetIds, ['phone']);
  await assert.rejects(store.save(settings, 'dev', {}), /already exists/);
  await assert.rejects(store.save(settings, '\nBad', {}), /profile name/);
  assert.deepEqual(store.list({...settings, spaceId: 'two'}), []);
  assert.deepEqual(store.list({...settings, workspace: '/other'}), []);
  assert.throws(() => store.find({...settings, spaceId: 'two'}, profile.id), /not found/);
  const restored = new RunProfiles(root); await restored.restore(); assert.deepEqual(restored.list(settings), [profile]);
  await mkdir(store.file + '.tmp');
  await assert.rejects(store.remove(settings, profile.id)); assert.equal(store.list(settings).length, 1);
  await rm(store.file + '.tmp', {recursive: true}); await store.remove(settings, profile.id);
  await restored.restore(); assert.deepEqual(restored.list(settings), []);
}));
test('Flutter doctor identifies missing packages, bad entrypoint, Java and pod installation without executing project code', () => fixture(async root => {
  await mkdir(path.join(root, 'lib')); await writeFile(path.join(root, 'pubspec.yaml'), 'dependencies:\n  flutter:\n    sdk: flutter');
  await writeFile(path.join(root, 'lib/main.dart'), 'void main() {}');
  await mkdir(path.join(root, 'android')); await mkdir(path.join(root, 'ios'));
  await writeFile(path.join(root, 'ios/Podfile'), 'platform :ios');
  const commands = [];
  const command = async (name, args) => {commands.push([name, args]); if(name === 'java') throw Error('missing'); return 'ready';};
  let result = await projectDoctor(root, {target: 'lib/missing.dart'}, {command, platform: 'darwin'});
  const check = id => result.checks.find(c => c.id === id);
  assert.equal(result.ready, false); assert.equal(check('build').status, 'attention');
  assert.match(check('dependencies').detail, /flutter pub get/); assert.equal(check('java').status, 'attention');
  assert.equal(check('pod-install').status, 'attention'); assert.equal(check('xcode').status, 'ready');
  assert.deepEqual(commands.map(c => c[0]).sort(), ['java','pod','xcodebuild']);
  await mkdir(path.join(root, '.dart_tool')); await writeFile(path.join(root, '.dart_tool/package_config.json'), '{}');
  result = await projectDoctor(root, {}, {command: async () => '', platform: 'linux'});
  assert.equal(result.ready, true); assert.equal(result.checks.some(c => c.id === 'pods'), false);
}));
test('React Native doctor reports missing CLI and native folders then accepts installed project', () => fixture(async root => {
  await writeFile(path.join(root, 'package.json'), JSON.stringify({dependencies: {'react-native': '0.82'}}));
  let result = await projectDoctor(root, {}, {platform: 'linux'});
  assert.equal(result.ready, false); assert.equal(result.checks.find(c => c.id === 'native-cli').status, 'attention');
  await mkdir(path.join(root, 'android')); await mkdir(path.join(root, 'node_modules/react-native'), {recursive: true});
  await writeFile(path.join(root, 'node_modules/react-native/cli.js'), '');
  result = await projectDoctor(root, {}, {platform: 'linux', command: async () => ''}); assert.equal(result.ready, true);
}));
test('log filtering recognizes Android and iOS severity and preserves safe literal text', () => {
  assert.equal(logLevel('11-06 12:00:00.000 123 456 E App: failed'), 'error');
  assert.equal(logLevel('W/ReactNativeJS(123): slow'), 'warning');
  assert.equal(logLevel('ios [fault] failed'), 'error');
  assert.equal(logLevel('Route E selected'), 'info');
  assert.equal(logLevel('I/App: error count is zero'), 'info');
  const lines = [{id:1,text:'E/App: <script>literal</script>'}, {id:2,text:'W/App: slow'}, {id:3,text:'I/App: okay'}];
  assert.deepEqual(filterLogs(lines, {level:'warning'}).map(x => x.id), [1,2]);
  assert.deepEqual(filterLogs(lines, {text:'APP', after:1}).map(x => x.id), [2,3]);
  assert.deepEqual(filterLogs(lines, {level:'error', text:'literal'}), [lines[0]]);
});
