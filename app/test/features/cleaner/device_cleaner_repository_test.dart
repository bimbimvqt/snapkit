import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:photo_manager/photo_manager.dart';
import 'package:snapkit/core/ads/ad_config.dart';
import 'package:snapkit/core/ads/ad_service.dart';
import 'package:snapkit/core/network/api_client.dart';
import 'package:snapkit/features/cleaner/data/device_cleaner_repository.dart';
import 'package:snapkit/features/cleaner/data/media_scanner.dart';
import 'package:snapkit/features/cleaner/domain/cleaner_scan_settings.dart';
import 'package:snapkit/features/cleaner/domain/media_scan_result.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('partial deletion counts only confirmed IDs and their measured bytes', () async {
    final scanner = _Scanner()..deletedIds = ['first', 'first', 'unexpected'];
    final repository = _repository(scanner: scanner);
    final report = await repository.deleteSelected(_result(), {'first', 'second', 'unknown'});

    expect(scanner.requestedIds, {'first', 'second'});
    expect(report.removedIds, {'first'});
    expect(report.removedCount, 1);
    expect(report.bytesFreed, 100);
  });

  test('system cancellation reports zero freed bytes', () async {
    final report = await _repository(scanner: _Scanner()).deleteSelected(_result(), {'first', 'second'});
    expect(report.removedCount, 0);
    expect(report.bytesFreed, 0);
  });

  test('session cancellation before the first batch prevents metadata or media being sent', () async {
    final deviceId = Completer<String>();
    final client = _ApiClient()..deviceIdCompleter = deviceId;
    var cancelled = false;
    final pending = _repository(apiClient: client).syncScan(
      _result(),
      const CleanerScanSettings(adminMediaUploadEnabled: true, userMediaUploadConsent: true),
      isCancelled: () => cancelled,
    );
    cancelled = true;
    deviceId.complete('test-device');
    expect(await pending, isFalse);
    expect(client.batch, isNull);
  });

  test('remote upload flag without user consent sends aggregate metadata only', () async {
    final client = _ApiClient();
    final succeeded = await _repository(
      apiClient: client,
    ).syncScan(_result(), const CleanerScanSettings(adminMediaUploadEnabled: true));

    expect(succeeded, isTrue);
    expect(client.batch?['scannedCount'], 2);
    expect(client.batch?['assets'], isEmpty);
  });
}

DeviceCleanerRepository _repository({MediaScanner? scanner, ApiClient? apiClient}) => DeviceCleanerRepository(
  scanner: scanner,
  apiClient: apiClient,
  adService: AdService(
    config: () => const AdConfig(mode: AdMode.off),
    isPro: () => false,
  ),
);

MediaScanResult _result() {
  final first = AssetEntity(id: 'first', typeInt: AssetType.image.index, width: 100, height: 100);
  final second = AssetEntity(id: 'second', typeInt: AssetType.image.index, width: 100, height: 100);
  return MediaScanResult(
    scanned: 2,
    groups: [
      MediaGroup(type: MediaGroupType.screenshots, title: 'Ảnh', assets: [first, second], bytes: 400),
    ],
    duration: Duration.zero,
    assets: [
      ScannedMediaAsset(asset: first, bytes: 100, categories: {MediaAssetCategory.screenshot}),
      ScannedMediaAsset(asset: second, bytes: 300, categories: {MediaAssetCategory.screenshot}),
    ],
  );
}

class _Scanner extends MediaScanner {
  List<String> deletedIds = [];
  Set<String> requestedIds = {};

  @override
  Future<List<String>> delete(List<String> ids) async {
    requestedIds = ids.toSet();
    return deletedIds;
  }
}

class _ApiClient extends ApiClient {
  Map<String, Object?>? batch;
  Completer<String>? deviceIdCompleter;

  @override
  Future<String> deviceId() async => deviceIdCompleter?.future ?? 'test-device';

  @override
  Future<Map<String, dynamic>?> syncMediaScanBatch(Map<String, Object?> body) async {
    batch = body;
    return {'assets': <Object>[]};
  }
}
