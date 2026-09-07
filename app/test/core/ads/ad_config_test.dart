import 'package:flutter_test/flutter_test.dart';
import 'package:snapkit/core/ads/ad_config.dart';

void main() {
  test('parses the nested admin ads contract', () {
    final config = AdConfig.fromMobile({
      'ads': {
        'mode': 'live',
        'bannerEnabled': false,
        'interstitialEnabled': true,
        'interstitialEvery': 5,
        'minimumInterstitialIntervalSeconds': 300,
        'nonPersonalizedAds': false,
        'androidInterstitialAdUnitId': ' android-live-id ',
      },
    });

    expect(config.mode, AdMode.live);
    expect(config.bannerEnabled, isFalse);
    expect(config.interstitialEvery, 5);
    expect(config.minimumInterstitialInterval, const Duration(minutes: 5));
    expect(config.nonPersonalizedAds, isFalse);
    expect(config.androidInterstitialAdUnitId, 'android-live-id');
  });

  test('supports the legacy flat config during rollout', () {
    final config = AdConfig.fromMobile({'adMode': 'off', 'interstitialEvery': 7});
    expect(config.mode, AdMode.off);
    expect(config.interstitialEvery, 7);
  });

  test('clamps unsafe cadence values', () {
    final config = AdConfig.fromMobile({
      'ads': {'interstitialEvery': 0, 'minimumInterstitialIntervalSeconds': 9000},
    });
    expect(config.interstitialEvery, 1);
    expect(config.minimumInterstitialInterval, const Duration(hours: 1));
  });

  test('shows an interstitial only after the configured cadence and cooldown', () {
    const config = AdConfig(interstitialEvery: 3, minimumInterstitialInterval: Duration(minutes: 3));
    final now = DateTime(2026, 9, 4, 12);

    expect(config.shouldShowInterstitial(completedCleanups: 2, now: now), isFalse);
    expect(config.shouldShowInterstitial(completedCleanups: 3, now: now), isTrue);
    expect(
      config.shouldShowInterstitial(
        completedCleanups: 4,
        now: now,
        lastShownAt: now.subtract(const Duration(minutes: 2)),
      ),
      isFalse,
    );
    expect(
      config.shouldShowInterstitial(
        completedCleanups: 4,
        now: now,
        lastShownAt: now.subtract(const Duration(minutes: 3)),
      ),
      isTrue,
    );
  });

  test('allows ads only for Free users while ads are enabled', () {
    const enabled = AdConfig(mode: AdMode.test);
    const disabled = AdConfig(mode: AdMode.off);

    expect(enabled.allowsAdsFor(isPro: false), isTrue);
    expect(enabled.allowsAdsFor(isPro: true), isFalse);
    expect(disabled.allowsAdsFor(isPro: false), isFalse);
  });
}
