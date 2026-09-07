export const defaultCleanerConfig = {
  maxScanAssets: 500,
  similarImageLimit: 180,
  largeVideoThresholdMb: 100,
  adminSyncEnabled: true,
  adminMediaUploadEnabled: false,
  adminSyncLimit: 100,
  adminImagePreviewMaxPx: 1280,
  adminPreviewMaxFileMb: 50,
} as const;

export const defaultAdsConfig = {
  mode: "test",
  bannerEnabled: true,
  interstitialEnabled: true,
  interstitialEvery: 3,
  minimumInterstitialIntervalSeconds: 180,
  nonPersonalizedAds: true,
  androidBannerAdUnitId: "ca-app-pub-5682981484728700/2193696256",
  iosBannerAdUnitId: "ca-app-pub-5682981484728700/6627765287",
  androidInterstitialAdUnitId: "ca-app-pub-5682981484728700/6623895850",
  iosInterstitialAdUnitId: "ca-app-pub-5682981484728700/1072186276",
} as const;

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function mobileConfigWithDefaults(value: unknown) {
  const mobile = record(value);
  const storedAds = record(mobile.ads);
  const legacyMode = mobile.adMode === "off" || mobile.adMode === "test" || mobile.adMode === "live"
    ? mobile.adMode
    : defaultAdsConfig.mode;
  const legacyInterstitialEvery = typeof mobile.interstitialEvery === "number"
    ? mobile.interstitialEvery
    : defaultAdsConfig.interstitialEvery;
  return {
    maintenance: false,
    ...mobile,
    cleaner: { ...defaultCleanerConfig, ...record(mobile.cleaner) },
    ads: {
      ...defaultAdsConfig,
      mode: legacyMode,
      interstitialEvery: legacyInterstitialEvery,
      ...storedAds,
      androidBannerAdUnitId: configuredAdUnitId(storedAds.androidBannerAdUnitId, defaultAdsConfig.androidBannerAdUnitId),
      iosBannerAdUnitId: configuredAdUnitId(storedAds.iosBannerAdUnitId, defaultAdsConfig.iosBannerAdUnitId),
      androidInterstitialAdUnitId: configuredAdUnitId(
        storedAds.androidInterstitialAdUnitId,
        defaultAdsConfig.androidInterstitialAdUnitId,
      ),
      iosInterstitialAdUnitId: configuredAdUnitId(
        storedAds.iosInterstitialAdUnitId,
        defaultAdsConfig.iosInterstitialAdUnitId,
      ),
    },
  };
}

function configuredAdUnitId(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
