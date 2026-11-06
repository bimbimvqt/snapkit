import os from 'node:os';
import { computerInfo } from './computer.js';
import { run, parseJsonOutput, executable } from '../../infrastructure/process/cli.js';
import { statfs } from 'node:fs/promises';
import { storage, refreshAndroidSDK } from '../../infrastructure/storage/device-storage.js';
import { getPreferences } from '../../infrastructure/storage/preferences.js';
import { clearSDKDiscovery } from '../../infrastructure/tooling/sdk-discovery.js';

let cached, pending, cachedFramework, pendingFramework;
export async function diagnostics({ fresh = false, framework = getPreferences().developerProfile?.framework || 'flutter' } = {}) {
  if (pending) {
    if (pendingFramework === framework) return pending;
    await pending;
    return diagnostics({ fresh, framework });
  }
  if (cachedFramework !== framework) { cached = null; cachedFramework = framework; }
  if (!fresh && cached && Date.now() - cached.checkedAt < 60000) return cached;
  if (fresh) { clearSDKDiscovery(); refreshAndroidSDK(); }
  pendingFramework = framework;
  pending = collect(framework).then(result => { cached = result; return result; }).finally(() => { pending = null; });
  return pending;
}
async function collect(framework) {
  const check = async (id, title, command, args, help, required = true) => {
    try {
      const result = await run(command, args, { timeout: 15000 });
      if (id === 'ios') {
        const available = (parseJsonOutput(result).runtimes || []).filter(runtime => runtime.isAvailable);
        return { id, title, status: available.length ? 'ready' : 'attention', detail: available.length ? `${available.length} simulator runtime${available.length === 1 ? '' : 's'} installed` : 'Open Xcode → Settings → Components and install an iOS runtime.', required, help };
      }
      const parsed = id === 'flutter' ? parseJsonOutput(result) : null;
      return { id, title, status: 'ready', detail: parsed?.frameworkVersion ? `Flutter ${parsed.frameworkVersion}` : result.trim().split('\n')[0].slice(0, 180), required, help, executable: executable(command) };
    } catch {
      return { id, title, status: 'attention', detail: id === 'flutter' ? 'Choose your Flutter SDK, or install Flutter to connect your project.' : id === 'android' ? 'Install Android SDK Platform-Tools in Android Studio, or choose your SDK folder.' : id === 'node' ? 'Install Node.js LTS for React Native and Metro.' : id === 'emulator' ? 'Install Android Emulator from Android Studio → SDK Manager → SDK Tools.' : 'Open Xcode once, finish setup and install an iOS Simulator runtime.', required, help };
    }
  };
  const native = framework === 'react-native';
  const computerTask = computerInfo();
  const checks = await Promise.all([
    native ? check('node', 'Node.js', 'node', ['--version'], 'https://reactnative.dev/docs/set-up-your-environment') : check('flutter', 'Flutter', 'flutter', ['--version', '--machine'], 'https://docs.flutter.dev/get-started/install'),
    check('android', 'Android tools', 'adb', ['version'], 'https://developer.android.com/studio', false),
    check('emulator', 'Android Emulator', 'emulator', ['-version'], 'https://developer.android.com/studio/run/managing-avds', false),
    ...(process.platform === 'darwin' ? [check('ios', 'iOS Simulator', 'xcrun', ['simctl', 'list', 'runtimes', '--json'], 'https://developer.apple.com/xcode/', false)] : [])
  ]);
  const disk = await statfs(storage.root).catch(() => null);
  const freeDiskGB = disk ? Math.floor(disk.bavail * disk.bsize / 1073741824) : null;
  const memoryGB = Math.round(os.totalmem() / 1073741824);
  return { checkedAt: Date.now(), platform: process.platform, arch: process.arch, memoryGB, freeDiskGB, computer: await computerTask,
    checks, preferences: getPreferences(), storage: { root: storage.root, android: storage.avd, ios: process.platform === 'darwin' ? storage.iosDevices : null },
    ready: checks.find(c => c.id === (native ? 'node' : 'flutter'))?.status === 'ready' && checks.some(c => !['flutter', 'node'].includes(c.id) && c.status === 'ready'),
    advice: freeDiskGB !== null && freeDiskGB < 15 ? 'Storage is running low. Free space before downloading an OS runtime or creating more devices.' : memoryGB < 16 ? 'Start with one virtual device. Running several at once may slow down this computer.' : 'Start only the devices you need. Each virtual device uses additional memory.',
    resolvedFlutter: executable('flutter') };
}
