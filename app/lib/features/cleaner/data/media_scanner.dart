import 'dart:typed_data';
import 'package:image/image.dart' as image;
import 'package:photo_manager/photo_manager.dart';
import '../domain/media_scan_result.dart';

class MediaScanner {
  Future<MediaScanResult> scan() async {
    final started = DateTime.now();
    final permission = await PhotoManager.requestPermissionExtend();
    if (!permission.isAuth) throw const MediaPermissionException();
    final paths = await PhotoManager.getAssetPathList(type: RequestType.common, onlyAll: true);
    if (paths.isEmpty) {
      return MediaScanResult(scanned: 0, groups: const [], duration: DateTime.now().difference(started));
    }
    final count = await paths.first.assetCountAsync;
    final assets = await paths.first.getAssetListRange(start: 0, end: count.clamp(0, 500));
    final screenshots = <AssetEntity>[];
    final largeVideos = <AssetEntity>[];
    final similarCandidates = <({AssetEntity asset, BigInt hash, int bytes})>[];
    for (final asset in assets) {
      final file = await asset.file;
      final bytes = file == null ? 0 : await file.length();
      if (asset.type == AssetType.video && bytes >= 100 * 1024 * 1024) {
        largeVideos.add(asset);
        continue;
      }
      if (asset.type != AssetType.image) continue;
      final title = (await asset.titleAsync).toLowerCase();
      final path = asset.relativePath?.toLowerCase() ?? '';
      if (title.contains('screenshot') || path.contains('screenshot')) {
        screenshots.add(asset);
      }
      if (similarCandidates.length < 180) {
        final data = await asset.thumbnailDataWithSize(const ThumbnailSize(18, 16), quality: 55);
        if (data != null) {
          final hash = _differenceHash(data);
          if (hash != null) {
            similarCandidates.add((asset: asset, hash: hash, bytes: bytes));
          }
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
    for (final cluster in clusters.where((c) => c.length > 1)) {
      groups.add(
        MediaGroup(
          type: MediaGroupType.similar,
          title: 'Ảnh tương tự',
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
          bytes: await _total(screenshots),
        ),
      );
    }
    if (largeVideos.isNotEmpty) {
      groups.add(
        MediaGroup(
          type: MediaGroupType.largeVideos,
          title: 'Video dung lượng lớn',
          assets: largeVideos,
          bytes: await _total(largeVideos),
        ),
      );
    }
    return MediaScanResult(scanned: assets.length, groups: groups, duration: DateTime.now().difference(started));
  }

  BigInt? _differenceHash(List<int> bytes) {
    final decoded = image.decodeImage(Uint8List.fromList(bytes));
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

  Future<int> _total(List<AssetEntity> assets) async {
    var total = 0;
    for (final asset in assets) {
      total += await (await asset.file)?.length() ?? 0;
    }
    return total;
  }

  Future<List<String>> delete(List<String> ids) => PhotoManager.editor.deleteWithIds(ids);
}

class MediaPermissionException implements Exception {
  const MediaPermissionException();
}
