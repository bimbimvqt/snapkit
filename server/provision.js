import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, readdir, realpath, access } from 'node:fs/promises';
import path from 'node:path';
import { run, parseJsonOutput } from './cli.js';
import { storage, requireIOSStorage } from './storage.js';

export const versionCode = value => String(value).split('.').slice(0, 3).reduce((n, part, i) => n + Number(part) * [65536, 256, 1][i], 0);
export function iosCompatible(model, runtime, arch = process.arch) {
  if (model.unsupported || !runtime.isAvailable) return false;
  if (runtime.supportedArchitectures?.length && !runtime.supportedArchitectures.includes(arch === 'x64' ? 'x86_64' : arch)) return false;
  const code = versionCode(runtime.version);
  if (code < (model.minRuntimeVersion ?? 0) || code > (model.maxRuntimeVersion ?? Infinity)) return false;
  if (runtime.supportedDeviceTypes?.length && !runtime.supportedDeviceTypes.some(d => d.identifier === model.identifier)) return false;
  return true;
}
export function parseAndroidProfiles(raw) {
  return raw.split(/(?=^id:\s*\d+)/m).flatMap(block => {
    const id = /^id:\s*\d+\s+or\s+"([^"]+)"/m.exec(block)?.[1];
    const name = /^\s*Name:\s*(.+)$/m.exec(block)?.[1]?.trim();
    const tag = /^\s*Tag\s*:\s*(.+)$/m.exec(block)?.[1]?.trim();
    return id && name && (!tag || /^(google_apis|google_apis_playstore|default)$/.test(tag)) ? [{ id, name, tag: tag || null }] : [];
  });
}
const androidNames = { 23: '6', 24: '7', 25: '7.1', 26: '8', 27: '8.1', 28: '9', 29: '10', 30: '11', 31: '12', 32: '12L', 33: '13', 34: '14', 35: '15', 36: '16', 37: '17' };
export function parseAndroidImages(raw, arch = process.arch) {
  const images = new Map(); let installed = false;
  for (const line of raw.split(/\r?\n/)) {
    if (/^Installed packages:/i.test(line.trim())) installed = true;
    if (/^(Available Packages|Available Updates):/i.test(line.trim())) installed = false;
    const id = line.split('|')[0].trim();
    const m = /^system-images;android-(\d+)[^;]*;(google_apis(?:_playstore)?(?:_ps16k)?|default);(arm64-v8a|x86_64)$/.exec(id);
    if (!m || m[3] !== (arch === 'arm64' ? 'arm64-v8a' : 'x86_64')) continue;
    const previous = images.get(id);
    images.set(id, { id, api: Number(m[1]), name: `Android ${androidNames[m[1]] || `API ${m[1]}`} · API ${m[1]} · ${m[2]} · ${m[3]}`, tag: m[2], abi: m[3], installed: installed || previous?.installed || false });
  }
  return [...images.values()].sort((a, b) => b.api - a.api || a.name.localeCompare(b.name));
}
export const androidCompatible = (profile, image) => !profile.tag || profile.tag === image.tag || image.tag.startsWith(profile.tag + '_') || (profile.tag === 'google_apis' && image.tag.startsWith('google_apis'));

