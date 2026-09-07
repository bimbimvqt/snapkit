import 'dart:io';
import 'dart:math';
import 'dart:typed_data';

import 'package:image/image.dart' as image;
import 'package:photo_manager/photo_manager.dart';

import '../domain/cleaner_scan_settings.dart';
import '../domain/media_scan_result.dart';
import 'screenshot_detection.dart';

typedef _InspectedAsset = ({AssetEntity asset, int bytes, bool isScreenshot, BigInt? hash});

class MediaScanner {
  static const int _inspectionBatchSize = 6;

  Future<MediaScanResult> scan(
    CleanerScanSettings settings, {
    required void Function(MediaScanProgress) onProgress,
  }) async {
    final started = DateTime.now();
    final permission = await PhotoManager.requestPermissionExtend();
    if (!permission.hasAccess) throw const MediaPermissionException();
    final paths = await PhotoManager.getAssetPathList(type: RequestType.common, onlyAll: true);
    final screenshotAssets = await _loadScreenshotAssets(limit: settings.maxScanAssets);
    final assetsById = <String, AssetEntity>{for (final asset in screenshotAssets) asset.id: asset};
    if (paths.isNotEmpty && assetsById.length < settings.maxScanAssets) {
      final count = await paths.first.assetCountAsync;
      final recentAssets = await paths.first.getAssetListRange(start: 0, end: min(count, settings.maxScanAssets));
      for (final asset in recentAssets) {
        if (assetsById.length >= settings.maxScanAssets) break;
        assetsById.putIfAbsent(asset.id, () => asset);
      }
    }
    final assets = assetsById.values.toList(growable: false);
    if (assets.isEmpty) {
      return MediaScanResult(scanned: 0, groups: const [], duration: DateTime.now().difference(started));
    }
    final screenshotIds = screenshotAssets.map((asset) => asset.id).toSet();
    final screenshots = <AssetEntity>[];
    final largeVideos = <AssetEntity>[];
    final similarCandidates = <({AssetEntity asset, BigInt hash, int bytes})>[];
    final assetBytes = <String, int>{};
    var completed = 0;
    var remainingSimilaritySlots = settings.similarImageLimit;
    for (var start = 0; start < assets.length; start += _inspectionBatchSize) {
      final end = min(start + _inspectionBatchSize, assets.length);
      final inspections = <Future<_InspectedAsset>>[];
      for (final asset in assets.sublist(start, end)) {
        final includeSimilarity = asset.type == AssetType.image && remainingSimilaritySlots > 0;
        if (includeSimilarity) remainingSimilaritySlots--;
        inspections.add(
          _inspectAsset(asset, screenshotIds: screenshotIds, includeSimilarity: includeSimilarity).whenComplete(() {
            completed++;
            onProgress(MediaScanProgress(completed: completed, total: assets.length));
          }),
        );
      }
      for (final inspected in await Future.wait(inspections)) {
        assetBytes[inspected.asset.id] = inspected.bytes;
        if (inspected.isScreenshot) screenshots.add(inspected.asset);
        if (inspected.asset.type == AssetType.video &&
            inspected.bytes >= settings.largeVideoThresholdMb * 1024 * 1024) {
          largeVideos.add(inspected.asset);
        }
        final hash = inspected.hash;
        if (hash != null) {
          similarCandidates.add((asset: inspected.asset, hash: hash, bytes: inspected.bytes));
        }
      }
    }
    final clusters = <List<({AssetEntity asset, BigInt hash, int bytes})>>[];
    for (final candidate in similarCandidates) {
      List<({AssetEntity asset, BigInt hash, int bytes})>? match;
      for (final cluster in clusters) {
        if (_distance(cluster.first.hash, candidate.hash) <= 5) {
          match = cluster;
          break;
        }
      }
      (match ?? (clusters..add(<({AssetEntity asset, BigInt hash, int bytes})>[])).last).add(candidate);
    }
    final groups = <MediaGroup>[];
    var similarGroupIndex = 0;
    for (final cluster in clusters.where((c) => c.length > 1)) {
      similarGroupIndex++;
      groups.add(
        MediaGroup(
          type: MediaGroupType.similar,
          title: _similarGroupTitle(cluster.first.asset, similarGroupIndex),
          assets: cluster.map((e) => e.asset).toList(),
          bytes: cluster.skip(1).fold(0, (sum, e) => sum + e.bytes),
        ),
      );
    }
    if (screenshots.isNotEmpty) {
      groups.add(
        MediaGroup(
          type: MediaGroupType.screenshots,
          title: 'Ảnh chụp màn hình',
          assets: screenshots,
          bytes: screenshots.fold(0, (sum, asset) => sum + (assetBytes[asset.id] ?? 0)),
        ),
      );
    }
    if (largeVideos.isNotEmpty) {
      groups.add(
        MediaGroup(
          type: MediaGroupType.largeVideos,
          title: 'Video dung lượng lớn',
          assets: largeVideos,
          bytes: largeVideos.fold(0, (sum, asset) => sum + (assetBytes[asset.id] ?? 0)),
        ),
      );
    }
    final categories = <String, Set<MediaAssetCategory>>{};
    for (final group in groups) {
      final category = switch (group.type) {
        MediaGroupType.similar => MediaAssetCategory.similar,
        MediaGroupType.screenshots => MediaAssetCategory.screenshot,
        MediaGroupType.largeVideos => MediaAssetCategory.largeVideo,
      };
      for (final asset in group.assets) {
        categories.putIfAbsent(asset.id, () => <MediaAssetCategory>{}).add(category);
      }
    }
    final scannedAssets = assets
        .where((asset) => asset.type == AssetType.image || asset.type == AssetType.video)
        .map(
          (asset) => ScannedMediaAsset(
            asset: asset,
            bytes: assetBytes[asset.id] ?? 0,
            categories: categories[asset.id] ?? const {MediaAssetCategory.other},
          ),
        )
        .toList(growable: false);
    return MediaScanResult(
      scanned: assets.length,
      groups: groups,
      duration: DateTime.now().difference(started),
      assets: scannedAssets,
    );
  }

