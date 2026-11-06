import path from 'node:path';
import { stat, readFile } from 'node:fs/promises';
import { workspaceFramework, validateBuild } from '../workspace/workspace.js';
import { run } from '../../infrastructure/process/cli.js';

export async function projectDoctor(root, settings = {}, { command = run, platform = process.platform } = {}) {
  const framework = await workspaceFramework(root), checks = [];
  const exists = async (file, directory = false) => { const item = await stat(path.join(root, file)).catch(() => null); return directory ? !!item?.isDirectory() : !!item?.isFile(); };
  const add = (id, title, ready, detail, fix) => checks.push({ id, title, status: ready ? 'ready' : 'attention', detail: ready ? detail : fix });
  try { await validateBuild(root, settings); add('build', 'Launch configuration', true, 'Entrypoint and launch configuration are valid.'); }
  catch (error) { add('build', 'Launch configuration', false, '', error.message); }
  if (framework === 'flutter') {
    add('dependencies', 'Project dependencies', await exists('.dart_tool/package_config.json'), 'Flutter package configuration exists.', 'Run flutter pub get in your project folder.');
  } else {
    add('dependencies', 'Project dependencies', await exists('node_modules', true), 'node_modules exists. Dependency versions have not been verified.', 'Install dependencies using the package manager and lockfile from your project.');
    add('native-cli', 'React Native CLI', await exists('node_modules/react-native/cli.js'), 'React Native project CLI is available.', 'Install project dependencies and the React Native community CLI required by your project.');
  }
  const android = await exists('android', true), ios = await exists('ios', true);
  add('native', 'Native projects', android || ios, [android && 'Android', ios && 'iOS'].filter(Boolean).join(' · '), framework === 'react-native' ? 'Generate native folders with Expo prebuild, or choose a React Native project containing android or ios.' : 'Add the Android or iOS platform required by your app.');
  const tool = async (id, title, name, args, fix) => {
    try { await command(name, args, { cwd: root, timeout: 8000 }); return { id, title, status: 'ready', detail: 'Tool is available.' }; }
    catch { return { id, title, status: 'attention', detail: fix }; }
  };
  const tools = [];
  if (android) tools.push(tool('java', 'Java', 'java', ['-version'], 'Install the JDK version required by your Android Gradle configuration and set JAVA_HOME.'));
  if (ios && platform === 'darwin') {
    tools.push(tool('xcode', 'Xcode', 'xcodebuild', ['-version'], 'Select a full Xcode installation with xcode-select and complete its first-launch setup.'));
    if (await exists('ios/Podfile')) {
      tools.push(tool('pods', 'CocoaPods', 'pod', ['--version'], 'Install CocoaPods using your project’s Ruby/Bundler setup.'));
      const lock = await readFile(path.join(root, 'ios/Podfile.lock'), 'utf8').catch(() => '');
      const installed = await readFile(path.join(root, 'ios/Pods/Manifest.lock'), 'utf8').catch(() => '');
      add('pod-install', 'Installed pods', !!lock && lock === installed, 'Pod lockfiles match.', 'Run pod install in ios using your project’s Ruby/Bundler setup.');
    }
  }
  checks.push(...await Promise.all(tools));
  return { workspace: root, framework, checkedAt: Date.now(), ready: checks.every(c => c.status === 'ready'), checks };
}
