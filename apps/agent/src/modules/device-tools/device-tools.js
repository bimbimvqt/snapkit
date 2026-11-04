import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, unlink, stat, statfs } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { dataRoot } from '../../infrastructure/storage/paths.js';
import { run, launch } from '../../infrastructure/process/cli.js';

export function toolsSupported(d, platform = process.platform) {
  return d.platform === 'android' || (d.group === 'ios' && platform === 'darwin');
}
export function toolTarget(d) {
  if (d.state !== 'online') throw new Error('Start or connect this device first.');
  if (!toolsSupported(d)) throw new Error('Use Xcode or QuickTime for physical iPhone logs and captures.');
  const id = d.platform === 'android' ? d.flutterId : d.id;
  if (!id || !/^[a-zA-Z0-9._:\[\]%-]+$/.test(id) || id.startsWith('-')) throw new Error('Refresh devices to obtain a valid device connection.');
  return id;
}
export class DeviceTools {
  constructor({ demo = false, root = path.join(demo ? path.join(os.tmpdir(), `snapkit-demo-${process.pid}`) : dataRoot, 'device-tools'), execute = run, spawn = launch } = {}) {
    this.demo = demo; this.root = root; this.execute = execute; this.spawn = spawn;
    this.sets = []; this.captures = []; this.streams = new Map(); this.recordings = new Map(); this.jobs = new Map(); this.shots = 0; this.closed = false; this.writing = Promise.resolve();
    this.timer = setInterval(() => { for (const s of this.streams.values()) if (Date.now() - s.touched > 60000) this.stopLog(s.deviceId); }, 10000); this.timer.unref();
  }
  async restore() {
    if (this.demo) return;
    try { const saved = JSON.parse(await readFile(path.join(this.root, 'index.json'), 'utf8')); this.sets = saved.sets || []; this.captures = (saved.captures || []).map(x => ['ready', 'failed'].includes(x.status) ? x : { ...x, status: 'failed', error: 'Recording was interrupted when Snapkit closed.' }); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  project(workspace) { if (!workspace) throw new Error('Choose a project first.'); return createHash('sha256').update(path.resolve(workspace)).digest('hex'); }
  save() {
    if (this.demo) return Promise.resolve();
    const content = JSON.stringify({ sets: this.sets, captures: this.captures.map(x => this.publicCapture(x)) });
    const task = this.writing.catch(() => {}).then(async () => { await mkdir(this.root, { recursive: true }); const file = path.join(this.root, 'index.json'); await writeFile(file + '.tmp', content, { mode: 0o600 }); await rename(file + '.tmp', file); });
    this.writing = task; return task;
  }
  list(workspace) {
    const project = workspace ? this.project(workspace) : null;
    return { sets: this.sets.filter(x => x.project === project), captures: this.captures.filter(x => x.project === project && !this.recordings.has(x.id)).map(x => this.publicCapture(x)), recordings: [...this.recordings.values()].filter(x => x.project === project).map(x => this.publicCapture(x)), jobs: [...this.jobs.values()].filter(x => x.project === project), demo: this.demo };
  }
  publicCapture(x) { const { child, remote, pid, finish, timer, file, target, android, ...item } = x; return item; }
  async saveSet(workspace, body, devices) {
    const project = this.project(workspace), name = String(body.name || '').trim();
    if (!name || name.length > 64) throw new Error('Use a device set name between 1 and 64 characters.');
    if (!Array.isArray(body.deviceIds) || !body.deviceIds.length || body.deviceIds.length > 20 || new Set(body.deviceIds).size !== body.deviceIds.length || body.deviceIds.some(id => !devices.some(d => d.id === id))) throw new Error('Choose 1–20 available devices.');
    const existing = body.id && this.sets.find(x => x.id === body.id && x.project === project);
    if (body.id && !existing) throw new Error('Device set not found.');
    if (!existing && this.sets.filter(x => x.project === project).length >= 50) throw new Error('This project already has 50 device sets.');
    const item = existing || { id: randomUUID(), project };
    Object.assign(item, { name, deviceIds: [...body.deviceIds] }); if (!existing) this.sets.push(item); await this.save(); return item;
  }
  async deleteSet(workspace, id) { const project = this.project(workspace); this.sets = this.sets.filter(x => x.id !== id || x.project !== project); await this.save(); }
  startSet(workspace, id, { devices, boot, refresh, locks }) {
    const project = this.project(workspace), set = this.sets.find(x => x.id === id && x.project === project);
    if (!set) throw new Error('Device set not found.');
    if ([...this.jobs.values()].some(j => j.status === 'running')) throw new Error('A device set is already starting.');
    const job = { id: randomUUID(), project, name: set.name, status: 'running', devices: set.deviceIds.map(id => ({ id, status: 'waiting' })) };
    this.closed = false; if (this.jobs.size > 30) this.jobs.delete(this.jobs.keys().next().value); this.jobs.set(job.id, job);
    const queue = [...job.devices];
    const worker = async () => { while (queue.length && !this.closed) { const entry = queue.shift(), d = devices().find(d => d.id === entry.id); entry.name = d?.name || entry.id;
      if (!d) { entry.status = 'missing'; continue; } if (d.state === 'online') { entry.status = 'ready'; continue; }
      if (d.group === 'physical') { entry.status = 'connect'; continue; }
      if (locks.has(d.id)) { entry.status = 'busy'; continue; }
      locks.add(d.id); entry.status = 'starting';
      try { await boot(d); const deadline = Date.now() + 90000;
        while (Date.now() < deadline && !this.closed) { await refresh(); if (devices().find(x => x.id === d.id)?.state === 'online') break; await new Promise(resolve => setTimeout(resolve, 1500)); }
        entry.status = devices().find(x => x.id === d.id)?.state === 'online' ? 'ready' : 'timeout';
      } catch (e) { entry.status = 'failed'; entry.error = e.message; } finally { locks.delete(d.id); }
    } };
    Promise.all([worker(), worker()]).finally(() => { job.status = 'finished'; }); return job;
  }
  async target(d) {
    const target = toolTarget(d);
    if (d.platform === 'android' && d.group === 'android') {
      const actual = await this.execute('adb', ['-s', target, 'emu', 'avd', 'name']);
      if (!d.avd || actual.split(/\r?\n/).map(x => x.trim()).filter(x => x && x !== 'OK')[0] !== d.avd) throw new Error('Device connection changed. Refresh devices before trying again.');
    }
    return target;
  }
  async startLog(d) {
    const target = this.demo ? d.id : await this.target(d);
    const existing = this.streams.get(d.id); if (existing?.status === 'running') { existing.touched = Date.now(); return this.log(d.id); }
    if ([...this.streams.values()].filter(s => s.status === 'running').length >= 4) throw new Error('Stop another log stream first (maximum 4).');
    if (this.streams.size >= 8) { const stale = [...this.streams.values()].find(s => s.status !== 'running'); if (stale) this.streams.delete(stale.deviceId); }
    const s = { deviceId: d.id, status: 'running', lines: [], next: 1, touched: Date.now() }; this.streams.set(d.id, s);
    const append = text => { for (const line of text.split(/\r?\n/)) if (line) { const text = line.slice(0, 4000); s.lines.push({ id: s.next++, text }); s.bytes = (s.bytes || 0) + text.length * 2; while (s.lines.length > 1000 || s.bytes > 1024 * 1024) s.bytes -= s.lines.shift().text.length * 2; } };
    if (this.demo) { append('I Snapkit: Sample system log · device connected\nW Snapkit: Sample warning'); return this.log(d.id); }
    const child = this.spawn(d.platform === 'android' ? 'adb' : 'xcrun', d.platform === 'android' ? ['-s', target, 'logcat', '-v', 'threadtime', '-T', '100'] : ['simctl', 'spawn', target, 'log', 'stream', '--style', 'compact', '--level', 'info'], { stdio: ['ignore', 'pipe', 'pipe'] }); s.child = child;
    child.stdout.setEncoding('utf8');
    let partial = ''; child.stdout.on('data', chunk => { partial += chunk.toString(); const end = partial.lastIndexOf('\n'); if (end >= 0) { append(partial.slice(0, end)); partial = partial.slice(end + 1); } if (partial.length > 4000) { append(partial); partial = ''; } });
    child.stderr.on('data', chunk => { s.detail = chunk.toString().slice(-2000); }); child.on('error', e => { s.status = 'failed'; s.detail = e.message; }); child.on('close', () => { if (partial) append(partial); if (s.status === 'running') s.status = 'stopped'; }); return this.log(d.id);
  }
  log(id, after = 0) { const s = this.streams.get(id); if (!s) return { deviceId: id, status: 'stopped', lines: [], next: 1 }; s.touched = Date.now(); return { deviceId: id, status: s.status, detail: s.detail, lines: s.lines.filter(x => x.id > after), next: s.next, truncated: after > 0 && s.lines[0]?.id > after + 1 }; }
  stopLog(id) { const s = this.streams.get(id); if (s) { s.status = 'stopped'; s.child?.kill('SIGTERM'); } }
  async checkSpace() {
    if (this.captures.length >= 2000) throw new Error('Delete older captures before saving more (maximum 2,000).');
    await mkdir(this.root, { recursive: true });
    const disk = await statfs(this.root); if (disk.bavail * disk.bsize < 256 * 1024 * 1024) throw new Error('Free at least 256 MB of disk space before capturing.');
  }
  async capture(workspace, d) {
    if (this.shots >= 2) throw new Error('Another capture is being saved. Try again shortly.');
    this.shots++; try { return await this.screenshot(workspace, d); } finally { this.shots--; }
  }
  async screenshot(workspace, d) {
    await this.checkSpace();
    const project = this.project(workspace), target = this.demo ? d.id : await this.target(d);
    const item = { id: randomUUID(), project, deviceId: d.id, deviceName: d.name, kind: 'image', status: 'ready', createdAt: new Date().toISOString() };
    await mkdir(path.join(this.root, project), { recursive: true }); const file = this.file(item);
    try {
      if (this.demo) await writeFile(file, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'));
      else if (d.platform === 'android') { const png = await this.execute('adb', ['-s', target, 'exec-out', 'screencap', '-p'], { binary: true }); if (!png.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) throw new Error('Device did not return a PNG image.'); await writeFile(file, png); }
      else await this.execute('xcrun', ['simctl', 'io', target, 'screenshot', file]);
      this.captures.unshift(item); await this.save(); return this.publicCapture(item);
    } catch (e) { await unlink(file).catch(() => {}); throw e; }
  }
  file(item) { return path.join(this.root, item.project, `${item.id}.${item.kind === 'image' ? 'png' : 'mp4'}`); }
  async record(workspace, d) {
    if (this.demo) throw new Error('Screen recording requires a connected local device.');
    const project = this.project(workspace), target = await this.target(d);
    if (this.recordings.size >= 2 || [...this.recordings.values()].some(x => x.deviceId === d.id)) throw new Error('A recording is already running. Stop it before starting another.');
    const item = { id: randomUUID(), project, deviceId: d.id, deviceName: d.name, kind: 'video', status: 'recording', createdAt: new Date().toISOString() };
    this.recordings.set(item.id, item);
    try {
      await this.checkSpace(); await mkdir(path.join(this.root, project), { recursive: true }); item.file = this.file(item);
      this.captures.unshift(this.publicCapture(item)); await this.save();
      const android = d.platform === 'android'; item.remote = `/sdcard/snapkit-${item.id}.mp4`;
      const args = android ? ['-s', target, 'shell', `screenrecord --time-limit 180 --bit-rate 4000000 ${item.remote} & p=$!; echo SNAPKIT_PID:$p; wait $p`] : ['simctl', 'io', target, 'recordVideo', '--codec=h264', item.file];
      const child = this.spawn(android ? 'adb' : 'xcrun', args, { stdio: ['ignore', 'pipe', 'pipe'] }); item.child = child;
      let detail = '', output = ''; child.stdout.on('data', b => { output = (output + b.toString()).slice(-4000); const match = /SNAPKIT_PID:(\d+)/.exec(output); if (match) item.pid = match[1]; }); child.stderr.on('data', b => { detail = (detail + b.toString()).slice(-2000); });
      item.finish = new Promise(resolve => { let finishing = false; const finish = async error => { if (finishing) return; finishing = true; clearTimeout(item.timer); item.status = 'processing';
        try { if (error) throw error; if (android) await this.execute('adb', ['-s', target, 'pull', item.remote, item.file], { timeout: 60000 }); const info = await stat(item.file); if (info.size < 32) throw new Error(detail || 'Recording was empty. Try recording for a few seconds.'); item.status = 'ready'; this.captures = this.captures.map(x => x.id === item.id ? this.publicCapture(item) : x); await this.save(); }
        catch (e) { item.status = 'failed'; item.error = e.message; this.captures = this.captures.map(x => x.id === item.id ? this.publicCapture(item) : x); await this.save().catch(() => {}); await unlink(item.file).catch(() => {}); }
        finally { if (android) await this.execute('adb', ['-s', target, 'shell', 'rm', '-f', item.remote]).catch(() => {}); this.recordings.delete(item.id); resolve(); }
      }; child.once('error', e => finish(e)); child.once('close', () => finish()); });
      item.timer = setTimeout(() => this.stopRecord(item.id).catch(() => {}), 175000); item.target = target; item.android = android; return this.publicCapture(item);
    } catch (e) { this.recordings.delete(item.id); this.captures = this.captures.map(x => x.id === item.id ? { ...x, status: 'failed', error: e.message } : x); await this.save().catch(() => {}); throw e; }
  }
  async stopRecord(id) {
    const item = this.recordings.get(id); if (!item) return;
    if (item.status === 'processing') return;
    if (item.android) { const until = Date.now() + 3000; while (!item.pid && Date.now() < until) await new Promise(r => setTimeout(r, 100)); if (!item.pid) throw new Error('Recording has not started yet. Try stopping again.'); await this.execute('adb', ['-s', item.target, 'shell', 'kill', '-2', item.pid]); }
    else item.child.kill('SIGINT'); item.status = 'processing';
  }
  async deleteCapture(workspace, id) { if (this.recordings.has(id)) throw new Error('Stop the recording and wait for it to finish first.'); const item = this.captures.find(x => x.id === id && x.project === this.project(workspace)); if (!item) throw new Error('Capture not found.'); await unlink(this.file(item)).catch(e => { if (e.code !== 'ENOENT') throw e; }); this.captures = this.captures.filter(x => x !== item); await this.save(); }
  async close() { this.closed = true; for (const id of this.streams.keys()) this.stopLog(id); await Promise.allSettled([...this.recordings.keys()].map(id => this.stopRecord(id))); if (this.recordings.size) { let timer; await Promise.race([Promise.allSettled([...this.recordings.values()].map(x => x.finish)), new Promise(r => { timer = setTimeout(r, 8000); })]); clearTimeout(timer); } }
}
