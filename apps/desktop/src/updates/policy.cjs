'use strict';
const REPO = 'bimbimvqt/snapkit';
function parseVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-(beta|rc)\.(\d+))?$/.exec(value || '');
  if (!match) throw Error('Invalid release version.');
  return [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === 'beta' ? 0 : match[4] === 'rc' ? 1 : 2, Number(match[5] || 0)];
}
function newer(a, b) { const left = parseVersion(a), right = parseVersion(b); for (let i = 0; i < left.length; i++) { if (left[i] !== right[i]) return left[i] > right[i]; } return false; }
function selectRelease(releases, current, platform, arch) {
  if (!['darwin', 'win32'].includes(platform) || !['arm64', 'x64'].includes(arch) || platform === 'win32' && arch !== 'x64') return null;
  const candidates = [];
  for (const release of releases) {
    const version = String(release.tag_name || '').replace(/^v/, '');
    try { if (release.draft || !newer(version, current) || (!current.includes('-') && (release.prerelease || version.includes('-')))) continue; } catch { continue; }
    const name = `Snapkit-${version}-${platform === 'darwin' ? 'mac' : 'win'}-${arch}.${platform === 'darwin' ? 'zip' : 'exe'}`;
    const asset = release.assets?.find(item => item.name === name);
    if (!asset || !/^sha256:[a-f0-9]{64}$/.test(asset.digest || '') || !Number.isSafeInteger(asset.size) || asset.size <= 0 || asset.size > 1024 ** 3) continue;
    const expected = `https://github.com/${REPO}/releases/download/${release.tag_name}/${name}`;
    if (asset.browser_download_url !== expected) continue;
    candidates.push({ version, name, url: expected, size: asset.size, sha256: asset.digest.slice(7), releaseUrl: `https://github.com/${REPO}/releases/tag/${release.tag_name}` });
  }
  candidates.sort((a, b) => newer(a.version, b.version) ? -1 : newer(b.version, a.version) ? 1 : 0);
  return candidates[0] || null;
}
function downloadURL(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !(['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'].includes(url.hostname))) throw Error('Untrusted update download URL.');
  if (url.hostname === 'github.com' && !url.pathname.startsWith(`/${REPO}/releases/download/`)) throw Error('Invalid update repository.');
  return url;
}
function archiveEntries(text) {
  const entries = text.trim().split('\n');
  if (!entries.length || entries.some(name => !name || name.startsWith('/') || name.includes('\\') || name.split('/').some(part => part === '..') || (!name.startsWith('Snapkit.app/') && name !== 'Snapkit.app' && !name.startsWith('__MACOSX/')))) throw Error('Invalid update archive.');
}
module.exports = { REPO, parseVersion, newer, selectRelease, downloadURL, archiveEntries };
