import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('VSIX contains readable guides, changelog and the shared app icon declared in its manifest', async () => {
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
    assert z.read('extension/icon.png') == Path('desktop/assets/icon.png').read_bytes()
    manifest = ET.fromstring(z.read('extension.vsixmanifest'))
    assets = {a.attrib['Type']: a.attrib['Path'] for a in manifest.iter() if a.tag.endswith('Asset')}
    for kind in ['Microsoft.VisualStudio.Services.Content.Details', 'Microsoft.VisualStudio.Services.Content.Changelog', 'Microsoft.VisualStudio.Services.Icons.Default']:
        assert assets[kind] in names, kind
    for file in ['README.md', 'README.vi.md', 'CHANGELOG.md', 'SUPPORT.md']:
        text = z.read('extension/' + file).decode('utf-8')
        assert len(text) > 200, file
        for target in re.findall(r'\\]\\(([^)]+)\\)', text):
            if '://' not in target and not target.startswith('#'):
                assert 'extension/' + target.split('#')[0] in names, target
    assert package['version'] in z.read('extension/CHANGELOG.md').decode('utf-8')
    assert '1.3.1' in z.read('extension/README.md').decode('utf-8')
`, file]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
