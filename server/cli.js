import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export function executable(name) {
  const override = process.env[`SNAPKIT_${name.toUpperCase()}`];
  if (override) return override;
  const sdk = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME || (process.platform === 'darwin' ? path.join(os.homedir(), 'Library/Android/sdk') : path.join(process.env.LOCALAPPDATA || os.homedir(), 'Android/Sdk'));
  const suffix = process.platform === 'win32' ? '.exe' : '';
  const manager = ['sdkmanager', 'avdmanager'].includes(name) ? path.join(sdk, 'cmdline-tools', 'latest', 'bin', `${name}${process.platform === 'win32' ? '.bat' : ''}`) : null;
  if (manager && existsSync(manager)) return manager;
  const candidate = name === 'adb' ? path.join(sdk, 'platform-tools', `adb${suffix}`) : name === 'emulator' ? path.join(sdk, 'emulator', `emulator${suffix}`) : null;
  return candidate && existsSync(candidate) ? candidate : name;
}

// Windows Flutter is a .bat launcher. Invoke it through cmd with individually quoted,
// validated arguments; all other platforms/tools use exec-style argument arrays.
export function launch(name, args, options = {}) {
  let command = executable(name);
  if (process.platform === 'win32' && (name === 'flutter' || /\.(bat|cmd)$/i.test(command))) {
    if (/["%\r\n!^&|<>]/.test(command) || args.some(arg => /["%\r\n!^&|<>]/.test(String(arg)))) throw new Error('Unsupported Windows command characters');
    command = command === 'flutter' ? 'flutter.bat' : command;
    return spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `""${command}" ${args.map(a => `"${a}"`).join(' ')}"`], { ...options, windowsVerbatimArguments: true, windowsHide: true });
  }
  return spawn(command, args.map(String), { windowsHide: true, ...options, shell: false });
}

export function run(name, args, { timeout = 25000, binary = false, input, onOutput, ...options } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try { child = launch(name, args, { ...options, stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'] }); } catch (e) { reject(e); return; }
    if (input !== undefined) { child.stdin.on('error', () => {}); child.stdin.end(input); }
    const out = [], err = []; let bytes = 0;
    const timer = setTimeout(() => { child.kill(); reject(new Error(`${name}: timed out after ${timeout / 1000}s`)); }, timeout);
    child.stdout.on('data', b => { onOutput?.(b.toString()); bytes += b.length; if (bytes > 32 * 1024 * 1024) { child.kill(); reject(new Error('Command output too large')); } else out.push(b); });
    child.stderr.on('data', b => { if (err.reduce((n, b) => n + b.length, 0) < 1024 * 1024) err.push(b); onOutput?.(b.toString()); });
    child.on('error', e => { clearTimeout(timer); reject(new Error(`${name}: ${e.message}`)); });
    child.on('close', code => { clearTimeout(timer); const output = Buffer.concat(out); code === 0 ? resolve(binary ? output : output.toString()) : reject(new Error(`${name}: ${Buffer.concat(err).toString().trim() || output.toString().trim() || `exit ${code}`}`)); });
  });
}

export function parseJsonOutput(raw) {
  try { return JSON.parse(raw); } catch {}
  // Flutter can emit a startup notice before the JSON document.
  for (let i = 0; i < raw.length; i++) if (raw[i] === '[' || raw[i] === '{') {
    try { return JSON.parse(raw.slice(i)); } catch {}
  }
  throw new Error('CLI returned invalid JSON');
}
