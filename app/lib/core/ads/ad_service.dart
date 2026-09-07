import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../features/auth/application/auth_controller.dart';
import '../config/remote_config.dart';
import 'ad_config.dart';

class AdService {
  AdService({
    required AdConfig Function() config,
    required bool Function() isPro,
    Future<bool> Function()? isInterstitialRewardActive,
  }) : _config = config,
       _isPro = isPro,
       _isInterstitialRewardActive = isInterstitialRewardActive ?? _inactiveReward;

  static const String _androidTestBannerId = 'ca-app-pub-3940256099942544/6300978111';
  static const String _iosTestBannerId = 'ca-app-pub-3940256099942544/2934735716';
  static const String _androidTestInterstitialId = 'ca-app-pub-3940256099942544/1033173712';
  static const String _iosTestInterstitialId = 'ca-app-pub-3940256099942544/4411468910';
  static const String _completedCleanupsKey = 'ads.completed_cleanups_since_interstitial';
  static const String _lastInterstitialAtKey = 'ads.last_interstitial_at';

  final AdConfig Function() _config;
  final bool Function() _isPro;
  final Future<bool> Function() _isInterstitialRewardActive;
  Future<bool>? _adsInitialization;
  bool _interstitialBusy = false;

  bool get canShowBanner {
    final config = _config();
    return _isSupportedPlatform &&
        config.allowsAdsFor(isPro: _isPro()) &&
        config.bannerEnabled &&
        bannerAdUnitId != null;
  }

  bool get _canShowInterstitial {
    final config = _config();
    return _isSupportedPlatform &&
        config.allowsAdsFor(isPro: _isPro()) &&
        config.interstitialEnabled &&
        interstitialAdUnitId != null;
  }

  AdConfig get currentConfig => _config();

  String? get bannerAdUnitId => _adUnitId(
    androidTestId: _androidTestBannerId,
    iosTestId: _iosTestBannerId,
    androidLiveId: _config().androidBannerAdUnitId,
    iosLiveId: _config().iosBannerAdUnitId,
  );

  String? get interstitialAdUnitId => _adUnitId(
    androidTestId: _androidTestInterstitialId,
    iosTestId: _iosTestInterstitialId,
    androidLiveId: _config().androidInterstitialAdUnitId,
    iosLiveId: _config().iosInterstitialAdUnitId,
  );

  Future<void> showAfterCleanup() async {
    if (!_canShowInterstitial || _interstitialBusy) return;
    try {
      if (await _isInterstitialRewardActive()) return;
      final config = _config();
      final preferences = await SharedPreferences.getInstance();
      final completedCleanups = (preferences.getInt(_completedCleanupsKey) ?? 0) + 1;
      await preferences.setInt(_completedCleanupsKey, completedCleanups);
      final lastShownMilliseconds = preferences.getInt(_lastInterstitialAtKey);
      final lastShownAt = lastShownMilliseconds == null
          ? null
          : DateTime.fromMillisecondsSinceEpoch(lastShownMilliseconds);
      final now = DateTime.now();
      if (!config.shouldShowInterstitial(completedCleanups: completedCleanups, now: now, lastShownAt: lastShownAt)) {
        return;
      }

      _interstitialBusy = true;
      if (!await _prepareAds() || !_canShowInterstitial) {
        _interstitialBusy = false;
        return;
      }
      final adUnitId = interstitialAdUnitId;
      if (adUnitId == null) {
        _interstitialBusy = false;
        return;
      }
      await InterstitialAd.load(
        adUnitId: adUnitId,
        request: AdRequest(nonPersonalizedAds: config.nonPersonalizedAds),
        adLoadCallback: InterstitialAdLoadCallback(
          onAdLoaded: (ad) {
            if (!_canShowInterstitial) {
              ad.dispose();
              _interstitialBusy = false;
              return;
            }
            ad.fullScreenContentCallback = FullScreenContentCallback(
              onAdShowedFullScreenContent: (_) {
                unawaited(preferences.setInt(_completedCleanupsKey, 0));
                unawaited(preferences.setInt(_lastInterstitialAtKey, DateTime.now().millisecondsSinceEpoch));
              },
              onAdDismissedFullScreenContent: (value) {
                value.dispose();
                _interstitialBusy = false;
              },
              onAdFailedToShowFullScreenContent: (value, _) {
                value.dispose();
                _interstitialBusy = false;
              },
            );
            try {
              ad.show();
            } catch (_) {
              ad.dispose();
              _interstitialBusy = false;
            }
          },
          onAdFailedToLoad: (_) {
            _interstitialBusy = false;
          },
        ),
      );
    } catch (_) {
      _interstitialBusy = false;
    }
  }

