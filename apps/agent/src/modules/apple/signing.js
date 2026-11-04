import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
const exec = promisify(execFile);
const command = (file, args, options = {}) => exec(file, args, { maxBuffer: 8 * 1024 * 1024, timeout: 45000, ...options });
const teamPattern = /^[A-Z0-9]{10}$/;
export class AppleSigning {
  constructor({ run = command, platform = process.platform } = {}) { Object.assign(this, { run, platform }); }
  async json(file, signal) {
    const { stdout } = await this.run('/usr/bin/plutil', ['-convert', 'json', '-o', '-', '--', file], { signal }); return JSON.parse(stdout);
  }
  async fields(file, fields, signal) {
    // Provisioning profiles contain Date/Data values that plutil cannot convert to JSON.
    // Validate the plist, then extract only the scalar/array fields we actually need.
    await this.run('/usr/bin/plutil', ['-lint', '--', file], { signal });
    const result = {};
    for (const [key, type] of Object.entries(fields)) {
      try {
        const { stdout } = await this.run('/usr/bin/plutil', ['-extract', key, type === 'array' ? 'json' : 'raw', '-expect', type, '-n', '-o', '-', '--', file], { signal });
        result[key] = type === 'string' ? stdout : JSON.parse(stdout);
      }
      catch (error) { if (signal?.aborted) throw error; }
    }
    return result;
  }
  async detected(workspace) {
    if (this.platform !== 'darwin') return [];
    const teams = new Map(), raw = await readFile(path.join(workspace || '', 'ios/Runner.xcodeproj/project.pbxproj'), 'utf8').catch(() => '');
    for (const match of raw.matchAll(/\bDEVELOPMENT_TEAM\s*=\s*"?([A-Z0-9]{10})"?\s*;/g)) teams.set(match[1], { teamId: match[1], name: '', source: 'project' });
    let certificates = '';
    try { certificates = (await this.run('/usr/bin/security', ['find-identity', '-v', '-p', 'codesigning'], { timeout: 10000 })).stdout; } catch { return [...teams.values()]; }
    for (const match of certificates.matchAll(/"Apple (Development|Distribution): ([^"\n]+) \(([A-Z0-9]{10})\)"/g)) {
      const [ , type, name, teamId] = match; const team = teams.get(teamId) || { teamId, name: '', source: 'certificate' };
      if (type === 'Distribution') { team.name = name; team.distributionCertificate = true; } else team.developmentCertificate = true;
      teams.set(teamId, team);
    }
    return [...teams.values()];
  }
  async prepare(workspace, apple, plan, directory, signal) {
    if (this.platform !== 'darwin') throw Error('TestFlight builds require macOS and Xcode.');
    if (!teamPattern.test(apple.teamId)) throw Error('Enter a valid 10-character Apple Team ID.');
    await mkdir(directory, { recursive: true });
    const config = path.join(directory, 'SnapkitSigning.xcconfig');
    await writeFile(config, `// Snapkit build only. The project is not modified.\nDEVELOPMENT_TEAM = ${apple.teamId}\n`, { mode: 0o600 });
    const env = { ...process.env, XCODE_XCCONFIG_FILE: config };
    const workspaceFile = path.join(workspace, 'ios/Runner.xcworkspace');
    const container = (await stat(workspaceFile).catch(() => null))?.isDirectory() ? ['-workspace', workspaceFile] : ['-project', path.join(workspace, 'ios/Runner.xcodeproj')];
    let settings;
    try {
      const { stdout } = await this.run('xcrun', ['xcodebuild', '-showBuildSettings', '-json', ...container, '-scheme', plan.flavor || 'Runner', '-configuration', plan.flavor ? `Release-${plan.flavor}` : 'Release', '-destination', 'generic/platform=iOS', '-disableAutomaticPackageResolution', '-skipPackageUpdates'], { cwd: workspace, env, signal });
      const applications = JSON.parse(stdout).filter(entry => entry.buildSettings?.PRODUCT_TYPE === 'com.apple.product-type.application' || entry.buildSettings?.WRAPPER_EXTENSION === 'app');
      if (applications.length !== 1) throw Error('Ambiguous app target'); settings = applications[0].buildSettings;
    } catch { throw Error(signal?.aborted ? 'Task cancelled.' : 'Could not inspect Xcode signing. Open the iOS workspace in Xcode, check the selected scheme and resolve project dependencies.'); }
    if (settings.DEVELOPMENT_TEAM !== apple.teamId) throw Error('The Xcode signing team does not match the selected Apple team.');
    if (settings.PRODUCT_BUNDLE_IDENTIFIER !== apple.bundleId) throw Error('The selected Apple app does not match this flavor’s bundle ID. Choose the matching app or fix the project in Xcode.');
    let options = { method: 'app-store-connect', destination: 'export', teamID: apple.teamId, signingStyle: 'automatic' };
    if (plan.exportOptions) {
      options = await this.json(plan.exportOptions, signal);
      if (!['app-store', 'app-store-connect'].includes(options.method) || options.destination === 'upload') throw Error('Choose ExportOptions.plist for a local App Store export. Upload is a separate action.');
      if (options.teamID && options.teamID !== apple.teamId) throw Error('ExportOptions.plist uses a different Apple team.');
      options = { ...options, teamID: apple.teamId, destination: 'export' };
    } else if (settings.CODE_SIGN_STYLE === 'Manual') throw Error('This project uses manual signing. Choose its App Store ExportOptions.plist before building.');
    const exportOptions = path.join(directory, 'SnapkitExportOptions.plist');
    await writeFile(exportOptions, JSON.stringify(options), { mode: 0o600 });
    await this.run('/usr/bin/plutil', ['-convert', 'xml1', '--', exportOptions], { signal });
    return { env, exportOptions, bundleId: settings.PRODUCT_BUNDLE_IDENTIFIER, teamId: settings.DEVELOPMENT_TEAM };
  }
  async inspectIPA(file, apple, plan, directory, signal) {
    const folder = path.join(directory, 'ipa-inspection'); await mkdir(folder, { recursive: true });
    try {
      const { stdout } = await this.run('/usr/bin/unzip', ['-Z1', file], { signal });
      const names = stdout.split('\n').filter(name => /^Payload\/[^/]+\.app\/Info\.plist$/.test(name));
      if (names.length !== 1) throw Error('The IPA must contain exactly one main app.');
      const base = names[0].slice(0, -'Info.plist'.length), plist = path.join(folder, 'Info.plist'), profile = path.join(folder, 'embedded.mobileprovision'), decoded = path.join(folder, 'profile.plist');
      await writeFile(plist, (await this.run('/usr/bin/unzip', ['-p', file, names[0]], { signal, encoding: 'buffer' })).stdout, { mode: 0o600 });
      await writeFile(profile, (await this.run('/usr/bin/unzip', ['-p', file, base + 'embedded.mobileprovision'], { signal, encoding: 'buffer' })).stdout, { mode: 0o600 });
      await writeFile(decoded, (await this.run('/usr/bin/security', ['cms', '-D', '-i', profile], { signal, encoding: 'buffer' })).stdout, { mode: 0o600 });
      const info = await this.fields(plist, { CFBundleIdentifier: 'string', CFBundleShortVersionString: 'string', CFBundleVersion: 'string' }, signal), provision = await this.fields(decoded, { TeamIdentifier: 'array', 'Entitlements.application-identifier': 'string', 'Entitlements.get-task-allow': 'bool', ProvisionsAllDevices: 'bool', ProvisionedDevices: 'array' }, signal);
      if (info.CFBundleIdentifier !== apple.bundleId || !provision.TeamIdentifier?.includes(apple.teamId) || !String(provision['Entitlements.application-identifier'] || '').endsWith('.' + apple.bundleId)) throw Error('The saved IPA does not match its selected Apple team and app.');
      if (provision['Entitlements.get-task-allow'] === true || provision.ProvisionsAllDevices || provision.ProvisionedDevices?.length) throw Error('This IPA is not signed for App Store distribution.');
      if (plan.buildName && String(info.CFBundleShortVersionString) !== plan.buildName || plan.buildNumber && String(info.CFBundleVersion) !== plan.buildNumber) throw Error('The IPA version or build number does not match this build.');
      return { teamId: apple.teamId, bundleId: apple.bundleId, version: String(info.CFBundleShortVersionString), buildNumber: String(info.CFBundleVersion) };
    } finally { await rm(folder, { recursive: true, force: true }); }
  }
}
