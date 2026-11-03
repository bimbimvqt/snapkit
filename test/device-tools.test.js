import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { DeviceTools, toolTarget, toolsSupported } from '../server/device-tools.js';
const android = { id: 'avd:Pixel', name: 'Pixel', avd: 'Pixel', platform: 'android', group: 'android', state: 'online', flutterId: 'emulator-5554' };
const phone = { id: 'phone', name: 'iPhone', platform: 'ios', group: 'physical', state: 'online' };
function child() { const c = new EventEmitter(); c.stdout = new PassThrough(); c.stderr = new PassThrough(); c.kill = signal => { c.signal = signal; setImmediate(() => c.emit('close', 0)); }; return c; }
async function fixture(t, options = {}) { const root = await mkdtemp(path.join(os.tmpdir(), 'snapkit-tools-test-')); const tools = new DeviceTools({ root, ...options }); t.after(async () => { await tools.close(); clearInterval(tools.timer); await rm(root, { recursive: true, force: true }); }); return tools; }
test('sets persist per project, preserve missing members and limit concurrent boot to two', async t => {
  const tools = await fixture(t); const devices = [1, 2, 3].map(i => ({ ...android, id: `avd:${i}`, state: 'offline' })); devices.push(phone);
  const set = await tools.saveSet('/project/a', { name: 'Daily', deviceIds: devices.map(d => d.id) }, devices);
  assert.equal(tools.list('/project/b').sets.length, 0);
  await assert.rejects(tools.saveSet('/project/a', { name: 'Bad', deviceIds: ['unknown'] }, devices));
  const restored = new DeviceTools({ root: tools.root }); t.after(() => clearInterval(restored.timer)); await restored.restore(); assert.equal(restored.list('/project/a').sets[0].name, 'Daily');
  let active = 0, peak = 0; devices.pop(); devices.push({ ...phone, state: 'offline' });
  const job = tools.startSet('/project/a', set.id, { devices: () => devices, locks: new Set(), refresh: async () => {}, boot: async d => { peak = Math.max(peak, ++active); await new Promise(r => setTimeout(r, 5)); d.state = 'online'; active--; } });
  while (job.status === 'running') await new Promise(r => setTimeout(r, 10));
  assert.equal(peak, 2); assert.deepEqual(job.devices.map(d => d.status), ['ready', 'ready', 'ready', 'connect']);
  devices.splice(0, 1); const next = tools.startSet('/project/a', set.id, { devices: () => devices, locks: new Set(), boot: async () => {}, refresh: async () => {} });
  while (next.status === 'running') await new Promise(r => setTimeout(r, 5)); assert.equal(next.devices[0].status, 'missing');
});
test('log streams use exact device identity, bound buffers, retain split lines, and stop only the owned child', async t => {
  const children = [], calls = []; const tools = await fixture(t, { execute: async () => 'Pixel\nOK', spawn: (name, args) => { calls.push({ name, args }); const c = child(); children.push(c); return c; } });
  await tools.startLog(android); const second = { ...android, id: 'usb', flutterId: '192.168.1.4:38888' }; await tools.startLog(second);
  assert.deepEqual(calls[0].args.slice(0, 3), ['-s', 'emulator-5554', 'logcat']);
  children[0].stdout.write('hello'); children[0].stdout.write(' world\n' + Array.from({ length: 1200 }, (_, i) => `I message ${i}`).join('\n') + '\n');
  assert.equal(tools.log(android.id).lines.length, 1000); assert.equal(tools.log(second.id).lines.length, 0);
  assert.equal(tools.log(android.id, 1).truncated, true);
  tools.stopLog(android.id); assert.ok(children[0].signal); assert.equal(children[1].signal, undefined);
  assert.throws(() => toolTarget(phone)); assert.equal(toolsSupported({ ...phone, group: 'ios' }, 'win32'), false);
  assert.throws(() => toolTarget({ ...android, flutterId: '-s unsafe' }));
});
test('screenshots validate PNG, are isolated by project, and delete only owned artifacts', async t => {
  const png = Buffer.from('89504e470d0a1a0a0000', 'hex'), calls = [];
  const tools = await fixture(t, { execute: async (name, args, options) => { calls.push({ name, args, options }); return args.includes('emu') ? 'Pixel\nOK' : png; } });
  const image = await tools.capture('/project/a', android);
  assert.equal(tools.list('/project/a').captures[0].id, image.id); assert.equal(tools.list('/project/b').captures.length, 0);
  assert.deepEqual(calls[1].args, ['-s', 'emulator-5554', 'exec-out', 'screencap', '-p']); assert.equal(calls[1].options.binary, true);
  await assert.rejects(tools.deleteCapture('/project/b', image.id)); await tools.deleteCapture('/project/a', image.id); assert.equal(tools.captures.length, 0);
  tools.execute = async (_name, args) => args.includes('emu') ? 'Pixel\nOK' : Buffer.from('not png'); await assert.rejects(tools.capture('/project/a', android), /PNG/); assert.equal(tools.captures.length, 0);
  tools.execute = async () => 'Another_AVD\nOK'; await assert.rejects(tools.capture('/project/a', android), /connection changed/);
});
test('Android recording stops its reported PID then pulls and removes only the owned remote file', async t => {
  let recorder; const calls = [];
  const tools = await fixture(t, { spawn: () => { recorder = child(); return recorder; }, execute: async (name, args) => { if (args.includes('emu')) return 'Pixel\nOK'; calls.push(args); if (args.includes('kill')) setImmediate(() => recorder.emit('close', 130)); if (args.includes('pull')) await writeFile(args.at(-1), Buffer.alloc(128)); return ''; } });
  const recording = await tools.record('/project/a', android); assert.equal('pid' in recording, false); assert.equal('file' in recording, false);
  recorder.stdout.write('SNAPKIT_PID:12345\n'); const owned = tools.recordings.get(recording.id); const finish = owned.finish;
  await tools.stopRecord(recording.id); await finish;
  assert.deepEqual(calls[0], ['-s', 'emulator-5554', 'shell', 'kill', '-2', '12345']);
  assert.equal(calls[1][2], 'pull'); assert.equal(calls[1][3], `/sdcard/snapkit-${recording.id}.mp4`);
  assert.deepEqual(calls[2], ['-s', 'emulator-5554', 'shell', 'rm', '-f', `/sdcard/snapkit-${recording.id}.mp4`]);
  assert.equal(tools.captures[0].status, 'ready'); assert.equal(tools.recordings.size, 0);
  assert.equal(calls.some(args => args.includes('pkill') || args.includes('killall')), false);
});
