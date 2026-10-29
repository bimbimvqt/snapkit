import { run, launch } from './cli.js';

const background = (name, args) => new Promise((resolve, reject) => {
  const child = launch(name, args, { detached: true, stdio: 'ignore' });
  child.once('error', reject);
  child.once('spawn', () => { child.unref(); resolve(); });
});
export async function bootDevice(d) {
  const ios = d.platform === 'ios' && d.group === 'ios';
  const avd = d.platform === 'android' && d.group === 'android';
  if (d.state === 'online') return { message: 'Device already online' };
  if (ios) {
    await run('xcrun', ['simctl', 'boot', d.id]);
    await run('open', ['-a', 'Simulator', '--args', '-CurrentDeviceUDID', d.id]);
  } else if (avd && d.avd) await background('emulator', ['-avd', d.avd]);
  else throw new Error('This device cannot be booted remotely');
  return { message: 'Boot requested. Refresh after the device finishes starting.' };
}
