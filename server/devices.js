import { run, launch } from './cli.js';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { screenshotFolder } from './storage.js';
import { resizeWindow } from './windows.js';

const background = (name, args) => new Promise((resolve, reject) => {
  const child = launch(name, args, { detached: true, stdio: 'ignore' });
  child.once('error', reject);
  child.once('spawn', () => { child.unref(); resolve(); });
});
export async function deviceAction(d, action, body, workspace) {
  const serial = d.flutterId || d.id;
  const ios = d.platform === 'ios' && d.group === 'ios';
  const avd = d.platform === 'android' && d.group === 'android';
  if (action === 'boot') {
    if (d.state === 'online') return { message: 'Device already online' };
    if (ios) {
      await run('xcrun', ['simctl', 'boot', d.id]);
      await run('open', ['-a', 'Simulator', '--args', '-CurrentDeviceUDID', d.id]);
    } else if (avd && d.avd) await background('emulator', ['-avd', d.avd]);
    else throw new Error('This device cannot be booted remotely');
    return { message: 'Boot requested. Refresh after the device finishes starting.' };
  }
  if (action === 'shutdown') {
    if (ios) await run('xcrun', ['simctl', 'shutdown', d.id]);
    else if (avd && d.flutterId) await run('adb', ['-s', serial, 'emu', 'kill']);
    else throw new Error('Shutdown is available only for running emulators and simulators');
    return { message: 'Shutdown requested' };
  }
  if (action === 'cold-boot') {
    if (ios) {
      if (d.state === 'online') await run('xcrun', ['simctl', 'shutdown', d.id]);
      await run('xcrun', ['simctl', 'boot', d.id]);
      await run('open', ['-a', 'Simulator', '--args', '-CurrentDeviceUDID', d.id]);
    } else if (avd && d.avd) {
      if (d.state === 'online') throw new Error('Shut down the Android emulator before Cold Boot');
      await background('emulator', ['-avd', d.avd, '-no-snapshot-load']);
    } else throw new Error('Cold Boot is available only for virtual devices');
    return { message: 'Cold Boot requested; app data is preserved' };
  }
  if (action === 'erase') {
    if (body.confirm !== d.id) throw new Error('Device ID confirmation required');
    if (d.state === 'online') throw new Error('Shut down the device before erasing its data');
    if (ios) await run('xcrun', ['simctl', 'erase', d.id]);
    else if (avd && d.avd) await background('emulator', ['-avd', d.avd, '-wipe-data', '-no-snapshot-load']);
    else throw new Error('Erase is available only for virtual devices');
    return { message: 'Erase requested. Android starts automatically after wiping data.' };
  }
  if (d.state !== 'online') throw new Error('Start the device first');
  if (action === 'window-size') return resizeWindow(d, body.preset);
  if (action === 'screenshot') {
    if (!workspace) throw new Error('Select a Flutter workspace first');
    const folder = screenshotFolder(workspace); await mkdir(folder, { recursive: true });
    const filename = `${d.name.replace(/[^a-zA-Z0-9_-]/g, '-')}-${Date.now()}.png`;
    const file = path.join(folder, filename);
    if (ios) await run('xcrun', ['simctl', 'io', d.id, 'screenshot', file]);
    else if (d.platform === 'android') await writeFile(file, await run('adb', ['-s', serial, 'exec-out', 'screencap', '-p'], { binary: true }));
    else await run('flutter', ['screenshot', '-d', serial, '--out', file], { cwd: workspace, timeout: 45000 });
    return { message: 'Screenshot saved', filename, file };
  }
  if (action === 'appearance') {
    if (!['dark', 'light'].includes(body.mode)) throw new Error('Choose dark or light');
    if (ios) await run('xcrun', ['simctl', 'ui', d.id, 'appearance', body.mode]);
    else if (d.platform === 'android') await run('adb', ['-s', serial, 'shell', 'cmd', 'uimode', 'night', body.mode === 'dark' ? 'yes' : 'no']);
    else throw new Error('Appearance is unavailable for physical iOS devices');
    return { message: `${body.mode} appearance applied` };
  }
  if (action === 'locale') {
    if (!/^[a-z]{2,3}(-[A-Z]{2})?$/.test(body.locale || '')) throw new Error('Use a locale such as en-US or vi-VN');
    if (ios) {
      await run('xcrun', ['simctl', 'spawn', d.id, 'defaults', 'write', 'NSGlobalDomain', 'AppleLanguages', '-array', body.locale]);
      await run('xcrun', ['simctl', 'spawn', d.id, 'defaults', 'write', 'NSGlobalDomain', 'AppleLocale', body.locale.replace('-', '_')]);
      await run('xcrun', ['simctl', 'shutdown', d.id]); await run('xcrun', ['simctl', 'boot', d.id]);
      return { message: 'Simulator rebooted with the selected locale. Run the Flutter app again.' };
    }
    if (d.platform === 'android') {
      if (!/^[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)+$/.test(body.package || '')) throw new Error('Enter the Android application ID, e.g. com.example.app');
      const api = Number((await run('adb', ['-s', serial, 'shell', 'getprop', 'ro.build.version.sdk'])).trim());
      if (api < 33) throw new Error('Per-app locale requires Android 13 / API 33 or later');
      await run('adb', ['-s', serial, 'shell', 'cmd', 'locale', 'set-app-locales', body.package, '--user', 'current', body.locale]);
      return { message: 'Android app locale set. The app must support this locale.' };
    }
    throw new Error('Locale control is unavailable for physical iOS devices');
  }
  if (action === 'resolution') {
    if (!avd) throw new Error('Display resolution is adjustable only on Android emulators');
    if (!/^(reset|[1-4]\d{2,3}x[1-4]\d{2,3})$/.test(body.size || '')) throw new Error('Choose reset or a resolution such as 1080x2400');
    await run('adb', ['-s', serial, 'shell', 'wm', 'size', body.size]);
    return { message: 'Android display resolution updated' };
  }
  throw new Error('Unsupported device action');
}
