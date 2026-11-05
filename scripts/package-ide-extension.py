"""Package the local IDE extension without downloading build dependencies."""
import json
import sys
from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile

source = Path(__file__).resolve().parents[1] / 'apps/ide-extension'
dependency = source.parents[1] / 'node_modules/ws'
if not (dependency / 'package.json').is_file():
    raise SystemExit('Missing ws dependency; run npm ci before packaging')
package = json.loads((source / 'package.json').read_text())
# Always package the shared desktop icon; a stale extension copy cannot drift.
(source / 'icon.png').write_bytes((source.parent / 'desktop/assets/icon.png').read_bytes())
output = Path(sys.argv[1] if len(sys.argv) > 1 else 'snapkit-debug-sync.vsix').resolve()
manifest = f'''<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
<Metadata><Identity Language="en-US" Id="{package['name']}" Version="{package['version']}" Publisher="{package['publisher']}"/>
<DisplayName>{escape(package['displayName'])}</DisplayName><Description xml:space="preserve">{escape(package['description'])}</Description>
<Icon>extension/icon.png</Icon><Tags>flutter,debug,simulator,emulator,snapkit</Tags><Categories>Debuggers</Categories><GalleryFlags>Public</GalleryFlags>
<Properties><Property Id="Microsoft.VisualStudio.Services.Links.Source" Value="https://github.com/bimbimvqt/snapkit"/><Property Id="Microsoft.VisualStudio.Services.Links.Support" Value="https://github.com/bimbimvqt/snapkit/issues"/><Property Id="Microsoft.VisualStudio.Services.Branding.Color" Value="#101214"/><Property Id="Microsoft.VisualStudio.Services.Branding.Theme" Value="dark"/><Property Id="Microsoft.VisualStudio.Code.Engine" Value="{package['engines']['vscode']}"/></Properties></Metadata>
<Installation><InstallationTarget Id="Microsoft.VisualStudio.Code"/></Installation><Dependencies/>
<Assets>
<Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/>
<Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true"/>
<Asset Type="Microsoft.VisualStudio.Services.Content.Changelog" Path="extension/CHANGELOG.md" Addressable="true"/>
<Asset Type="Microsoft.VisualStudio.Services.Icons.Default" Path="extension/icon.png" Addressable="true"/>
</Assets>
</PackageManifest>'''
with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
    archive.writestr('extension.vsixmanifest', manifest)
    archive.writestr('[Content_Types].xml', '''<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="md" ContentType="text/markdown"/><Default Extension="png" ContentType="image/png"/><Default Extension="json" ContentType="application/json"/><Default Extension="js" ContentType="application/javascript"/><Default Extension="mjs" ContentType="application/javascript"/><Default Extension="cjs" ContentType="application/javascript"/><Default Extension="vsixmanifest" ContentType="text/xml"/></Types>''')
    for name in ('package.json', 'extension.cjs', 'dashboard-debug.cjs', 'session-control.cjs', 'react-native-debug.cjs', 'react-native-runtime.cjs', 'react-native-transport.cjs', 'README.md', 'README.vi.md', 'CHANGELOG.md', 'SUPPORT.md', 'icon.png'):
        archive.write(source / name, f'extension/{name}')
    for item in dependency.rglob('*'):
        if item.is_file():
            archive.write(item, 'extension/node_modules/ws/' + item.relative_to(dependency).as_posix())
print(output)