  Future<_InspectedAsset> _inspectAsset(
    AssetEntity asset, {
    required Set<String> screenshotIds,
    required bool includeSimilarity,
  }) async {
    var bytes = 0;
    try {
      final file = await asset.file;
      bytes = file == null ? 0 : await file.length();
    } catch (_) {
      // Cloud-only or recently deleted assets may not expose a local file.
    }

    if (asset.type == AssetType.video) {
      return (asset: asset, bytes: bytes, isScreenshot: false, hash: null);
    }
    if (asset.type != AssetType.image) {
      return (asset: asset, bytes: bytes, isScreenshot: false, hash: null);
    }

    var title = asset.title;
    if (title == null || title.isEmpty) {
      try {
        title = await asset.titleAsync;
      } catch (_) {
        title = null;
      }
    }
    final isScreenshot =
        screenshotIds.contains(asset.id) ||
        (Platform.isIOS && ScreenshotDetection.matchesDarwinSubtype(asset.subtype)) ||
        ScreenshotDetection.matches(title) ||
        ScreenshotDetection.matches(asset.relativePath);
    BigInt? hash;
    if (includeSimilarity) {
      try {
        final data = await asset.thumbnailDataWithSize(const ThumbnailSize(18, 16), quality: 55);
        if (data != null) hash = _differenceHash(data);
      } catch (_) {
        // A single unreadable thumbnail must not abort the whole library scan.
      }
    }
    return (asset: asset, bytes: bytes, isScreenshot: isScreenshot, hash: hash);
  }

  BigInt? _differenceHash(Uint8List bytes) {
    final decoded = image.decodeImage(bytes);
    if (decoded == null) return null;
    final resized = image.copyResize(decoded, width: 9, height: 8);
    var hash = BigInt.zero;
    var bit = 0;
    for (var y = 0; y < 8; y++) {
      for (var x = 0; x < 8; x++) {
        if (resized.getPixel(x, y).luminance < resized.getPixel(x + 1, y).luminance) {
          hash |= BigInt.one << bit;
        }
        bit++;
      }
    }
    return hash;
  }

  int _distance(BigInt a, BigInt b) {
    var value = a ^ b;
    var count = 0;
    while (value > BigInt.zero) {
      count += (value & BigInt.one).toInt();
      value >>= 1;
    }
    return count;
  }

  String _similarGroupTitle(AssetEntity asset, int index) {
    final createdAt = asset.createDateTime.toLocal();
    final day = createdAt.day.toString().padLeft(2, '0');
    final month = createdAt.month.toString().padLeft(2, '0');
    final hour = createdAt.hour.toString().padLeft(2, '0');
    final minute = createdAt.minute.toString().padLeft(2, '0');
    return '$day/$month/${createdAt.year} · $hour:$minute · Nhóm $index';
  }

  Future<List<AssetEntity>> _loadScreenshotAssets({required int limit}) async {
    if (limit <= 0 || (!Platform.isIOS && !Platform.isAndroid)) return const <AssetEntity>[];

    try {
      final paths = Platform.isIOS ? await _loadIosScreenshotPaths() : await _loadAndroidScreenshotPaths();
      final assetsById = <String, AssetEntity>{};
      for (final path in paths) {
        if (assetsById.length >= limit) break;
        final count = await path.assetCountAsync;
        if (count == 0) continue;
        final assets = await path.getAssetListRange(start: 0, end: min(count, limit - assetsById.length));
        for (final asset in assets) {
          assetsById.putIfAbsent(asset.id, () => asset);
        }
      }
      return assetsById.values.toList(growable: false);
    } catch (_) {
      // Album APIs vary between OS and OEM versions. The main library scan still
      // recognizes screenshot metadata if the dedicated album cannot be read.
      return const <AssetEntity>[];
    }
  }

  Future<List<AssetPathEntity>> _loadIosScreenshotPaths() async {
    final paths = await PhotoManager.getAssetPathList(
      hasAll: false,
      type: RequestType.image,
      pathFilterOption: const PMPathFilter(
        darwin: PMDarwinPathFilter(
          type: <PMDarwinAssetCollectionType>[PMDarwinAssetCollectionType.smartAlbum],
          subType: <PMDarwinAssetCollectionSubtype>[PMDarwinAssetCollectionSubtype.smartAlbumScreenshots],
        ),
      ),
    );
    return paths
        .where((path) => path.albumTypeEx?.darwin?.subtype == PMDarwinAssetCollectionSubtype.smartAlbumScreenshots)
        .toList(growable: false);
  }

  Future<List<AssetPathEntity>> _loadAndroidScreenshotPaths() async {
    final paths = await PhotoManager.getAssetPathList(hasAll: false, type: RequestType.image);
    final screenshotPaths = <AssetPathEntity>[];
    for (final path in paths) {
      if (ScreenshotDetection.matches(path.name)) {
        screenshotPaths.add(path);
        continue;
      }
      String? relativePath;
      try {
        relativePath = await path.relativePathAsync;
      } catch (_) {
        continue;
      }
      if (ScreenshotDetection.matches(relativePath)) screenshotPaths.add(path);
    }
    return screenshotPaths;
  }

  Future<List<String>> delete(List<String> ids) => PhotoManager.editor.deleteWithIds(ids);
}

class MediaPermissionException implements Exception {
  const MediaPermissionException();
}
