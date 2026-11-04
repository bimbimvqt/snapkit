export const versionCode = value => String(value).split('.').slice(0, 3).reduce((n, part, i) => n + Number(part) * [65536, 256, 1][i], 0);
export function iosCompatible(model, runtime, arch) {
  if (model.unsupported || !runtime.isAvailable) return false;
  if (runtime.supportedArchitectures?.length && !runtime.supportedArchitectures.includes(arch === 'x64' ? 'x86_64' : arch)) return false;
  const code = versionCode(runtime.version);
  if (code < (model.minRuntimeVersion ?? 0) || code > (model.maxRuntimeVersion ?? Infinity)) return false;
  if (runtime.supportedDeviceTypes?.length && !runtime.supportedDeviceTypes.some(d => d.identifier === model.identifier)) return false;
  return true;
}
export function parseIOSDownloads(index, { arch, xcodeVersion, hostVersion }) {
  const cpu = arch === 'x64' ? 'x86_64' : arch;
  return (index.downloadables || []).filter(item => {
    if (item.platform !== 'com.apple.platform.iphoneos' || !/^\d+\.\d+(\.\d+)?$/.test(item.simulatorVersion?.version || '')) return false;
    if (/beta|release candidate|\bRC\b|seed/i.test(item.name || '')) return false;
    if (item.architectures?.length && !item.architectures.includes(cpu)) return false;
    const requirements = item.hostRequirements || {};
    for (const [value, min, max] of [[xcodeVersion, requirements.minXcodeVersion, requirements.maxXcodeVersion], [hostVersion, requirements.minHostVersion, requirements.maxHostVersion]]) {
      if (min && versionCode(value) < versionCode(min)) return false;
      if (max && versionCode(value) > versionCode(max)) return false;
    }
    return true;
  }).map(item => ({ id: item.identifier, name: item.name, version: item.simulatorVersion.version, build: item.simulatorVersion.buildUpdate,
    bytes: item.fileSize || null, authentication: item.authentication === 'virtual' }))
    .sort((a, b) => versionCode(b.version) - versionCode(a.version));
}
export function parseAndroidProfiles(raw) {
  return raw.split(/(?=^id:\s*\d+)/m).flatMap(block => {
    const id = /^id:\s*\d+\s+or\s+"([^"]+)"/m.exec(block)?.[1];
    const name = /^\s*Name:\s*(.+)$/m.exec(block)?.[1]?.trim();
    const tag = /^\s*Tag\s*:\s*(.+)$/m.exec(block)?.[1]?.trim();
    return id && name && (!tag || /^(google_apis|google_apis_playstore|default)$/.test(tag)) ? [{ id, name, tag: tag || null }] : [];
  });
}
const androidNames = { 23: '6', 24: '7', 25: '7.1', 26: '8', 27: '8.1', 28: '9', 29: '10', 30: '11', 31: '12', 32: '12L', 33: '13', 34: '14', 35: '15', 36: '16', 37: '17' };
export function parseAndroidImages(raw, arch) {
  const images = new Map(); let installed = false;
  for (const line of raw.split(/\r?\n/)) {
    if (/^Installed packages:/i.test(line.trim())) installed = true;
    if (/^(Available Packages|Available Updates):/i.test(line.trim())) installed = false;
    const id = line.split('|')[0].trim();
    const m = /^system-images;android-(\d+)[^;]*;(google_apis(?:_playstore)?(?:_ps16k)?|default);(arm64-v8a|x86_64)$/.exec(id);
    if (!m || m[3] !== (arch === 'arm64' ? 'arm64-v8a' : 'x86_64')) continue;
    const previous = images.get(id);
    images.set(id, { id, api: Number(m[1]), name: `Android ${androidNames[m[1]] || `API ${m[1]}`} · API ${m[1]} · ${m[2]} · ${m[3]}`, tag: m[2], abi: m[3], installed: installed || previous?.installed || false });
  }
  return [...images.values()].sort((a, b) => b.api - a.api || a.name.localeCompare(b.name));
}
export const androidCompatible = (profile, image) => !profile.tag || profile.tag === image.tag || image.tag.startsWith(profile.tag + '_') || (profile.tag === 'google_apis' && image.tag.startsWith('google_apis'));

