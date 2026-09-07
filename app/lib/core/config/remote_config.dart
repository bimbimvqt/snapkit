import 'package:flutter/foundation.dart';

import '../ads/ad_config.dart';
import '../network/api_client.dart';
import '../theme/snapkit_theme.dart';
import '../../features/cleaner/domain/cleaner_scan_settings.dart';
import '../../features/settings/domain/pro_subscription_config.dart';

class RemoteConfig extends ChangeNotifier {
  RemoteConfig._();
  static final instance = RemoteConfig._();
  static const defaultFlags = <String, bool>{
    'media_cleaner': true,
    'qr_studio': true,
    'pro_paywall': true,
    'ai_caption_studio': true,
  };
  Map<String, bool> flags = defaultFlags;
  Map<String, Object?> mobile = const {
    'maintenance': false,
    'ads': {
      'mode': 'off',
      'bannerEnabled': true,
      'interstitialEnabled': true,
      'interstitialEvery': 3,
      'minimumInterstitialIntervalSeconds': 180,
      'nonPersonalizedAds': true,
    },
    'theme': {'preset': 'midnight_lime', 'mode': 'dark', 'navigationStyle': 'floating'},
  };
  AppThemeSettings theme = const AppThemeSettings();
  AdConfig get ads => AdConfig.fromMobile(mobile);
  CleanerScanSettings get cleaner => CleanerScanSettings.fromMobile(mobile);
  ProSubscriptionConfig get proSubscription => ProSubscriptionConfig.fromMobile(mobile);
  bool enabled(String key) => flags[key] ?? false;
  Future<void> refresh() async {
    try {
      final response = await ApiClient.instance.dio.get<Map<String, dynamic>>('/api/v1/config');
      final data = response.data?['data'] as Map<String, dynamic>?;
      if (data == null) return;
      flags = {...defaultFlags, ...Map<String, bool>.from(data['flags'] as Map? ?? const {})};
      mobile = Map<String, Object?>.from(data['mobile'] as Map? ?? const {});
      theme = AppThemeSettings.fromMobile(mobile);
      notifyListeners();
    } catch (_) {
      // Offline-first: local tools stay available when the config server is unreachable.
    }
  }
}
