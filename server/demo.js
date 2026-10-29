export const demoDevices = [
  { id: 'demo-ios-1', name: 'iPhone 16 Pro', group: 'ios', platform: 'ios', os: 'iOS 18.2', state: 'online', flutterId: 'demo-ios-1', ram: null, cpu: null, resolution: '1206 × 2622' },
  { id: 'demo-android-1', name: 'Pixel 9 Pro', group: 'android', platform: 'android', os: 'Android 15 · API 35', state: 'online', flutterId: 'emulator-5554', avd: 'Pixel_9_Pro', ram: '4 GB', cpu: '4 cores', resolution: '1280 × 2856' },
  { id: 'demo-physical-1', name: 'iPhone 15', group: 'physical', platform: 'ios', os: 'iOS 18.1', state: 'online', flutterId: 'demo-physical-1', ram: null, cpu: null, resolution: '1179 × 2556' },
  { id: 'demo-ios-2', name: 'iPad Air 13-inch', group: 'ios', platform: 'ios', os: 'iPadOS 18.2', state: 'offline', ram: null, cpu: null, resolution: '2048 × 2732' },
  { id: 'demo-android-2', name: 'Pixel 8', group: 'android', platform: 'android', os: 'Android 14 · API 34', state: 'offline', avd: 'Pixel_8', ram: '2 GB', cpu: '4 cores', resolution: '1080 × 2400' },
  { id: 'demo-ios-3', name: 'iPhone SE (3rd gen)', group: 'ios', platform: 'ios', os: 'iOS 17.5', state: 'offline', ram: null, cpu: null, resolution: '750 × 1334' }
];

export const demoCatalog = {
  platform: 'darwin', arch: 'arm64', warnings: [], downloads: [],
  ios: {
    models: [
      { id: 'demo:iphone16', name: 'iPhone 16 Pro', runtimeIds: ['demo:ios18'], reason: 'No compatible runtime installed' },
      { id: 'demo:iphone17', name: 'iPhone 17 Pro', runtimeIds: ['demo:ios26'], reason: 'No compatible runtime installed' },
      { id: 'legacy:iphone-5', name: 'iPhone 5 (legacy, 32-bit)', runtimeIds: [], unsupported: true, reason: 'iPhone 5 requires legacy iOS 6–10 / 32-bit tooling. This Xcode and current Flutter do not support it.' }
    ],
    runtimes: [{ id: 'demo:ios18', name: 'iOS 18.2', version: '18.2', available: true }, { id: 'demo:ios26', name: 'iOS 26.1', version: '26.1', available: true }]
  },
  android: {
    models: [{ id: 'pixel_9', name: 'Pixel 9', imageIds: ['system-images;android-35;google_apis;arm64-v8a', 'system-images;android-34;google_apis;arm64-v8a'] }],
    images: [
      { id: 'system-images;android-35;google_apis;arm64-v8a', name: 'Android 15 · API 35 · google_apis · arm64-v8a', api: 35, installed: true },
      { id: 'system-images;android-34;google_apis;arm64-v8a', name: 'Android 14 · API 34 · google_apis · arm64-v8a', api: 34, installed: false }
    ]
  }
};
