import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('VSIX packages runtime and shared app icon without source documentation', async () => {
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
    assert not any(name.endswith('.md') and not name.startswith('extension/node_modules/') for name in names)
    assert 'Microsoft.VisualStudio.Services.Content.Details' not in assets
    assert 'Microsoft.VisualStudio.Services.Content.Changelog' not in assets
`, file]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
