import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, mkdir, cp, readFile, writeFile, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('VSIX packages runtime and shared app icon with versioned Details and Changelog', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'snapkit-vsix-'));
  const file = path.join(dir, 'extension.vsix');
  const python = process.platform === 'win32' ? 'python' : 'python3';
  try {
    execFileSync(python, ['scripts/package-ide-extension.py', file]);
    execFileSync(python, ['-c', `
import json, re, sys
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET
with ZipFile(sys.argv[1]) as z:
    names = set(z.namelist())
    package = json.loads(z.read('extension/package.json'))
    assert package['icon'] == 'icon.png'
    for file in ['react-native-debug.cjs', 'react-native-runtime.cjs', 'react-native-transport.cjs', 'node_modules/ws/index.js', 'node_modules/ws/lib/websocket.js', 'node_modules/ws/LICENSE']:
        assert 'extension/' + file in names, file
    assert package['dependencies']['ws']
    assert z.read('extension/icon.png') == Path('apps/desktop/assets/icon.png').read_bytes()
    manifest = ET.fromstring(z.read('extension.vsixmanifest'))
    assets = {a.attrib['Type']: a.attrib['Path'] for a in manifest.iter() if a.tag.endswith('Asset')}
    assert assets['Microsoft.VisualStudio.Services.Icons.Default'] in names
    assert assets['Microsoft.VisualStudio.Services.Content.Details'] == 'extension/README.md'
    assert assets['Microsoft.VisualStudio.Services.Content.Changelog'] == 'extension/CHANGELOG.md'
    assert ("What's new in " + package['version']) in z.read('extension/README.md').decode()
    assert ('## ' + package['version']) in z.read('extension/CHANGELOG.md').decode()
`, file]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});


test('packaging rejects a version bump until both Details and Changelog are updated', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'snapkit-vsix-version-'));
  const python = process.platform === 'win32' ? 'python' : 'python3';
  try {
    await mkdir(path.join(dir, 'scripts'), {recursive:true});
    await mkdir(path.join(dir, 'apps/desktop/assets'), {recursive:true});
    await cp('scripts/package-ide-extension.py', path.join(dir, 'scripts/package-ide-extension.py'));
    await cp('apps/ide-extension', path.join(dir, 'apps/ide-extension'), {recursive:true});
    await cp('apps/desktop/assets/icon.png', path.join(dir, 'apps/desktop/assets/icon.png'));
    await symlink(path.resolve('node_modules'), path.join(dir, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    const file=path.join(dir,'apps/ide-extension/package.json'),pkg=JSON.parse(await readFile(file,'utf8'));
    pkg.version='99.0.0'; await writeFile(file,JSON.stringify(pkg));
    const run=()=>execFileSync(python,[path.join(dir,'scripts/package-ide-extension.py'),path.join(dir,'extension.vsix')],{stdio:'pipe'});
    let error;try{run();}catch(e){error=e;}if(!error)throw Error('Stale README was accepted');
    if(!String(error.stderr).includes('README.md'))throw error;
    await writeFile(path.join(dir,'apps/ide-extension/README.md'),"What's new in 99.0.0");
    error=null;try{run();}catch(e){error=e;}if(!error)throw Error('Missing changelog was accepted');
    if(!String(error.stderr).includes('CHANGELOG.md'))throw error;
    await writeFile(path.join(dir,'apps/ide-extension/CHANGELOG.md'),'## 99.0.0\n\n- Release notes.\n');
    run();
  } finally { await rm(dir,{recursive:true,force:true}); }
});
