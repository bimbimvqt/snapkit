import path from 'node:path';
import { readFile, mkdir, writeFile, realpath, rename, readdir, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { parse, modify, applyEdits } from 'jsonc-parser';

export async function validateWorkspace(input) {
  if (typeof input !== 'string' || !path.isAbsolute(input)) throw new Error('Enter an absolute Flutter project path');
  const root = await realpath(input);
  const yaml = await readFile(path.join(root, 'pubspec.yaml'), 'utf8').catch(() => '');
  if (!/^\s*flutter\s*:/m.test(yaml)) throw new Error('This folder must contain a Flutter pubspec.yaml');
  return root;
}
export async function workspaceProfiles(root) {
  const raw = await readFile(path.join(root, '.vscode/launch.json'), 'utf8').catch(() => '');
  const config = parse(raw, [], { allowTrailingComma: true });
  const profiles = [];
  for (const entry of Array.isArray(config?.configurations) ? config.configurations : []) {
    if (entry?.type !== 'dart' || entry.request !== 'launch' || (entry.name === 'Snapkit: Active Device' || entry.name?.startsWith('Snapkit: Device · ')) || (entry.flutterMode && entry.flutterMode !== 'debug')) continue;
    const args = [...(Array.isArray(entry.toolArgs) ? entry.toolArgs : []), ...(Array.isArray(entry.args) ? entry.args : [])];
    const flag = name => {
      const index = args.indexOf(name);
      return index >= 0 ? args[index + 1] : args.find(a => typeof a === 'string' && a.startsWith(name + '='))?.slice(name.length + 1);
    };
    const expand = value => typeof value === 'string' ? value.replaceAll('${workspaceFolder}', root) : '';
    profiles.push({ name: String(entry.name || 'Debug'), flavor: flag('--flavor') || '', target: expand(entry.program) || 'lib/main.dart', defineFile: expand(flag('--dart-define-from-file')) });
  }
  const schemes = await readdir(path.join(root, 'ios/Runner.xcodeproj/xcshareddata/xcschemes')).catch(() => []);
  const flavors = [...new Set([...profiles.map(p => p.flavor), ...schemes.filter(s => s.endsWith('.xcscheme') && s !== 'Runner.xcscheme').map(s => s.slice(0, -9))].filter(Boolean))];
  return { profiles, flavors };
}
export async function validateBuild(root, input = {}) {
  root = await realpath(root);
  const text = key => { const value = input[key] ?? ''; if (typeof value !== 'string' || value.length > 4096) throw new Error(`Invalid ${key}`); return value.trim(); };
  const flavor = text('flavor');
  if (flavor && !/^[a-zA-Z0-9_][a-zA-Z0-9_-]{0,127}$/.test(flavor)) throw new Error('Invalid flavor name');
  const target = text('target') || 'lib/main.dart';
  const targetPath = await realpath(path.resolve(root, target)).catch(() => '');
  const relative = path.relative(root, targetPath);
  if (!targetPath || relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative) || !targetPath.endsWith('.dart') || !(await stat(targetPath)).isFile()) throw new Error('Dart entrypoint must be an existing .dart file inside the workspace');
  const defineFile = text('defineFile');
  if (defineFile && !(await stat(path.resolve(root, defineFile)).catch(() => null))?.isFile()) throw new Error('Dart defines file does not exist');
  const { flavors } = await workspaceProfiles(root);
  if (flavors.length && !flavor) throw new Error(`Choose a flavor in Workspace settings: ${flavors.join(', ')}`);
  return { flavor, target, defineFile };
}
export function flutterBuildArgs(options = {}) {
  return [...(options.flavor ? ['--flavor', options.flavor] : []), ...(options.target ? ['--target', options.target] : []), ...(options.defineFile ? ['--dart-define-from-file', options.defineFile] : [])];
}
export const compoundName = 'Snapkit: Selected Devices';
const managed = name => name === 'Snapkit: Active Device' || name?.startsWith('Snapkit: Device · ');
export async function writeTargets(root, devices, options = {}) {
  const folder = path.join(root, '.vscode');
  await mkdir(folder, { recursive: true });
  const file = path.join(folder, 'launch.json');
  let raw;
  try { raw = await readFile(file, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const errors = [];
  const config = raw ? parse(raw, errors, { allowTrailingComma: true }) : { version: '0.2.0', configurations: [] };
  if (errors.length || !config || typeof config !== 'object' || Array.isArray(config)) throw new Error('launch.json is invalid. The existing file has been preserved.');
  for (const key of ['configurations', 'compounds']) if (config[key] !== undefined && !Array.isArray(config[key])) throw new Error(`launch.json ${key} must be an array`);
  const entries = devices.map(device => ({ name: `Snapkit: Device · ${device.name} [${device.id}]`, type: 'dart', request: 'launch', flutterMode: 'debug', deviceId: device.flutterId || device.id, cwd: root, program: options.target || 'lib/main.dart', toolArgs: flutterBuildArgs({ ...options, target: undefined }) }));
  const format = { formattingOptions: { insertSpaces: true, tabSize: 2, eol: raw?.includes('\r\n') ? '\r\n' : '\n' } };
  let output = raw || JSON.stringify(config, null, 2) + '\n';
  // Remove only our generated entries; JSONC edits retain unrelated profiles and comments.
  const list = config.configurations || [];
  for (let i = list.length - 1; i >= 0; i--) if (managed(list[i]?.name)) output = applyEdits(output, modify(output, ['configurations', i], undefined, format));
  if (!config.configurations) output = applyEdits(output, modify(output, ['configurations'], [], format));
  for (let i = entries.length - 1; i >= 0; i--) output = applyEdits(output, modify(output, ['configurations', 0], entries[i], { ...format, isArrayInsertion: true }));
  const compounds = config.compounds || [];
  for (let i = compounds.length - 1; i >= 0; i--) if (compounds[i]?.name === compoundName) output = applyEdits(output, modify(output, ['compounds', i], undefined, format));
  if (!config.compounds) output = applyEdits(output, modify(output, ['compounds'], [], format));
  if (entries.length) output = applyEdits(output, modify(output, ['compounds', 0], { name: compoundName, configurations: entries.map(e => e.name), stopAll: true }, { ...format, isArrayInsertion: true }));
  if (raw) await writeFile(`${file}.snapkit.bak`, raw);
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, output); await rename(temporary, file);
  return file;
}
