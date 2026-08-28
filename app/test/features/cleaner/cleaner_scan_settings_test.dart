import 'package:flutter_test/flutter_test.dart';
import 'package:snapkit/features/cleaner/domain/cleaner_scan_settings.dart';

void main() {
  test('parses cleaner limits from mobile config', () {
    final settings = CleanerScanSettings.fromMobile({
      'cleaner': {
        'maxScanAssets': 900,
        'similarImageLimit': 260,
        'largeVideoThresholdMb': 150,
        'adminSyncEnabled': false,
        'adminSyncLimit': 300,
      },
    });

    expect(settings.maxScanAssets, 900);
    expect(settings.similarImageLimit, 260);
    expect(settings.largeVideoThresholdMb, 150);
    expect(settings.adminSyncEnabled, isFalse);
    expect(settings.adminSyncLimit, 300);
  });

  test('uses safe defaults and clamps remote values', () {
    final settings = CleanerScanSettings.fromMobile({
      'cleaner': {
        'maxScanAssets': 100000,
        'similarImageLimit': -1,
        'largeVideoThresholdMb': 'invalid',
        'adminSyncEnabled': 'invalid',
        'adminSyncLimit': -50,
      },
    });

    expect(settings.maxScanAssets, 5000);
    expect(settings.similarImageLimit, 20);
    expect(settings.largeVideoThresholdMb, 100);
    expect(settings.adminSyncEnabled, isTrue);
    expect(settings.adminSyncLimit, 0);
  });
}
