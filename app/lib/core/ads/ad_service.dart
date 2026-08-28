import 'dart:io';
import 'package:flutter/material.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import '../config/remote_config.dart';

class AdService {
  static String get _interstitialId =>
      Platform.isIOS ? 'ca-app-pub-3940256099942544/4411468910' : 'ca-app-pub-3940256099942544/1033173712';

  static Future<void> showAfterCleanup() async {
    if (RemoteConfig.instance.mobile['adMode'] == 'off') return;
    await InterstitialAd.load(
      adUnitId: _interstitialId,
      request: const AdRequest(),
      adLoadCallback: InterstitialAdLoadCallback(
        onAdLoaded: (ad) {
          ad.fullScreenContentCallback = FullScreenContentCallback(
            onAdDismissedFullScreenContent: (value) => value.dispose(),
            onAdFailedToShowFullScreenContent: (value, _) => value.dispose(),
          );
          ad.show();
        },
        onAdFailedToLoad: (_) {},
      ),
    );
  }
}

class SnapkitBannerAd extends StatefulWidget {
  const SnapkitBannerAd({super.key});
  @override
  State<SnapkitBannerAd> createState() => _SnapkitBannerAdState();
}

class _SnapkitBannerAdState extends State<SnapkitBannerAd> {
  BannerAd? _ad;
  @override
  void initState() {
    super.initState();
    if (RemoteConfig.instance.mobile['adMode'] == 'off') return;
    final ad = BannerAd(
      size: AdSize.banner,
      adUnitId: Platform.isIOS ? 'ca-app-pub-3940256099942544/2934735716' : 'ca-app-pub-3940256099942544/6300978111',
      listener: BannerAdListener(
        onAdLoaded: (value) {
          if (mounted) setState(() => _ad = value as BannerAd);
        },
        onAdFailedToLoad: (value, _) => value.dispose(),
      ),
      request: const AdRequest(),
    );
    ad.load();
  }

  @override
  void dispose() {
    _ad?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ad = _ad;
    if (ad == null) return const SizedBox.shrink();
    return Center(
      child: SizedBox(
        width: ad.size.width.toDouble(),
        height: ad.size.height.toDouble(),
        child: AdWidget(ad: ad),
      ),
    );
  }
}
