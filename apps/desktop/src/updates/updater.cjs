'use strict';
const path = require('node:path');
const fs = require('./filesystem.cjs').promises;
const { randomUUID } = require('node:crypto');
const { selectRelease } = require('./policy.cjs');
const network = require('./network.cjs');
const installer = require('./install.cjs');
class DesktopUpdater {
  constructor({ version, platform, arch, packaged, executable, userData, releases = network.releaseList, download = network.download, prepare = installer.prepareMac, install = installer.startInstaller, now = Date.now }) {
    Object.assign(this, { version, platform, arch, packaged, executable, releases, transfer: download, prepare, install, now });
    this.cache = path.join(userData, 'updates'); this.state = { status: packaged && ['darwin', 'win32'].includes(platform) ? 'idle' : 'unsupported', current: version }; this.asset = null; this.controller = null; this.paths = null;
  }
  snapshot() { return { ...this.state, lastCheckedAt: this.lastCheckedAt ?? null, lastAttemptAt: this.lastAttemptAt ?? null }; }
  set(status, extra = {}) { this.state = { current: this.version, version: this.asset?.version, ...extra, status }; return this.snapshot(); }
  async check() {
    if (['unsupported', 'checking', 'downloading', 'verifying', 'ready', 'installing'].includes(this.state.status)) return this.snapshot();
    const previous = this.state;
    this.lastAttemptAt = this.now();
    this.set('checking');
    try {
      this.asset = selectRelease(await this.releases(AbortSignal.timeout(15000)), this.version, this.platform, this.arch);
      this.lastCheckedAt = this.now();
      return this.set(this.asset ? 'available' : 'latest', this.asset ? { size: this.asset.size } : {});
    } catch (error) { return previous.status === 'available' && this.asset ? this.set('available', { size: this.asset.size, error: error.message }) : this.set('error', { error: error.message, retry: 'check' }); }
  }
  async download() {
    if (!['available', 'error'].includes(this.state.status) || !this.asset || this.controller) throw Error('Check for an available update first.');
    this.controller = new AbortController(); this.token = randomUUID();
    this.work = path.join(this.cache, this.token); this.file = path.join(this.work, this.asset.name);
    this.set('downloading', { received: 0, size: this.asset.size, percent: 0 });
    const signal = this.controller.signal;
    try {
      await fs.mkdir(this.work, { recursive: true });
      await fs.writeFile(path.join(this.cache, 'download.json'), JSON.stringify({ token: this.token }), { mode: 0o600 });
      const disk = await fs.statfs(this.work); if (disk.bavail * disk.bsize < this.asset.size * 5) throw Error('Free more disk space before downloading this update.');
      await this.transfer(this.asset, this.file, signal, received => this.set('downloading', { received, size: this.asset.size, percent: Math.floor(received * 100 / this.asset.size) }));
      if (signal.aborted) throw Error('Download cancelled.');
      this.set('verifying');
      if (this.platform === 'darwin') this.paths = await this.prepare({ file: this.file, version: this.asset.version, arch: this.arch, executable: this.executable, token: this.token });
      if (signal.aborted) throw Error('Download cancelled.');
      return this.set('ready');
    } catch (error) {
      try { await this.discard(); } catch { /* Cleanup errors must never leave the UI stuck in verifying. */ }
      return this.set(signal.aborted ? 'available' : 'error', signal.aborted ? { size: this.asset.size } : { error: error.message, retry: 'download' });
    } finally { this.controller = null; }
  }
  cancel() { if (this.state.status === 'downloading') this.controller?.abort(); return this.snapshot(); }
  beginDownload() { if (this.pending) return this.snapshot(); this.pending = this.download().catch(error => this.set('error', { error: error.message, retry: 'download' })).finally(() => { this.pending = null; }); return this.snapshot(); }
  async discard() { if (this.paths?.stage) await fs.rm(this.paths.stage, { recursive: true, force: true }); this.paths = null; if (this.work) { await fs.rm(this.work, { recursive: true, force: true }); await fs.rm(path.join(this.cache, 'download.json'), { force: true }); } }
  async apply(canInstall) {
    if (this.state.status !== 'ready' || this.controller) throw Error('Download and verify the update first.');
    this.set('installing');
    try {
      await canInstall();
      await this.install({ platform: this.platform, executable: this.executable, cache: this.cache, file: this.file, asset: this.asset, paths: this.paths, token: this.token });
      return true;
    } catch (error) { this.set('ready', { error: error.message }); throw error; }
  }
  async acknowledge(token, ready = false) {
    if (!/^[a-f0-9-]{36}$/.test(token || '') || this.platform !== 'darwin') return;
    try {
      const plan = JSON.parse(await fs.readFile(path.join(this.cache, 'install.json'), 'utf8'));
      if (plan.token !== token || await fs.realpath(plan.target) !== await fs.realpath(installer.appBundle(this.executable))) return;
      await fs.writeFile(path.join(this.cache, `${ready ? 'ready' : 'starting'}-${token}`), String(process.pid), { mode: 0o600 });
    } catch {}
  }
  async cleanup() {
    const download = await fs.readFile(path.join(this.cache, 'download.json'), 'utf8').then(JSON.parse).catch(() => null);
    if (download?.token && /^[a-f0-9-]{36}$/.test(download.token)) {
      await fs.rm(path.join(this.cache, download.token), { recursive: true, force: true }).catch(() => {});
      if (this.platform === 'darwin') await fs.rm(path.join(path.dirname(installer.appBundle(this.executable)), `.snapkit-update-${download.token}.app`), { recursive: true, force: true }).catch(() => {});
      await fs.rm(path.join(this.cache, 'download.json'), { force: true });
    }
    // Only clean completed owned update downloads; never remove an active installation backup.
    const result = await fs.readFile(path.join(this.cache, 'result.json'), 'utf8').then(JSON.parse).catch(() => null);
    if (!result) return;
    const plan = await fs.readFile(path.join(this.cache, 'install.json'), 'utf8').then(JSON.parse).catch(() => null);
    if (plan?.token && /^[a-f0-9-]{36}$/.test(plan.token)) {
      await fs.rm(path.join(this.cache, plan.token), { recursive: true, force: true });
      if (plan.stage === path.join(path.dirname(installer.appBundle(this.executable)), `.snapkit-update-${plan.token}.app`)) await fs.rm(plan.stage, { recursive: true, force: true });
    }
    if (result.status === 'error') this.set('error', { error: result.error, retry: 'check' });
    await fs.rm(path.join(this.cache, 'result.json'), { force: true });
  }
  async close() { this.controller?.abort(); await this.pending; if (this.state.status !== 'installing') await this.discard(); }
}
module.exports = { DesktopUpdater };
