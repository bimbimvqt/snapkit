import path from 'node:path';
import { readFile, readdir, stat, realpath } from 'node:fs/promises';
import { workspaceProfiles, validateWorkspace, validateBuild } from '../workspace/workspace.js';
import { releasePlan, projectVersion } from '../../domain/release-plan.js';
const exists = async file => (await stat(file).catch(() => null))?.isDirectory() || false;
async function canonical(file) {
  let parent = file; const tail = [];
  for (;;) {
    try { return path.join(await realpath(parent), ...tail); } catch {}
    const next = path.dirname(parent); if (next === parent) return file;
    tail.unshift(path.basename(parent)); parent = next;
  }
}
// Extract named Android flavor declarations, including Kotlin create/getByName syntax.
export function gradleFlavors(raw) {
  const text = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const start = /\bproductFlavors\s*\{/.exec(text); if (!start) return [];
  let depth = 1, body = '', quote = '';
  for (let i = start.index + start[0].length; i < text.length && depth; i++) {
    const char = text[i];
    if (quote) { body += depth === 1 ? char : ' '; if (char === quote && text[i - 1] !== '\\') quote = ''; continue; }
    if (char === '"' || char === "'") { quote = char; body += depth === 1 ? char : ' '; continue; }
    if (char === '{') { if (depth === 1) body += '{\n'; depth++; }
    else if (char === '}') { depth--; body += '\n'; }
    else body += depth === 1 ? char : ' ';
  }
  const names = [...body.matchAll(/(?:\b(?:create|maybeCreate|getByName)\s*\(\s*["']([\w-]+)["']\s*\)|(?:^|[\n;])\s*([A-Za-z_][\w-]*)\s*)\s*\{/g)].map(m => m[1] || m[2]);
  return [...new Set(names.filter(name => !['all', 'configureEach'].includes(name)))];
}
export async function releaseCatalog(workspace, settings, platform) {
  if (!workspace) return { workspace: '', platform, profiles: [], android: false, ios: false, androidFlavors: [], iosFlavors: [] };
  const root = await validateWorkspace(workspace), info = await workspaceProfiles(root);
  const gradle = (await Promise.all(['build.gradle', 'build.gradle.kts'].map(file => readFile(path.join(root, 'android/app', file), 'utf8').catch(() => '')))).join('\n');
  const androidFlavors = gradleFlavors(gradle);
  const schemes = await readdir(path.join(root, 'ios/Runner.xcodeproj/xcshareddata/xcschemes')).catch(() => []);
  const iosFlavors = schemes.filter(name => name.endsWith('.xcscheme') && name !== 'Runner.xcscheme').map(name => name.slice(0, -9));
  const flavors = [...new Set([...info.flavors, ...androidFlavors, settings.flavor || ''].filter(Boolean))];
  const current = { name: 'Workspace settings', flavor: settings.flavor || '', target: settings.target || 'lib/main.dart', defineFile: settings.defineFile || '' };
  const identity = async profile => JSON.stringify([profile.flavor || '', await canonical(path.resolve(root, profile.target || 'lib/main.dart')), profile.defineFile ? await canonical(path.resolve(root, profile.defineFile)) : '']);
  const currentKey = await identity(current), seen = new Map();
  for (const profile of info.profiles) { const key = await identity(profile); if (!seen.has(key)) seen.set(key, profile); }
  const profiles = [...seen.values()];
  const matching = seen.get(currentKey);
  if (matching) matching.current = true;
  else profiles.unshift({ ...current, current: true });
  for (const flavor of flavors) if (!profiles.some(profile => profile.flavor === flavor)) profiles.push({ name: flavor, flavor, target: settings.target || 'lib/main.dart', defineFile: settings.defineFile || '', review: true });
  const pubspec = await readFile(path.join(root, 'pubspec.yaml'), 'utf8');
  return { workspace: root, platform, android: await exists(path.join(root, 'android')), ios: await exists(path.join(root, 'ios')), androidFlavors, iosFlavors, profiles, ...projectVersion(pubspec), flavors };
}
export async function validateRelease(workspace, input, platform) {
  const plan = releasePlan(input, platform), root = await validateWorkspace(workspace);
  const catalog = await releaseCatalog(root, {}, platform);
  const build = await validateBuild(root, plan);
  const native = plan.format === 'ipa' ? catalog.iosFlavors : catalog.androidFlavors;
  if (!(plan.format === 'ipa' ? catalog.ios : catalog.android)) throw new Error('This workspace does not contain the requested platform.');
  if (native.length && (!plan.flavor || !native.includes(plan.flavor))) throw new Error('Choose a flavor configured for this platform. Multi-dimension Android variants must be configured in your Flutter project first.');
  if (plan.exportOptions) {
    if (!path.isAbsolute(plan.exportOptions) || !(await stat(plan.exportOptions).catch(() => null))?.isFile() || !plan.exportOptions.endsWith('.plist')) throw new Error('Choose an existing ExportOptions.plist file.');
  }
  return { workspace: root, ...releasePlan({ ...plan, ...build, buildName: plan.buildName || catalog.buildName, buildNumber: plan.buildNumber || catalog.buildNumber }, platform) };
}
