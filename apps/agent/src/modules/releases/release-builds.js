import { AppleTeams } from '../apple/teams.js';
import { randomUUID, createHash } from 'node:crypto';
import { readFile, mkdir, writeFile, rename, readdir, stat, realpath, copyFile, rm, statfs } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { dataRoot } from '../../infrastructure/storage/paths.js';
import { releaseCommand } from '../../infrastructure/process/release-command.js';
import { releasePlan, runReleasePlan, redactBuildLog, testFlightIdentity } from '../../domain/release-plan.js';
import { validateRelease, releaseCatalog } from './release-catalog.js';

const activeStatuses = ['preparing', 'building', 'collecting'];
export class ReleaseBuilds {
  constructor({ demo = false, root = path.join(demo ? path.join(os.tmpdir(), `snapkit-release-demo-${process.pid}`) : dataRoot, 'release-builds'), platform = process.platform, execute = releaseCommand, validate = validateRelease, apple } = {}) {
    Object.assign(this, { demo, root, platform, execute, validate });
    this.apple = apple || new AppleTeams({ root, demo });
    this.jobs = []; this.identities = {}; this.logBuffers = new Map(); this.active = null; this.starting = false; this.closed = false; this.writing = Promise.resolve();
  }
  project(workspace) { return createHash('sha256').update(path.resolve(workspace)).digest('hex'); }
  async restore() {
    await this.apple.restore();
    if (this.demo) return;
    const saved = await readFile(path.join(this.root, 'index.json'), 'utf8').then(JSON.parse).catch(error => { if (error.code !== 'ENOENT') throw error; return {}; });
    this.jobs = saved.jobs || []; this.identities = saved.identities || {};
    for (const job of this.jobs) {
      if (activeStatuses.includes(job.status)) { job.status = 'interrupted'; job.error = 'Snapkit closed before this build finished. Start a new build.'; job.finishedAt = Date.now(); }
      if (job.uploadStatus === 'uploading') { job.uploadStatus = 'unknown'; job.uploadError = 'Upload was interrupted. Check App Store Connect before retrying.'; }
    }
  }
  save() {
    if (this.demo) return Promise.resolve();
    const content = JSON.stringify({ jobs: this.jobs, identities: this.identities });
    const task = this.writing.catch(() => {}).then(async () => { await mkdir(this.root, { recursive: true }); const file = path.join(this.root, 'index.json'); await writeFile(file + '.tmp', content, { mode: 0o600 }); await rename(file + '.tmp', file); });
    this.writing = task; return task;
  }
  publicJob(job, includeLog = false) { const { log, ...safe } = job; return includeLog ? { ...safe, log: redactBuildLog(log || '') } : safe; }
  list(workspace) {
    const project = workspace ? this.project(workspace) : '';
    return { jobs: this.jobs.filter(job => job.project === project).map(job => this.publicJob(job)).reverse(), active: this.active ? { id: this.active.job.id, workspace: this.active.job.workspace, operation: this.active.operation } : null, busy: !!this.active || this.starting, uploadConfigured: !!this.identities[project], configuredTeamIds: Object.keys(this.apple.teams), demo: this.demo };
  }
  async catalog(workspace, settings) {
    if (!this.demo) return releaseCatalog(workspace, settings, this.platform);
    return { workspace, platform: 'darwin', android: true, ios: true, androidFlavors: ['dev', 'prod'], iosFlavors: ['dev', 'prod'], flavors: ['dev', 'prod'], version: '1.0.0+1', buildName: '1.0.0', buildNumber: '1', profiles: [
      { name: 'Development', flavor: 'dev', target: 'lib/main_dev.dart', defineFile: 'config/dev.json' },
      { name: 'Production', flavor: 'prod', target: 'lib/main_prod.dart', defineFile: 'config/prod.json' }
    ] };
  }
  append(job, chunk) { const raw = ((this.logBuffers.get(job.id) || job.log || '') + chunk).slice(-256 * 1024); this.logBuffers.set(job.id, raw); job.log = redactBuildLog(raw).slice(-128 * 1024); }
  find(workspace, id) { const job = this.jobs.find(job => job.id === id && job.project === this.project(workspace)); if (!job) throw new Error('Build not found in this workspace.'); return job; }
  async start(workspace, input, device) {
    if (!workspace) throw new Error('Choose a Flutter workspace first.');
    if (this.closed || this.active || this.starting) throw new Error('Another release task is running. Wait for it to finish or cancel it.');
    this.starting = true;
    try {
      if (this.jobs.length >= 100) throw new Error('Build history is full. Remove an old build before starting another.');
      const running = input.operation === 'run';
      if (input.operation && !['build', 'run'].includes(input.operation)) throw Error('Invalid release operation.');
      if (running) {
        // Validate the trusted discovered device before selecting its platform.
        runReleasePlan({}, device, this.demo ? 'darwin' : this.platform);
        input = { ...input, format: device.platform === 'ios' ? 'ipa' : 'apk', purpose: 'ipa', exportOptions: '', apple: undefined, buildName: '', buildNumber: '' };
      }
      let plan = this.demo ? { workspace, ...releasePlan(input, 'darwin') } : await this.validate(workspace, input, this.platform);
      if (running) plan = runReleasePlan(plan, device, this.demo ? 'darwin' : this.platform);
      await mkdir(this.root, { recursive: true });
      if (!this.demo) for (const folder of [plan.workspace, this.root]) { const disk = await statfs(folder); if (disk.bavail * disk.bsize < 1024 ** 3) throw new Error('Free at least 1 GB on the workspace and Snapkit data disks before building.'); }
      if (this.closed) throw new Error('Snapkit is shutting down.');
      const apple = !running && plan.format === 'ipa' && input.apple ? this.apple.snapshot(workspace, plan.flavor) : undefined;
      if (apple && input.apple && (apple.teamId !== input.apple.teamId || apple.appId !== input.apple.appId || apple.bundleId !== input.apple.bundleId)) throw Error('Apple selection changed. Review the team and app before building.');
      const job = { apple, id: randomUUID(), project: this.project(workspace), workspace: plan.workspace, plan, status: 'preparing', startedAt: Date.now(), log: '', artifacts: [], uploadStatus: '' };
      this.jobs.push(job); const controller = new AbortController(); this.active = { job, controller, operation: running ? 'run' : 'build' };
      try { await this.save(); } catch (error) { this.jobs.pop(); this.active = null; throw error; }
      this.active.done = this.build(job, controller).finally(() => { this.active = null; });
      return this.publicJob(job);
    } finally { this.starting = false; }
  }
  async candidates(job) {
    const { format, flavor } = job.plan, base = path.join(job.workspace, 'build');
    if (format === 'apk') return [path.join(base, 'app/outputs/flutter-apk', `app-${flavor ? flavor + '-' : ''}release.apk`)];
    const directory = format === 'aab' ? path.join(base, 'app/outputs/bundle', flavor ? flavor + 'Release' : 'release') : path.join(base, 'ios/ipa');
    return (await readdir(directory).catch(() => [])).filter(name => name.endsWith('.' + (format === 'aab' ? 'aab' : 'ipa'))).map(name => path.join(directory, name));
  }
  async fingerprint(file) { const info = await stat(file).catch(() => null); return info?.isFile() ? `${info.size}:${info.mtimeMs}` : ''; }
  async build(job, controller) {
    try {
      if (job.plan.operation === 'run') {
        job.status = 'building';
        this.append(job, `Running release · ${job.plan.device.name} · ${job.plan.flavor || 'default'}\n`);
        if (this.demo) {
          this.append(job, 'Demo run only. No app is installed or launched.\n');
          await new Promise(resolve => setTimeout(resolve, 700));
        } else await this.execute(job.plan.command, job.plan.args, { cwd: job.workspace, signal: controller.signal, onOutput: chunk => this.append(job, chunk) });
      } else if (this.demo) {
        this.append(job, 'Demo build only. No Flutter command or upload is executed.\n'); job.status = 'building';
        await new Promise(resolve => setTimeout(resolve, 700));
        if (controller.signal.aborted) throw new Error('Task cancelled.');
        const file = path.join(this.root, job.id, `demo-${job.plan.flavor || 'app'}.${job.plan.format}`); await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, 'Snapkit demo artifact — not installable.');
        if (job.plan.format === 'ipa') job.signing = job.apple || { teamId: 'ABCDE12345', bundleId: job.plan.flavor === 'prod' ? 'com.snapkit.demo' : 'com.snapkit.demo.dev' };
        job.artifacts = [{ id: randomUUID(), name: path.basename(file), size: (await stat(file)).size, demo: true }];
      } else {
        let buildArgs = job.plan.args, buildEnv;
        if (job.plan.format === 'ipa') {
          if (job.apple) { this.append(job, `Checking Apple app · ${job.apple.bundleId} · ${job.apple.teamId}\n`); await this.apple.verify(job.apple, controller.signal); }
          else this.append(job, 'Reading signing team and bundle ID from Xcode. No App Store Connect key is needed.\n');
          const signing = await this.apple.signing.prepare(job.workspace, job.apple, job.plan, path.join(this.root, job.id), controller.signal);
          buildEnv = signing.env; job.signing = { teamId: signing.teamId, bundleId: signing.bundleId };
          buildArgs = [...job.plan.args];
          const index = buildArgs.findIndex(arg => ['--export-method', '--export-options-plist'].includes(arg));
          if (index >= 0) buildArgs.splice(index, 2);
          buildArgs.push('--export-options-plist', signing.exportOptions);
        }
        const before = new Map(await Promise.all((await this.candidates(job)).map(async file => [file, await this.fingerprint(file)])));
        if (!job.signing && job.plan.format === 'ipa' && job.plan.exportOptions) {
          let raw = '';
          await this.execute('plutil', ['-convert', 'json', '-o', '-', '--', job.plan.exportOptions], { cwd: job.workspace, signal: controller.signal, timeout: 15000, onOutput: value => { raw += value; } });
          const options = JSON.parse(raw);
          if (!['app-store', 'app-store-connect'].includes(options.method)) throw new Error('ExportOptions.plist must use app-store or app-store-connect distribution.');
          if (options.destination === 'upload') throw new Error('ExportOptions.plist must export locally. Upload to TestFlight is a separate action.');
        }
        if (controller.signal.aborted) throw new Error('Task cancelled.');
        job.status = 'building';
        this.append(job, `Building ${job.plan.format.toUpperCase()} · ${job.plan.flavor || 'default'} · release\n`);
        await this.execute(job.plan.command, buildArgs, { cwd: job.workspace, env: buildEnv, signal: controller.signal, onOutput: chunk => this.append(job, chunk) });
        if (controller.signal.aborted) throw new Error('Task cancelled.');
        job.status = 'collecting';
        const files = [];
        for (const file of await this.candidates(job)) {
          const fingerprint = await this.fingerprint(file);
          if (fingerprint && fingerprint !== before.get(file)) files.push(file);
        }
        if (!files.length || (job.plan.format === 'ipa' && files.length !== 1)) throw new Error('No unambiguous new artifact was produced. Check Flutter output and project build paths. Existing files are not treated as a successful build.');
        for (const file of files) {
          const resolved = await realpath(file), allowed = await realpath(path.join(job.workspace, 'build'));
          if (!resolved.startsWith(allowed + path.sep)) throw new Error('Build output is outside the workspace build directory.');
          const name = path.basename(file), destination = path.join(this.root, job.id, name);
          await mkdir(path.dirname(destination), { recursive: true }); await copyFile(resolved, destination);
          if (job.signing) job.appleVerified = await this.apple.signing.inspectIPA(destination, job.signing, job.plan, path.join(this.root, job.id), controller.signal);
          job.artifacts.push({ id: randomUUID(), name, size: (await stat(destination)).size });
        }
      }
      if (controller.signal.aborted) throw new Error('Task cancelled.');
      job.status = 'succeeded'; this.append(job, job.plan.operation === 'run' ? '\nRelease launch command completed. No hot reload or attached debugger.\n' : '\nBuild complete. Artifact saved in Snapkit.\n');
    } catch (error) {
      job.status = controller.signal.aborted ? 'cancelled' : 'failed'; job.error = redactBuildLog(error.message); this.append(job, '\n' + job.error + '\n');
      job.artifacts = []; await rm(path.join(this.root, job.id), { recursive: true, force: true }).catch(() => {});
    } finally { this.logBuffers.delete(job.id); job.finishedAt = Date.now(); await this.save().catch(error => { job.error = 'Build finished, but history could not be saved: ' + error.message; }); }
  }
  async artifact(workspace, jobId, artifactId) {
    const job = this.find(workspace, jobId), item = job.artifacts.find(item => item.id === artifactId);
    if (!item || job.status !== 'succeeded') throw new Error('Artifact not available.');
    const file = await realpath(path.join(this.root, job.id, item.name)), directory = await realpath(path.join(this.root, job.id));
    if (!file.startsWith(directory + path.sep)) throw new Error('Artifact path is invalid.');
    return { file, name: item.name };
  }
  async identity(workspace, input) {
    if (!workspace) throw new Error('Choose a Flutter workspace first.');
    if (input.clear === true) { delete this.identities[this.project(workspace)]; await this.save(); return; }
    const identity = testFlightIdentity(input);
    if (!this.demo) {
      if (!path.isAbsolute(identity.keyPath) || path.basename(identity.keyPath) !== `AuthKey_${identity.keyId}.p8` || !(await stat(identity.keyPath).catch(() => null))?.isFile()) throw new Error('Choose an existing AuthKey_KEYID.p8 file matching your Key ID.');
      if ((await stat(identity.keyPath)).size > 16384) throw new Error('Invalid App Store Connect private key file.');
    }
    this.identities[this.project(workspace)] = identity; await this.save();
  }
  async upload(workspace, id, confirm) {
    if (!this.demo && this.platform !== 'darwin') throw new Error('TestFlight upload requires macOS and Xcode.');
    if (confirm !== id) throw new Error('Confirm this exact build before uploading.');
    if (this.closed || this.active || this.starting) throw new Error('Another release task is running.');
    const job = this.find(workspace, id);
    if (job.plan.operation === 'run' || job.plan.format !== 'ipa' || job.status !== 'succeeded' || job.uploadStatus === 'uploaded') throw new Error('Choose a completed IPA build that has not already been uploaded.');
    if (!job.apple && job.signing) {
      const selected = this.apple.snapshot(workspace, job.plan.flavor);
      if (selected.teamId !== job.signing.teamId || selected.bundleId !== job.signing.bundleId) throw Error('Choose the Apple team and app matching this saved IPA.');
      job.apple = selected;
    }
    let identity = job.apple ? this.apple.identity(job.apple) : this.identities[this.project(workspace)]; if (!identity) throw new Error('Configure App Store Connect for this workspace first.');
    this.starting = true;
    try {
      const artifact = await this.artifact(workspace, id, job.artifacts[0]?.id);
      if (!this.demo && (!(await stat(identity.keyPath).catch(() => null))?.isFile())) throw new Error('The App Store Connect key was moved or removed. Configure it again.');
      if (this.closed) throw new Error('Snapkit is shutting down.');
      const controller = new AbortController(); job.uploadStatus = 'uploading'; delete job.uploadError;
      this.active = { job, controller, operation: 'upload' }; await this.save();
      this.active.done = (async () => {
        let submitted = false;
        try {
          if (this.demo) { submitted = true; this.append(job, '\nDemo upload only. Nothing is sent to Apple.\n'); await new Promise(resolve => setTimeout(resolve, 600)); if (controller.signal.aborted) throw Error('Task cancelled.'); }
          else {
            if (job.apple) { identity = await this.apple.verify(job.apple, controller.signal); await this.apple.signing.inspectIPA(artifact.file, job.apple, job.plan, path.join(this.root, job.id), controller.signal); }
            submitted = true;
            await this.execute('xcrun', ['altool', '--upload-app', '--type', 'ios', '--file', artifact.file, '--apiKey', identity.keyId, '--apiIssuer', identity.issuerId], { cwd: job.workspace, env: { ...process.env, API_PRIVATE_KEYS_DIR: path.dirname(identity.keyPath) }, timeout: 30 * 60000, signal: controller.signal, onOutput: chunk => this.append(job, chunk) });
          }
          job.uploadStatus = 'uploaded'; this.append(job, '\nAccepted by Apple. Processing and tester availability are managed in App Store Connect.\n');
        } catch (error) { job.uploadStatus = submitted ? 'unknown' : 'blocked'; job.uploadError = (submitted ? 'Check App Store Connect before retrying. ' : 'Upload was not started. ') + redactBuildLog(error.message); this.append(job, '\n' + job.uploadError + '\n'); }
        finally { this.logBuffers.delete(job.id); job.uploadFinishedAt = Date.now(); await this.save().catch(() => {}); this.active = null; }
      })();
      return this.publicJob(job);
    } catch (error) { this.active = null; if (job.uploadStatus === 'uploading') job.uploadStatus = 'unknown'; throw error; }
    finally { this.starting = false; }
  }
  async cancel(workspace, id) {
    const job = this.find(workspace, id);
    if (!this.active || this.active.job.id !== job.id) throw new Error('This task is no longer running.');
    this.active.controller.abort(); await this.active.done;
  }
  async delete(workspace, id) {
    const job = this.find(workspace, id);
    if (this.starting || this.active?.job.id === job.id) throw new Error('Cancel the running task before removing it.');
    await rm(path.join(this.root, id), { recursive: true, force: true }); this.jobs = this.jobs.filter(item => item !== job); await this.save();
  }
  async cancelActive() { const active = this.active; if (active) { active.controller.abort(); await active.done; } }
  async close() { this.closed = true; await this.cancelActive(); await this.writing.catch(() => {}); await this.apple.writing.catch(() => {}); }
}
