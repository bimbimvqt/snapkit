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
  int get reclaimable => groups.fold(0, (sum, group) => sum + group.bytes);
  int get imageCount => assets.where((item) => item.asset.type == AssetType.image).length;
  int get videoCount => assets.where((item) => item.asset.type == AssetType.video).length;
  int get duplicateCount => assets.where((item) => item.categories.contains(MediaAssetCategory.similar)).length;
  int get screenshotCount => assets.where((item) => item.categories.contains(MediaAssetCategory.screenshot)).length;
  int get largeVideoCount => assets.where((item) => item.categories.contains(MediaAssetCategory.largeVideo)).length;
}
