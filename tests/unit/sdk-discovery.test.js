import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discoverSDKs } from '../../apps/agent/src/infrastructure/tooling/sdk-discovery.js';

const probe = (files, options = {}) => discoverSDKs({ platform: 'darwin', home: '/Users/test', env: {}, mounts: ['/Volumes/External SSD'], directories: () => [], realpath: value => value, isFile: value => files.includes(value), ...options });
test('GUI launch without shell PATH discovers Flutter and Android on an external SSD', () => {
  assert.deepEqual(probe(['/Volumes/External SSD/flutter/bin/flutter', '/Volumes/External SSD/Android/sdk/platform-tools/adb']), { flutterSDK: '/Volumes/External SSD/flutter', androidSDK: '/Volumes/External SSD/Android/sdk' });
});
test('valid environment and PATH SDKs take precedence over external candidates', () => {
  assert.equal(probe(['/custom/bin/flutter', '/Volumes/External SSD/flutter/bin/flutter'], { env: { FLUTTER_ROOT: '/custom' } }).flutterSDK, '/custom');
  assert.equal(probe(['/custom/bin/flutter', '/shell/flutter', '/Volumes/External SSD/flutter/bin/flutter'], { env: { PATH: '/shell' }, realpath: () => '/custom/bin/flutter' }).flutterSDK, '/custom');
});
test('stale SDK environment and unmounted drives do not count as installed tools', () => {
  assert.equal(probe(['/Volumes/External SSD/Android/sdk/platform-tools/adb'], { env: { ANDROID_HOME: '/missing' } }).androidSDK, '/Volumes/External SSD/Android/sdk');
  assert.deepEqual(probe([]), { flutterSDK: '', androidSDK: '' });
});
test('FVM SDK and standard Linux Android layout are detected', () => {
  assert.equal(probe(['/Users/test/fvm/versions/3.35.0/bin/flutter'], { directories: value => value === '/Users/test/fvm/versions' ? ['/Users/test/fvm/versions/3.35.0'] : [] }).flutterSDK, '/Users/test/fvm/versions/3.35.0');
  assert.equal(probe(['/home/test/Android/Sdk/platform-tools/adb'], { platform: 'linux', home: '/home/test', mounts: [] }).androidSDK, '/home/test/Android/Sdk');
});
test('Windows drives use native paths and launcher extensions', () => {
  assert.deepEqual(probe(['D:\\flutter\\bin\\flutter.bat', 'D:\\Android\\sdk\\platform-tools\\adb.exe'], { platform: 'win32', home: 'C:\\Users\\test', mounts: ['D:\\'] }), { flutterSDK: 'D:\\flutter', androidSDK: 'D:\\Android\\sdk' });
});
test('default discovery never enumerates or probes unrequested mounted disks', () => {
  const visited=[];
  discoverSDKs({platform:'darwin',home:'/Users/test',env:{},directories:value=>{visited.push(value);return [];},isFile:value=>{visited.push(value);return false;}});
  assert.equal(visited.some(value=>value.startsWith('/Volumes')),false);
  assert.equal(probe(['/Volumes/External SSD/flutter/bin/flutter']).flutterSDK,'/Volumes/External SSD/flutter');
});
