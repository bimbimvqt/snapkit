enum AdMode { off, test, live }

class AdConfig {
  const AdConfig({
    this.mode = AdMode.test,
    this.bannerEnabled = true,
    this.interstitialEnabled = true,
    this.interstitialEvery = 3,
    this.minimumInterstitialInterval = const Duration(minutes: 3),
    this.nonPersonalizedAds = true,
    this.androidBannerAdUnitId = '',
    this.iosBannerAdUnitId = '',
    this.androidInterstitialAdUnitId = '',
    this.iosInterstitialAdUnitId = '',
  });

  factory AdConfig.fromMobile(Map<String, Object?> mobile) {
    final raw = mobile['ads'];
    final ads = raw is Map ? Map<String, Object?>.from(raw) : const <String, Object?>{};
    final legacyMode = _mode(mobile['adMode']);
    return AdConfig(
      mode: _mode(ads['mode'], fallback: legacyMode),
      bannerEnabled: _boolean(ads['bannerEnabled'], true),
      interstitialEnabled: _boolean(ads['interstitialEnabled'], true),
      interstitialEvery: _boundedInt(
        ads['interstitialEvery'] ?? mobile['interstitialEvery'],
        fallback: 3,
        minimum: 1,
        maximum: 20,
      ),
      minimumInterstitialInterval: Duration(
        seconds: _boundedInt(ads['minimumInterstitialIntervalSeconds'], fallback: 180, minimum: 0, maximum: 3600),
      ),
      nonPersonalizedAds: _boolean(ads['nonPersonalizedAds'], true),
      androidBannerAdUnitId: _string(ads['androidBannerAdUnitId']),
      iosBannerAdUnitId: _string(ads['iosBannerAdUnitId']),
      androidInterstitialAdUnitId: _string(ads['androidInterstitialAdUnitId']),
      iosInterstitialAdUnitId: _string(ads['iosInterstitialAdUnitId']),
    );
  }

  final AdMode mode;
  final bool bannerEnabled;
  final bool interstitialEnabled;
  final int interstitialEvery;
  final Duration minimumInterstitialInterval;
  final bool nonPersonalizedAds;
  final String androidBannerAdUnitId;
  final String iosBannerAdUnitId;
  final String androidInterstitialAdUnitId;
  final String iosInterstitialAdUnitId;

  bool allowsAdsFor({required bool isPro}) => !isPro && mode != AdMode.off;

  bool shouldShowInterstitial({required int completedCleanups, required DateTime now, DateTime? lastShownAt}) {
    if (!interstitialEnabled || completedCleanups < interstitialEvery) return false;
    if (lastShownAt == null) return true;
    return now.difference(lastShownAt) >= minimumInterstitialInterval;
  }

  static AdMode _mode(Object? value, {AdMode fallback = AdMode.test}) => switch (value) {
    'off' => AdMode.off,
    'live' => AdMode.live,
    'test' => AdMode.test,
    _ => fallback,
  };

  static bool _boolean(Object? value, bool fallback) => value is bool ? value : fallback;

  static int _boundedInt(Object? value, {required int fallback, required int minimum, required int maximum}) {
    if (value is! num) return fallback;
    return value.toInt().clamp(minimum, maximum);
  }

  static String _string(Object? value) => value is String ? value.trim() : '';
}
