import 'package:photo_manager/photo_manager.dart';

enum MediaGroupType { similar, screenshots, largeVideos }

enum MediaAssetCategory { similar, screenshot, largeVideo, other }

class ScannedMediaAsset {
  const ScannedMediaAsset({required this.asset, required this.bytes, required this.categories});

  final AssetEntity asset;
  final int bytes;
  final Set<MediaAssetCategory> categories;
}

class MediaGroup {
  const MediaGroup({required this.type, required this.title, required this.assets, required this.bytes});
  final MediaGroupType type;
  final String title;
  final List<AssetEntity> assets;
  final int bytes;
}

class MediaScanResult {
  const MediaScanResult({required this.scanned, required this.groups, required this.duration, this.assets = const []});
  final int scanned;
  final List<MediaGroup> groups;
  final Duration duration;
  final List<ScannedMediaAsset> assets;

  MediaScanResult withoutAssets(Set<String> removedIds) {
    final remainingAssets = assets.where((item) => !removedIds.contains(item.asset.id)).toList(growable: false);
    final remainingGroups = <MediaGroup>[];
    for (final group in groups) {
      final remaining = group.assets.where((asset) => !removedIds.contains(asset.id)).toList(growable: false);
      if (remaining.isEmpty || (group.type == MediaGroupType.similar && remaining.length < 2)) continue;
      remainingGroups.add(
        MediaGroup(
          type: group.type,
          title: group.title,
          assets: remaining,
          bytes: bytesFor(remaining.map((asset) => asset.id).toSet()),
        ),
      );
    }
    return MediaScanResult(scanned: scanned, groups: remainingGroups, duration: duration, assets: remainingAssets);
  }

  Set<String> get reclaimableAssetIds {
    final ids = <String>{};
    for (final group in groups) {
      final candidates = group.type == MediaGroupType.similar ? group.assets.skip(1) : group.assets;
      ids.addAll(candidates.map((asset) => asset.id));
    }
    return ids;
  }

  int get reclaimable {
    final ids = reclaimableAssetIds;
    return assets.where((item) => ids.contains(item.asset.id)).fold(0, (sum, item) => sum + item.bytes);
  }

  int bytesFor(Set<String> ids) =>
      assets.where((item) => ids.contains(item.asset.id)).fold(0, (sum, item) => sum + item.bytes);

  int categoryCount(MediaGroupType type) {
    final ids = groups
        .where((group) => group.type == type)
        .expand((group) => group.assets)
        .map((asset) => asset.id)
        .toSet();
    return ids.length;
  }

  int categoryBytes(MediaGroupType type) {
    final similarIds = _reclaimableIdsFor(MediaGroupType.similar);
    final screenshotIds = _reclaimableIdsFor(MediaGroupType.screenshots)..removeAll(similarIds);
    final ids = switch (type) {
      MediaGroupType.similar => similarIds,
      MediaGroupType.screenshots => screenshotIds,
      MediaGroupType.largeVideos =>
        _reclaimableIdsFor(MediaGroupType.largeVideos)
          ..removeAll(similarIds)
          ..removeAll(screenshotIds),
    };
    return assets.where((item) => ids.contains(item.asset.id)).fold(0, (sum, item) => sum + item.bytes);
  }

  Set<String> _reclaimableIdsFor(MediaGroupType type) => {
    for (final group in groups.where((group) => group.type == type))
      for (final asset in type == MediaGroupType.similar ? group.assets.skip(1) : group.assets) asset.id,
  };

  int get imageCount => assets.where((item) => item.asset.type == AssetType.image).length;
  int get videoCount => assets.where((item) => item.asset.type == AssetType.video).length;
  int get duplicateCount => assets.where((item) => item.categories.contains(MediaAssetCategory.similar)).length;
  int get screenshotCount => assets.where((item) => item.categories.contains(MediaAssetCategory.screenshot)).length;
  int get largeVideoCount => assets.where((item) => item.categories.contains(MediaAssetCategory.largeVideo)).length;
}
