import { EventEmitter } from 'node:events';
import { launch } from './cli.js';
import { flutterBuildArgs } from './workspace.js';
import { loopbackURL } from './devtools.js';

export class Sessions extends EventEmitter {
  constructor(spawn = launch) { super(); this.spawn = spawn; this.items = new Map(); this.sequence = 0; this.pending = new Map(); this.logs = []; }
  log(deviceId, message, level = 'info') {
    const entry = { time: new Date().toISOString(), deviceId, message: String(message).slice(0, 6000), level };
    this.logs.push(entry); if (this.logs.length > 300) this.logs.shift(); this.emit('log', entry);
  }
  list() { return [...this.items.values()].map(({ child, buffer, vmServiceUri, ...rest }) => ({ ...rest, devtoolsReady: rest.status === 'running' && !!vmServiceUri })); }
  vmService(id) {
    const session = this.items.get(id);
    if (session?.status !== 'running' || !session.vmServiceUri) throw new Error('Wait for a Dashboard-managed debug session and its VM Service to be ready');
    return session.vmServiceUri;
  }
  start(device, workspace, options = {}) {
    const old = this.items.get(device.id);
    if (old && !['stopped', 'error'].includes(old.status)) throw new Error('A Flutter session already exists for this device');
    const args = ['run', '--machine', '-d', device.flutterId || device.id, ...flutterBuildArgs(options)];
    const child = this.spawn('flutter', args, { cwd: workspace, stdio: ['pipe', 'pipe', 'pipe'] });
    const session = { deviceId: device.id, name: device.name, status: 'starting', flavor: options.flavor || '', target: options.target || 'lib/main.dart', appId: null, startedAt: new Date().toISOString(), child, buffer: '' };
    this.items.set(device.id, session);
    const update = () => this.emit('sessions', this.list());
    child.stdout.on('data', b => {
      session.buffer += b.toString();
      let index;
      while ((index = session.buffer.indexOf('\n')) >= 0) {
        const line = session.buffer.slice(0, index).trim(); session.buffer = session.buffer.slice(index + 1);
        if (!line) continue;
        let events;
        try { events = JSON.parse(line); } catch { this.log(device.id, line); continue; }
        if (!Array.isArray(events)) { this.log(device.id, line); continue; }
        for (const event of events) {
          if (event.id !== undefined) {
            const p = this.pending.get(event.id);
            if (p) { clearTimeout(p.timer); this.pending.delete(event.id); event.error ? p.reject(new Error(typeof event.error === 'string' ? event.error : JSON.stringify(event.error))) : p.resolve(event.result); }
          }
          const p = event.params || {};
          if (event.event === 'app.start') session.appId = p.appId;
          if (event.event === 'app.debugPort' && (!p.appId || p.appId === session.appId)) {
            session.vmServiceUri = loopbackURL(p.wsUri, ['ws:', 'http:'])?.href || null;
          }
          if (event.event === 'app.started') session.status = 'running';
          if (event.event === 'app.stop') session.status = 'stopped';
          if (event.event === 'app.log') this.log(device.id, p.log, p.error ? 'error' : 'info');
          if (event.event === 'app.progress' && p.message) this.log(device.id, p.message);
          update();
        }
      }
      if (session.buffer.length > 1024 * 1024) session.buffer = '';
    });
    child.stderr.on('data', b => this.log(device.id, b.toString(), 'warning'));
    child.stdin.on('error', e => this.log(device.id, e.message, 'error'));
    child.on('error', e => { session.status = 'error'; this.log(device.id, e.message, 'error'); update(); });
    child.on('close', code => {
      session.status = code === 0 ? 'stopped' : 'error'; this.log(device.id, `Flutter process exited (${code})`, code === 0 ? 'info' : 'error');
      for (const [id, p] of this.pending) if (p.deviceId === device.id) { clearTimeout(p.timer); p.reject(new Error('Flutter process exited')); this.pending.delete(id); }
      update();
    });
    this.log(device.id, `flutter ${args.join(' ')}`); update();
    return this.list();
  }
  request(deviceId, method, params = {}) {
    const s = this.items.get(deviceId);
    if (!s?.appId || s.status !== 'running') throw new Error('The app must be running in a Dashboard-managed session');
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('Flutter command timed out')); }, 45000);
      this.pending.set(id, { resolve, reject, timer, deviceId });
      s.child.stdin.write(`${JSON.stringify([{ id, method, params: { appId: s.appId, ...params } }])}\n`, error => {
        if (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
      });
    });
  }
  async action(id, action) {
    if (!['reload', 'restart', 'stop'].includes(action)) throw new Error('Unknown session action');
    const s = this.items.get(id);
    if (action === 'stop' && s && s.status === 'starting') { s.child.kill(); return; }
    const result = await this.request(id, action === 'stop' ? 'app.stop' : 'app.restart', action === 'stop' ? {} : { fullRestart: action === 'restart', pause: false, reason: 'Snapkit' });
    if (result?.code) throw new Error(result.message || 'Flutter restart failed');
    this.log(id, action === 'reload' ? 'Hot reload completed' : `${action} completed`);
    return result;
  }
  async reloadAll() {
    const active = this.list().filter(s => s.status === 'running');
    return Promise.all(active.map(async s => { try { await this.action(s.deviceId, 'reload'); return { deviceId: s.deviceId, ok: true }; } catch (e) { return { deviceId: s.deviceId, ok: false, error: e.message }; } }));
  }
  close() { for (const s of this.items.values()) if (!['stopped', 'error'].includes(s.status)) s.child.kill(); }
}
