export const defaultCleanerConfig = {
  maxScanAssets: 500,
  similarImageLimit: 180,
  largeVideoThresholdMb: 100,
  adminSyncEnabled: true,
  adminSyncLimit: 500,
  adminImagePreviewMaxPx: 1920,
  adminPreviewMaxFileMb: 512,
} as const;

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function mobileConfigWithDefaults(value: unknown) {
  const mobile = record(value);
  return {
    maintenance: false,
    adMode: "test",
    interstitialEvery: 3,
    ...mobile,
    cleaner: { ...defaultCleanerConfig, ...record(mobile.cleaner) },
  };
}