  Future<bool> prepareBanner() async => canShowBanner && await _prepareAds() && canShowBanner;

  Future<bool> _prepareAds() {
    final current = _adsInitialization;
    if (current != null) return current;
    final completer = Completer<bool>();
    _adsInitialization = completer.future;
    try {
      ConsentInformation.instance.requestConsentInfoUpdate(
        ConsentRequestParameters(),
        () => unawaited(_completeAdsInitialization(completer, showConsentForm: true)),
        (_) => unawaited(_completeAdsInitialization(completer, showConsentForm: false)),
      );
    } catch (_) {
      completer.complete(false);
    }
    return completer.future;
  }

  Future<void> _completeAdsInitialization(Completer<bool> completer, {required bool showConsentForm}) async {
    try {
      if (showConsentForm) await ConsentForm.loadAndShowConsentFormIfRequired((_) {});
      final canRequestAds = await ConsentInformation.instance.canRequestAds();
      if (canRequestAds) await MobileAds.instance.initialize();
      if (!completer.isCompleted) completer.complete(canRequestAds);
    } catch (_) {
      if (!completer.isCompleted) completer.complete(false);
    }
  }

  String? _adUnitId({
    required String androidTestId,
    required String iosTestId,
    required String androidLiveId,
    required String iosLiveId,
  }) {
    if (!_isSupportedPlatform) return null;
    final config = _config();
    if (config.mode == AdMode.off) return null;
    if (config.mode == AdMode.test) return Platform.isIOS ? iosTestId : androidTestId;
    final liveId = Platform.isIOS ? iosLiveId : androidLiveId;
    return liveId.isEmpty ? null : liveId;
  }

  bool get _isSupportedPlatform => Platform.isAndroid || Platform.isIOS;

  static Future<bool> _inactiveReward() async => false;
}

class SnapkitBannerAd extends StatelessWidget {
  const SnapkitBannerAd({super.key});

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: RemoteConfig.instance,
    builder: (context, _) => Obx(() {
      final user = Get.find<AuthController>().user;
      final service = Get.find<AdService>();
      if (user?.isPro == true || !service.canShowBanner) return const SizedBox.shrink();
      final adUnitId = service.bannerAdUnitId;
      if (adUnitId == null) return const SizedBox.shrink();
      final config = service.currentConfig;
      return _BannerAdSlot(
        key: ValueKey('${config.mode.name}:$adUnitId:${config.nonPersonalizedAds}'),
        service: service,
        adUnitId: adUnitId,
        nonPersonalizedAds: config.nonPersonalizedAds,
      );
    }),
  );
}

class _BannerAdSlot extends StatefulWidget {
  const _BannerAdSlot({required this.service, required this.adUnitId, required this.nonPersonalizedAds, super.key});

  final AdService service;
  final String adUnitId;
  final bool nonPersonalizedAds;

  @override
  State<_BannerAdSlot> createState() => _BannerAdSlotState();
}

class _BannerAdSlotState extends State<_BannerAdSlot> {
  BannerAd? _ad;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    if (!await widget.service.prepareBanner() || !mounted) return;
    final ad = BannerAd(
      size: AdSize.banner,
      adUnitId: widget.adUnitId,
      listener: BannerAdListener(
        onAdLoaded: (value) {
          if (!mounted || !widget.service.canShowBanner) {
            value.dispose();
            return;
          }
          setState(() => _ad = value as BannerAd);
        },
        onAdFailedToLoad: (value, _) => value.dispose(),
      ),
      request: AdRequest(nonPersonalizedAds: widget.nonPersonalizedAds),
    );
    try {
      await ad.load();
    } catch (_) {
      ad.dispose();
    }
  }

  @override
  void dispose() {
    _ad?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ad = _ad;
    if (ad == null) return const SizedBox(height: 50);
    return Center(
      child: SizedBox(
        width: ad.size.width.toDouble(),
        height: ad.size.height.toDouble(),
        child: AdWidget(ad: ad),
      ),
    );
  }
}