export class Provisioner extends EventEmitter {
  constructor({ execute = run, paths = storage, platform = process.platform, arch = process.arch, checkIOS = requireIOSStorage } = {}) {
    super(); this.execute = execute; this.paths = paths; this.platform = platform; this.arch = arch; this.checkIOS = checkIOS;
    this.jobs = []; this.remoteImages = []; this.catalogPending = new Map();
  }
  async catalog(remote = false) {
    const key = String(remote);
    if (this.catalogPending.has(key)) return this.catalogPending.get(key);
    const pending = this.getCatalog(remote).finally(() => this.catalogPending.delete(key));
    this.catalogPending.set(key, pending); return pending;
  }
  async getCatalog(remote) {
    const warnings = [];
    const attempt = async (name, task, fallback) => { try { return await task(); } catch (e) { warnings.push(`${name}: ${e.message}`); return fallback; } };
    const [types, runtimes, profiles, images] = await Promise.all([
      this.platform === 'darwin' ? attempt('iOS models', async () => parseJsonOutput(await this.execute('xcrun', ['simctl', 'list', 'devicetypes', '--json'])).devicetypes, []) : [],
      this.platform === 'darwin' ? attempt('iOS runtimes', async () => parseJsonOutput(await this.execute('xcrun', ['simctl', 'list', 'runtimes', '--json'])).runtimes, []) : [],
      attempt('Android profiles', async () => parseAndroidProfiles(await this.execute('avdmanager', ['list', 'device'], { timeout: 45000 })), []),
      attempt('Android images', async () => parseAndroidImages(await this.execute('sdkmanager', [remote ? '--list' : '--list_installed', ...(remote ? ['--include_obsolete'] : []), `--sdk_root=${this.paths.sdk}`], { timeout: remote ? 120000 : 45000 }), this.arch), [])
    ]);
    if (remote) this.remoteImages = images;
    const merged = new Map(this.remoteImages.map(i => [i.id, { ...i, installed: false }]));
    for (const image of images) merged.set(image.id, image);
    const iosRuntimes = runtimes.filter(r => r.platform === 'iOS' || r.identifier?.includes('SimRuntime.iOS-'));
    const models = types.filter(d => ['iPhone', 'iPad'].includes(d.productFamily)).map(d => ({ id: d.identifier, name: d.name,
      runtimeIds: iosRuntimes.filter(r => iosCompatible(d, r, this.arch)).map(r => r.identifier),
      reason: 'No installed runtime supports this model and host architecture.' }));
    if (this.platform === 'darwin' && !models.some(d => d.name === 'iPhone 5')) models.push({ id: 'legacy:iphone-5', name: 'iPhone 5 (legacy, 32-bit)', runtimeIds: [], unsupported: true,
      reason: 'iPhone 5 needs legacy iOS 6–10 / 32-bit simulator tooling. This Xcode has no compatible profile; current Flutter does not support 32-bit iOS.' });
    const downloads = (await readdir(this.paths.downloads, { recursive: true }).catch(() => [])).filter(f => f.toLowerCase().endsWith('.dmg'));
    return { ios: { models, runtimes: iosRuntimes.map(r => ({ id: r.identifier, name: r.name, version: r.version, available: r.isAvailable, error: r.availabilityError })) },
      android: { models: profiles.map(p => ({ ...p, imageIds: [...merged.values()].filter(i => androidCompatible(p, i)).map(i => i.id) })), images: [...merged.values()] }, downloads, warnings, platform: this.platform, arch: this.arch };
  }
  async saveJobs() {
    try { await writeFile(path.join(this.paths.state, 'provision-jobs.json'), JSON.stringify(this.jobs, null, 2)); } catch { /* Event stream remains usable if persisting fails. */ }
  }
  async restore() {
    try { this.jobs = JSON.parse(await readFile(path.join(this.paths.state, 'provision-jobs.json'), 'utf8')).slice(-20).map(j => j.status === 'running' ? { ...j, status: 'error', error: 'Server restarted before completion. Refresh the catalog to inspect installed assets.' } : j); } catch {}
  }
  publish() { this.emit('jobs', this.jobs); }
  start(title, task) {
    if (this.jobs.some(j => j.status === 'running')) throw new Error('Another provisioning job is running. Wait for it to finish.');
    const job = { id: randomUUID(), title, status: 'running', startedAt: new Date().toISOString(), logs: [] };
    this.jobs.push(job); this.jobs = this.jobs.slice(-20); this.publish(); this.saveJobs();
    const log = chunk => { job.logs.push(String(chunk).replace(/\r/g, '\n').slice(-6000)); job.logs = job.logs.slice(-100); this.publish(); };
    Promise.resolve().then(() => task(log)).then(result => { job.status = 'completed'; job.result = result; this.emit('completed', job); }).catch(e => { job.status = 'error'; job.error = e.message; log(e.message); }).finally(() => { job.finishedAt = new Date().toISOString(); this.publish(); this.saveJobs(); });
    return job;
  }
  async create(body) {
    if (!['ios', 'android'].includes(body.platform)) throw new Error('Choose iOS or Android');
    const name = String(body.name || '').trim();
    if (!/^[a-zA-Z0-9][a-zA-Z0-9 ._()-]{0,63}$/.test(name)) throw new Error('Use a device name of 1–64 letters, numbers, spaces, dots, hyphens or parentheses');
    const catalog = await this.catalog();
    if (body.platform === 'ios') {
      const model = catalog.ios.models.find(m => m.id === body.model);
      if (!model || !model.runtimeIds.includes(body.runtime)) throw new Error(model?.reason || 'Unsupported iOS model/runtime pair');
      await this.checkIOS();
      return this.start(`Create ${name}`, async log => {
        const id = (await this.execute('xcrun', ['simctl', 'create', name, model.id, body.runtime], { timeout: 120000, onOutput: log })).trim();
        return { id, name, path: path.join(this.paths.iosDevices, id) };
      });
    }
    const model = catalog.android.models.find(m => m.id === body.model);
    const image = catalog.android.images.find(i => i.id === body.runtime && i.installed);
    if (!model || !image || !model.imageIds.includes(image.id)) throw new Error('Select an installed Android image compatible with the selected profile and host architecture');
    const avdName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const avdPath = path.join(this.paths.avd, `${avdName}.avd`);
    if (await access(avdPath).then(() => true, () => false)) throw new Error('An Android device with this name already exists');
    return this.start(`Create ${name}`, async log => {
      await this.execute('avdmanager', ['create', 'avd', '--name', avdName, '--package', image.id, '--device', model.id, '--path', avdPath], { input: 'no\n', timeout: 120000, onOutput: log });
      return { id: `avd:${avdName}`, name, path: avdPath };
    });
  }
  async installAndroid(id) {
    const image = this.remoteImages.find(i => i.id === id);
    if (!image) throw new Error('Load downloadable Android versions and choose a listed system image first');
    return this.start(`Install ${image.name}`, async log => {
      await this.execute('sdkmanager', ['--install', image.id, `--sdk_root=${this.paths.sdk}`], { timeout: 3600000, onOutput: log });
      return { package: image.id, path: this.paths.sdk };
    });
  }
  downloadIOS(version) {
    if (this.platform !== 'darwin') throw new Error('iOS runtime downloads require macOS and Xcode');
    if (!/^\d{1,2}\.\d{1,2}(\.\d{1,2})?$/.test(version || '')) throw new Error('Enter an iOS version such as 18.5 or 26.1');
    return this.start(`Download iOS ${version}`, async log => {
      await this.execute('xcodebuild', ['-downloadPlatform', 'iOS', '-buildVersion', version, '-exportPath', this.paths.downloads, '-architectureVariant', this.arch === 'arm64' ? 'arm64' : 'universal'], { timeout: 3600000, onOutput: log });
      return { path: this.paths.downloads, message: 'Download finished. Import the DMG to make the runtime available. Apple controls which versions can be downloaded.' };
    });
  }
  async importIOS(filename) {
    if (this.platform !== 'darwin') throw new Error('iOS runtime import requires macOS');
    if (typeof filename !== 'string' || !filename.endsWith('.dmg')) throw new Error('Choose a downloaded runtime DMG');
    const file = await realpath(path.resolve(this.paths.downloads, filename));
    const root = await realpath(this.paths.downloads);
    if (!file.startsWith(root + path.sep)) throw new Error('Runtime must be inside the SSD downloads folder');
    return this.start(`Import ${path.basename(file)}`, async log => {
      await this.execute('xcodebuild', ['-importPlatform', file], { timeout: 3600000, onOutput: log });
      return { message: 'Runtime imported. Installed runtime images are managed by Xcode in the system location.' };
    });
  }
}
