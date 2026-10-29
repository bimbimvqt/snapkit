import { launch } from './cli.js';

export function loopbackURL(value, protocols = ['http:']) {
  try {
    const url = new URL(value);
    if (!protocols.includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password || !url.port) return null;
    return url;
  } catch { return null; }
}

export class DevTools {
  constructor(spawn = launch, timeout = 30000) { this.spawn = spawn; this.timeout = timeout; this.child = null; this.base = null; this.pending = null; this.disposed = false; }
  start() {
    if (this.disposed) return Promise.reject(new Error('DevTools server is shutting down'));
    if (this.base) return Promise.resolve(this.base);
    if (this.pending) return this.pending;
    this.pending = new Promise((resolve, reject) => {
      const child = this.spawn('dart', ['devtools', '--machine', '--host=127.0.0.1', '--port=0', '--no-launch-browser'], { stdio: ['ignore', 'pipe', 'pipe'] });
      this.child = child;
      let buffer = '', settled = false;
      const fail = message => {
        if (settled) return;
        settled = true; clearTimeout(timer); child.kill(); reject(new Error(message));
      };
      const timer = setTimeout(() => fail('DevTools startup timed out. Check the Dart SDK installation.'), this.timeout);
      child.stdout.on('data', data => {
        buffer += data.toString();
        let index;
        while ((index = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, index); buffer = buffer.slice(index + 1);
          let event; try { event = JSON.parse(line); } catch { continue; }
          if (event.event !== 'server.started' || settled) continue;
          const port = event.params?.port;
          if (event.params?.host !== '127.0.0.1' || !Number.isInteger(port) || port < 1 || port > 65535) { fail('DevTools returned an invalid local server address'); return; }
          settled = true; clearTimeout(timer); this.base = `http://127.0.0.1:${port}/`; resolve(this.base);
        }
        if (buffer.length > 65536) fail('Unexpected DevTools server output');
      });
      // Consume stderr without exposing service tokens in the activity console.
      child.stderr.on('data', () => {});
      child.once('error', () => fail('Cannot start Dart DevTools. Check that dart is available on PATH.'));
      child.once('close', () => {
        if (this.child === child) { this.child = null; this.base = null; }
        fail('DevTools server exited before startup completed');
      });
    }).finally(() => { this.pending = null; });
    return this.pending;
  }
  async open(vmServiceUri, screen = 'inspector') {
    if (!['inspector', 'performance', 'memory', 'network', 'debugger', 'logging'].includes(screen)) throw new Error('Unknown DevTools screen');
    const service = loopbackURL(vmServiceUri, ['http:', 'ws:']);
    if (!service) throw new Error('This session does not have a local VM Service connection yet');
    const url = new URL(await this.start());
    url.searchParams.set('uri', service.href);
    url.searchParams.set('page', screen);
    return url.href;
  }
  close() { this.disposed = true; this.child?.kill(); this.base = null; }
}
