import path from 'node:path';
import { readFile, mkdir, writeFile, realpath, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { parse, modify, applyEdits } from 'jsonc-parser';

export async function validateWorkspace(input) {
  if (typeof input !== 'string' || !path.isAbsolute(input)) throw new Error('Enter an absolute Flutter project path');
  const root = await realpath(input);
  const yaml = await readFile(path.join(root, 'pubspec.yaml'), 'utf8').catch(() => '');
  if (!/^\s*flutter\s*:/m.test(yaml)) throw new Error('This folder must contain a Flutter pubspec.yaml');
  return root;
}
export async function writeLaunch(root, device) {
  const folder = path.join(root, '.vscode');
  await mkdir(folder, { recursive: true });
  const file = path.join(folder, 'launch.json');
  let raw;
  try { raw = await readFile(file, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const errors = [];
  const config = raw ? parse(raw, errors, { allowTrailingComma: true }) : { version: '0.2.0', configurations: [] };
  if (errors.length || !config || typeof config !== 'object' || Array.isArray(config)) throw new Error('launch.json is invalid. The existing file has been preserved.');
  if (config.configurations !== undefined && !Array.isArray(config.configurations)) throw new Error('launch.json configurations must be an array');
  const entry = { name: 'Snapkit: Active Device', type: 'dart', request: 'launch', deviceId: device.flutterId || device.id, cwd: root };
  let output;
  if (!raw) output = JSON.stringify({ ...config, configurations: [entry] }, null, 2) + '\n';
  else {
    const format = { formattingOptions: { insertSpaces: true, tabSize: 2, eol: raw.includes('\r\n') ? '\r\n' : '\n' } };
    const list = config.configurations || [];
    const index = list.findIndex(c => c?.name === entry.name);
    output = raw;
    if (!config.configurations) output = applyEdits(output, modify(output, ['configurations'], [entry], format));
    else if (index >= 0) output = applyEdits(output, modify(output, ['configurations', index], entry, format));
    else output = applyEdits(output, modify(output, ['configurations', 0], entry, { ...format, isArrayInsertion: true }));
    await writeFile(`${file}.snapkit.bak`, raw);
  }
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, output);
  await rename(temporary, file);
  return file;
}
