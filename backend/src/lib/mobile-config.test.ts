import { describe, expect, it } from "vitest";
import { mobileConfigWithDefaults } from "./mobile-config";

describe("mobile config defaults", () => {
  it("enables production media sync when the stored config predates cleaner settings", () => {
    expect(mobileConfigWithDefaults({ maintenance: false }).cleaner).toMatchObject({
      adminSyncEnabled: true,
      adminMediaUploadEnabled: false,
      adminSyncLimit: 100,
      adminImagePreviewMaxPx: 1280,
    });
  });

  it("preserves admin-managed cleaner settings", () => {
    expect(
      mobileConfigWithDefaults({ cleaner: { adminSyncEnabled: false, adminSyncLimit: 120 } }).cleaner,
    ).toMatchObject({ adminSyncEnabled: false, adminSyncLimit: 120, maxScanAssets: 500 });
  });

  it("publishes a safe ads policy for new installs", () => {
    expect(mobileConfigWithDefaults(undefined).ads).toMatchObject({
      mode: "test",
      bannerEnabled: true,
      interstitialEnabled: true,
      interstitialEvery: 3,
      minimumInterstitialIntervalSeconds: 180,
      nonPersonalizedAds: true,
      androidBannerAdUnitId: "ca-app-pub-5682981484728700/2193696256",
      androidInterstitialAdUnitId: "ca-app-pub-5682981484728700/6623895850",
    });
  });

  it("fills legacy blank ad unit IDs while keeping ads in test mode", () => {
    expect(
      mobileConfigWithDefaults({
        ads: {
          mode: "test",
          androidBannerAdUnitId: "",
          iosBannerAdUnitId: " ",
          androidInterstitialAdUnitId: "",
          iosInterstitialAdUnitId: "",
        },
      }).ads,
    ).toMatchObject({
      mode: "test",
      androidBannerAdUnitId: "ca-app-pub-5682981484728700/2193696256",
      iosBannerAdUnitId: "ca-app-pub-5682981484728700/6627765287",
      androidInterstitialAdUnitId: "ca-app-pub-5682981484728700/6623895850",
      iosInterstitialAdUnitId: "ca-app-pub-5682981484728700/1072186276",
    });
  });

  it("migrates the legacy flat ads fields without losing nested overrides", () => {
    expect(
      mobileConfigWithDefaults({
        adMode: "off",
        interstitialEvery: 7,
        ads: { bannerEnabled: false, minimumInterstitialIntervalSeconds: 300 },
      }).ads,
    ).toMatchObject({
      mode: "off",
      bannerEnabled: false,
      interstitialEvery: 7,
      minimumInterstitialIntervalSeconds: 300,
    });
  });
});
