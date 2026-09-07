import 'package:flutter_test/flutter_test.dart';
import 'package:photo_manager/photo_manager.dart';
import 'package:snapkit/features/cleaner/domain/media_scan_result.dart';

void main() {
  test('reclaimable bytes count overlapping assets only once', () {
    final keeper = _asset('keeper');
    final duplicate = _asset('duplicate');
    final screenshot = _asset('screenshot');
    final result = MediaScanResult(
      scanned: 3,
      duration: const Duration(milliseconds: 80),
      groups: [
        MediaGroup(type: MediaGroupType.similar, title: 'Nhóm 1', assets: [keeper, duplicate], bytes: 200),
        MediaGroup(
          type: MediaGroupType.screenshots,
          title: 'Ảnh chụp màn hình',
          assets: [duplicate, screenshot],
          bytes: 500,
        ),
      ],
      assets: [
        ScannedMediaAsset(asset: keeper, bytes: 100, categories: const {MediaAssetCategory.similar}),
        ScannedMediaAsset(
          asset: duplicate,
          bytes: 200,
          categories: const {MediaAssetCategory.similar, MediaAssetCategory.screenshot},
        ),
        ScannedMediaAsset(asset: screenshot, bytes: 300, categories: const {MediaAssetCategory.screenshot}),
      ],
    );

    expect(result.reclaimableAssetIds, {'duplicate', 'screenshot'});
    expect(result.reclaimable, 500);
    expect(result.categoryBytes(MediaGroupType.similar), 200);
    expect(result.categoryBytes(MediaGroupType.screenshots), 300);
    expect(result.bytesFor({'duplicate', 'screenshot'}), 500);
  });
}

AssetEntity _asset(String id) => AssetEntity(id: id, typeInt: AssetType.image.index, width: 100, height: 100);
