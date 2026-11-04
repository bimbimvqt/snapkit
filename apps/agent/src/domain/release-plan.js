// Plans contain argument arrays only. User input never becomes a shell command.
export function projectVersion(source) {
  const match = /^version:[ \t]*(?:"([^"\n]+)"|'([^'\n]+)'|([^\s#]+))/m.exec(source);
  const version = (match?.[1] || match?.[2] || match?.[3] || '').trim();
  const [buildName = '', buildNumber = ''] = version.split('+');
  return { version, buildName, buildNumber };
}
export function releasePlan(input, platform) {
  const format = input.format;
  if (!['apk', 'aab', 'ipa'].includes(format)) throw new Error('Choose APK, AAB or TestFlight IPA.');
  if (format === 'ipa' && platform !== 'darwin') throw new Error('TestFlight builds require macOS and Xcode.');
  const text = name => {
    const value = input[name] ?? '';
    if (typeof value !== 'string' || value.length > 4096 || /[\x00-\x1f]/.test(value)) throw new Error(`Invalid ${name}`);
    return value.trim();
  };
  const flavor = text('flavor'), target = text('target') || 'lib/main.dart', defineFile = text('defineFile');
  const purpose = text('purpose') || 'ipa';
  if (!['ipa', 'testflight'].includes(purpose)) throw Error('Choose IPA or TestFlight preparation.');
  const buildName = text('buildName'), buildNumber = text('buildNumber'), exportOptions = text('exportOptions');
  if (flavor && !/^[a-zA-Z0-9_][a-zA-Z0-9_-]{0,127}$/.test(flavor)) throw new Error('Invalid flavor name');
  if (buildName && !/^\d+\.\d+\.\d+$/.test(buildName)) throw new Error('Use a version such as 1.2.0.');
  if (buildNumber && !/^[1-9]\d{0,8}$/.test(buildNumber)) throw new Error('Build number must be a positive integer of up to 9 digits.');
  const args = ['build', { apk: 'apk', aab: 'appbundle', ipa: 'ipa' }[format], '--release',
    ...(flavor ? ['--flavor', flavor] : []), '--target', target,
    ...(defineFile ? ['--dart-define-from-file', defineFile] : []),
    ...(buildName ? ['--build-name', buildName] : []), ...(buildNumber ? ['--build-number', buildNumber] : []),
    ...(format === 'ipa' ? exportOptions ? ['--export-options-plist', exportOptions] : ['--export-method', 'app-store'] : [])];
  return { format, purpose: format === 'ipa' ? purpose : '', flavor, target, defineFile, buildName, buildNumber, exportOptions: format === 'ipa' ? exportOptions : '', command: 'flutter', args };
}
export function testFlightIdentity(input) {
  const keyPathName = String(input.keyPath || '').split(/[\\/]/).at(-1);
  const keyId = (typeof input.keyId === 'string' ? input.keyId.trim() : '') || /^AuthKey_([A-Z0-9]{10})\.p8$/.exec(keyPathName)?.[1] || '';
  const issuerId = typeof input.issuerId === 'string' ? input.issuerId.trim() : '';
  const keyPath = typeof input.keyPath === 'string' ? input.keyPath.trim() : '';
  if (!/^[A-Z0-9]{10}$/.test(keyId) || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(issuerId)) throw new Error('Enter a valid App Store Connect Key ID and Issuer ID.');
  if (!keyPath || /[\x00-\x1f]/.test(keyPath)) throw new Error('Choose your App Store Connect .p8 file.');
  return { keyId, issuerId, keyPath };
}
export function redactBuildLog(value) {
  return String(value).replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-]*PRIVATE KEY-----|$)/g, '[private key redacted]')
    .replace(/(Bearer\s+)\S+/gi, '$1[redacted]')
    .replace(/((?:password|secret|api[_-]?key|access[_-]?token|authorization)\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]');
}

// Device metadata comes from discovery, never from renderer-provided names/platforms.
export function runReleasePlan(plan, device, platform) {
  if (!device || device.group !== 'physical' || device.state !== 'online' || !device.flutterId || !['android', 'ios'].includes(device.platform)) throw Error('Choose a connected physical Android or iOS device.');
  if (device.platform === 'ios' && platform !== 'darwin') throw Error('Running on iPhone requires macOS and Xcode.');
  if (typeof device.flutterId !== 'string' || device.flutterId.startsWith('-') || /[\x00-\x20]/.test(device.flutterId)) throw Error('Invalid device identifier. Refresh devices.');
  const { flavor, target, defineFile } = plan;
  return { ...plan, operation: 'run', purpose: '', exportOptions: '', device: { id: device.id, flutterId: device.flutterId, name: device.name, platform: device.platform },
    args: ['run', '--release', '--no-resident', '--device-id', device.flutterId,
      ...(flavor ? ['--flavor', flavor] : []), '--target', target,
      ...(defineFile ? ['--dart-define-from-file', defineFile] : [])] };
}
