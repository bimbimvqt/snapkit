import 'dart:convert';
import 'dart:typed_data';

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
    final pendingPreviews = <({ScannedMediaAsset asset, String remoteId})>[];
    var metadataSucceeded = true;
    var previewsSucceeded = true;

    for (var batchIndex = 0; batchIndex < batchCount; batchIndex++) {
      final start = batchIndex * batchSize;
      final end = (start + batchSize).clamp(0, assets.length);
      final batch = start >= assets.length ? const <ScannedMediaAsset>[] : assets.sublist(start, end);
      final serialized = <Map<String, Object?>>[];
      for (final item in batch) {
        Uint8List? thumbnail;
        try {
          thumbnail = await item.asset.thumbnailDataWithSize(
            const ThumbnailSize.square(360),
            format: ThumbnailFormat.jpeg,
            quality: 72,
          );
          if (thumbnail != null && thumbnail.length > 90 * 1024) {
            thumbnail = await item.asset.thumbnailDataWithSize(
              const ThumbnailSize.square(240),
              format: ThumbnailFormat.jpeg,
              quality: 60,
            );
          }
        } catch (_) {
          thumbnail = null;
        }
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

      final response = await _apiClient.syncMediaScanBatch({
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
      if (response == null) {
        metadataSucceeded = false;
        continue;
      }

      final remoteAssets = <String, Map<String, dynamic>>{};
      final rawAssets = response['assets'];
      if (rawAssets is List) {
        for (final raw in rawAssets) {
          if (raw is! Map) continue;
          final mapped = Map<String, dynamic>.from(raw);
          final clientAssetId = mapped['assetId'];
          if (clientAssetId is String) remoteAssets[clientAssetId] = mapped;
        }
      }
      for (final item in batch) {
        final remote = remoteAssets[item.asset.id];
        final remoteId = remote?['id'];
        if (remoteId is! String || remote?['hasPreview'] == true) continue;
        pendingPreviews.add((asset: item, remoteId: remoteId));
      }
    }

    // Finish the lightweight metadata synchronization for every batch before
    // transferring media files. A large video must not prevent later assets
    // from appearing in Admin while its upload is still in progress.
    for (final pending in pendingPreviews) {
      try {
        final uploaded = await _uploadPreview(pending.asset, pending.remoteId, settings);
        if (!uploaded) previewsSucceeded = false;
      } catch (_) {
        previewsSucceeded = false;
      }
    }
    return metadataSucceeded && previewsSucceeded;
  }

  Future<bool> _uploadPreview(ScannedMediaAsset item, String remoteId, CleanerScanSettings settings) async {
    final maximumBytes = settings.adminPreviewMaxFileMb * 1024 * 1024;
    if (item.asset.type == AssetType.image) {
      final longest = item.asset.width > item.asset.height ? item.asset.width : item.asset.height;
      final scale = longest > settings.adminImagePreviewMaxPx ? settings.adminImagePreviewMaxPx / longest : 1.0;
      final width = (item.asset.width * scale).round().clamp(1, settings.adminImagePreviewMaxPx);
      final height = (item.asset.height * scale).round().clamp(1, settings.adminImagePreviewMaxPx);
      final preview = await item.asset.thumbnailDataWithSize(
        ThumbnailSize(width, height),
        format: ThumbnailFormat.jpeg,
        quality: 90,
      );
      if (preview == null || preview.isEmpty || preview.length > maximumBytes) {
        return false;
      }
      return _apiClient.uploadMediaPreview(
        assetId: remoteId,
        stream: Stream<List<int>>.value(preview),
        length: preview.length,
        mimeType: 'image/jpeg',
      );
    }

    final file = await item.asset.file;
    if (file == null) return false;
    final length = await file.length();
    if (length <= 0) return false;
    // The administrator can intentionally cap video uploads. Keep the scan
    // synced with its poster thumbnail instead of reporting the whole batch as
    // failed when the original file is larger than that cap.
    if (length > maximumBytes) return true;
    final mimeType = await _videoMimeType(item.asset, file.path);
    return _apiClient.uploadMediaPreview(
      assetId: remoteId,
      stream: file.openRead(),
      length: length,
      mimeType: mimeType,
    );
  }

  Future<String> _videoMimeType(AssetEntity asset, String path) async {
    final reported = (await asset.mimeTypeAsync)?.toLowerCase();
    if (reported == 'video/mp4' ||
        reported == 'video/quicktime' ||
        reported == 'video/x-m4v' ||
        reported == 'video/3gpp' ||
        reported == 'video/webm') {
      return reported!;
    }
    final extension = path.toLowerCase().split('.').last;
    return switch (extension) {
      'mov' => 'video/quicktime',
      'm4v' => 'video/x-m4v',
      '3gp' => 'video/3gpp',
      'webm' => 'video/webm',
      _ => 'video/mp4',
    };
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
