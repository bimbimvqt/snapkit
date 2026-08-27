import 'package:photo_manager/photo_manager.dart';

enum MediaGroupType { similar, screenshots, largeVideos }

class MediaGroup {
  const MediaGroup({
    required this.type,
    required this.title,
    required this.assets,
    required this.bytes,
  });
  final MediaGroupType type;
  final String title;
  final List<AssetEntity> assets;
  final int bytes;
}

class MediaScanResult {
  const MediaScanResult({
    required this.scanned,
    required this.groups,
    required this.duration,
  });
  final int scanned;
  final List<MediaGroup> groups;
  final Duration duration;
  int get reclaimable => groups.fold(0, (sum, group) => sum + group.bytes);
}
