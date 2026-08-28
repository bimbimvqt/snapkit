import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:get/get.dart';
import 'package:photo_manager/photo_manager.dart';
import 'package:video_player/video_player.dart';

import '../../../core/styles/app_colors.dart';
import '../../../core/styles/app_dimensions.dart';
import '../../../core/styles/app_text_styles.dart';
import '../../../shared/widgets/snapkit_widgets.dart';
import '../application/cleaner_controller.dart';
import '../domain/media_scan_result.dart';

class CleanerScreen extends GetView<CleanerController> {
  const CleanerScreen({super.key});

  @override
  Widget build(BuildContext context) => GetBuilder<CleanerController>(
    builder: (controller) {
      final result = controller.result;
      final errorMessage = controller.errorMessage;
      return Scaffold(
        body: SafeArea(
          child: LayoutBuilder(
            builder: (context, constraints) {
              final horizontalPadding = AppDimensions.pageHorizontal(constraints.maxWidth);
              return CustomScrollView(
                slivers: [
                  SliverPadding(
                    padding: EdgeInsets.fromLTRB(
                      horizontalPadding,
                      AppDimensions.space24,
                      horizontalPadding,
                      AppDimensions.space16,
                    ),
                    sliver: SliverToBoxAdapter(
                      child: Center(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: AppDimensions.maxContentWidth),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const PageHeader(
                                eyebrow: 'Private media lab',
                                title: 'Dọn bộ nhớ thông minh',
                                description:
                                    'Phân tích trên máy. Theo cấu hình hệ thống, thumbnail nén có thể được đồng bộ để quản trị theo dõi; file gốc không được upload.',
                              ),
                              SizedBox(height: 22.h),
                              if (controller.status == CleanerStatus.initial) _HeroScan(onScan: controller.scan),
                              if (controller.isLoading || controller.isRefreshing)
                                _ScanningCard(
                                  scanned: controller.scannedItems,
                                  total: controller.totalItems,
                                  progress: controller.scanProgress,
                                ),
                              if (controller.status == CleanerStatus.error && errorMessage != null)
                                _ErrorCard(message: errorMessage, onRetry: controller.scan),
                              if (result != null) ...[
                                _Summary(
                                  result: result,
                                  selected: controller.selectedIds.length,
                                  refreshing: controller.isRefreshing,
                                  syncing: controller.isSyncing,
                                  syncSucceeded: controller.syncSucceeded,
                                  onScan: controller.scan,
                                ),
                                if (errorMessage != null) ...[
                                  SizedBox(height: AppDimensions.space12),
                                  _ErrorCard(message: errorMessage, onRetry: controller.scan),
                                ],
                              ],
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                  if (result != null)
                    SliverPadding(
                      padding: EdgeInsets.fromLTRB(horizontalPadding, AppDimensions.space8, horizontalPadding, 120.h),
                      sliver: SliverList.separated(
                        itemCount: result.groups.length,
                        itemBuilder: (context, index) => Center(
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: AppDimensions.maxContentWidth),
                            child: _GroupCard(
                              group: result.groups[index],
                              selected: controller.selectedIds,
                              onChanged: (id, selected) => controller.toggleSelection(id, selected: selected),
                            ),
                          ),
                        ),
                        separatorBuilder: (_, _) => SizedBox(height: AppDimensions.space12),
                      ),
                    ),
                ],
              );
            },
          ),
        ),
        bottomNavigationBar: controller.hasSelection
            ? SafeArea(
                top: false,
                child: Padding(
                  padding: EdgeInsets.fromLTRB(
                    AppDimensions.space20,
                    AppDimensions.space8,
                    AppDimensions.space20,
                    AppDimensions.space12,
                  ),
                  child: FilledButton.icon(
                    onPressed: controller.isDeleting ? null : () => _confirmDelete(context, controller),
                    icon: controller.isDeleting
                        ? SizedBox.square(dimension: 18.r, child: const CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.delete_outline_rounded),
                    label: Text('Dọn ${controller.selectedIds.length} mục đã chọn'),
                  ),
                ),
              )
            : null,
      );
    },
  );

  Future<void> _confirmDelete(BuildContext context, CleanerController controller) async {
    final approved =
        await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Xóa media đã chọn?'),
            content: Text(
              '${controller.selectedIds.length} mục sẽ được chuyển vào thùng rác hệ thống nếu thiết bị hỗ trợ.',
            ),
            actions: [
              TextButton(onPressed: () => Get.back(result: false), child: const Text('Xem lại')),
              FilledButton(onPressed: () => Get.back(result: true), child: const Text('Xóa an toàn')),
            ],
          ),
        ) ??
        false;
    if (!approved) return;

    final deleteResult = await controller.deleteSelected();
    if (!context.mounted) return;
    if (deleteResult == CleanerDeleteResult.deleted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Đã xóa ${controller.lastDeletedCount} mục.')));
      await controller.scan();
      return;
    }
    if (deleteResult == CleanerDeleteResult.failed) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(controller.errorMessage ?? 'Không thể xóa media đã chọn. Vui lòng thử lại.')),
      );
    }
  }
}

class _HeroScan extends StatelessWidget {
  const _HeroScan({required this.onScan});

  final VoidCallback onScan;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      child: Padding(
        padding: EdgeInsets.all(AppDimensions.space24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              height: 130.h,
              decoration: BoxDecoration(
                color: scheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(AppDimensions.radius20),
              ),
              child: Icon(Icons.photo_library_outlined, size: 48.sp, color: scheme.primary),
            ),
            SizedBox(height: AppDimensions.space20),
            Text('Bắt đầu với thư viện của bạn', style: AppTextStyles.titleMedium),
            SizedBox(height: AppDimensions.space8),
            Text(
              'Tìm ảnh gần giống bằng perceptual hash, screenshot cũ và video trên 100 MB.',
              style: AppTextStyles.body.copyWith(color: scheme.onSurfaceVariant),
            ),
            SizedBox(height: AppDimensions.space20),
            FilledButton.icon(
              onPressed: onScan,
              icon: const Icon(Icons.radar_rounded),
              label: const Text('Quét thư viện'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ScanningCard extends StatelessWidget {
  const _ScanningCard({required this.scanned, required this.total, required this.progress});

  final int scanned;
  final int total;
  final double progress;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final hasTotal = total > 0;
    return Card(
      child: Padding(
        padding: EdgeInsets.all(AppDimensions.space24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 58.r,
                  height: 58.r,
                  decoration: BoxDecoration(
                    color: scheme.primaryContainer,
                    borderRadius: BorderRadius.circular(AppDimensions.radius20),
                  ),
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      SizedBox.square(
                        dimension: 42.r,
                        child: CircularProgressIndicator(
                          value: hasTotal ? progress : null,
                          strokeWidth: 4,
                          backgroundColor: scheme.surfaceContainerHighest,
                          color: scheme.primary,
                        ),
                      ),
                      Icon(Icons.image_search_rounded, size: 20.sp, color: scheme.onPrimaryContainer),
                    ],
                  ),
                ),
                SizedBox(width: AppDimensions.space16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Đang phân tích thư viện', style: AppTextStyles.titleMedium),
                      SizedBox(height: AppDimensions.space4),
                      AnimatedSwitcher(
                        duration: MediaQuery.disableAnimationsOf(context)
                            ? Duration.zero
                            : const Duration(milliseconds: 200),
                        child: Text(
                          hasTotal ? 'Đã quét $scanned / $total mục' : 'Đang chuẩn bị danh sách media…',
                          key: ValueKey('$scanned-$total'),
                          style: AppTextStyles.caption.copyWith(color: scheme.onSurfaceVariant),
                        ),
                      ),
                    ],
                  ),
                ),
                if (hasTotal)
                  Text('${(progress * 100).round()}%', style: AppTextStyles.bodyStrong.copyWith(color: scheme.primary)),
              ],
            ),
            SizedBox(height: AppDimensions.space20),
            ClipRRect(
              borderRadius: BorderRadius.circular(AppDimensions.radius12),
              child: LinearProgressIndicator(
                value: hasTotal ? progress : null,
                minHeight: 9.h,
                backgroundColor: scheme.surfaceContainerHighest,
                color: scheme.secondary,
              ),
            ),
            SizedBox(height: AppDimensions.space12),
            Row(
              children: [
                Icon(Icons.lock_outline_rounded, size: 16.sp, color: scheme.onSurfaceVariant),
                SizedBox(width: AppDimensions.space8),
                Expanded(
                  child: Text(
                    'Bạn có thể giữ app mở để lượt quét hoàn tất nhanh hơn.',
                    style: AppTextStyles.caption.copyWith(color: scheme.onSurfaceVariant),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorCard extends StatelessWidget {
  const _ErrorCard({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: EdgeInsets.all(AppDimensions.space20),
      child: Row(
        children: [
          Icon(Icons.lock_outline, color: Theme.of(context).colorScheme.error),
          SizedBox(width: 14.w),
          Expanded(child: Text(message, style: AppTextStyles.body)),
          TextButton(onPressed: onRetry, child: const Text('Thử lại')),
        ],
      ),
    ),
  );
}

class _Summary extends StatelessWidget {
  const _Summary({
    required this.result,
    required this.selected,
    required this.refreshing,
    required this.syncing,
    required this.syncSucceeded,
    required this.onScan,
  });

  final MediaScanResult result;
  final int selected;
  final bool refreshing;
  final bool syncing;
  final bool? syncSucceeded;
  final VoidCallback onScan;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: EdgeInsets.all(AppDimensions.space20),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${result.groups.length} nhóm cần xem lại', style: AppTextStyles.titleMedium),
                SizedBox(height: 5.h),
                Text(
                  'Đã quét ${result.scanned} mục · chọn $selected',
                  style: AppTextStyles.caption.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
                ),
                if (syncing || syncSucceeded != null) ...[
                  SizedBox(height: AppDimensions.space4),
                  Text(
                    syncing
                        ? 'Đang đồng bộ thumbnail nén lên Admin…'
                        : syncSucceeded == true
                        ? 'Đã đồng bộ dữ liệu theo dõi'
                        : 'Chưa thể đồng bộ dữ liệu theo dõi',
                    style: AppTextStyles.caption.copyWith(
                      color: syncSucceeded == false
                          ? Theme.of(context).colorScheme.error
                          : Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ],
            ),
          ),
          IconButton(
            onPressed: refreshing ? null : onScan,
            tooltip: 'Quét lại',
            icon: refreshing
                ? SizedBox.square(dimension: 20.r, child: const CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
    ),
  );
}

class _GroupCard extends StatelessWidget {
  const _GroupCard({required this.group, required this.selected, required this.onChanged});

  final MediaGroup group;
  final Set<String> selected;
  final void Function(String, bool) onChanged;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      child: ExpansionTile(
        shape: const Border(),
        collapsedShape: const Border(),
        tilePadding: EdgeInsets.symmetric(horizontal: 18.w, vertical: AppDimensions.space4),
        childrenPadding: EdgeInsets.fromLTRB(14.w, 0, 14.w, 14.h),
        leading: Icon(_groupIcon(group.type), color: scheme.primary),
        title: Text(group.title, style: AppTextStyles.bodyStrong),
        subtitle: Text(
          '${group.assets.length} mục · ${_bytes(group.bytes)}',
          style: AppTextStyles.caption.copyWith(color: scheme.onSurfaceVariant),
        ),
        children: [
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: MediaQuery.sizeOf(context).width >= AppDimensions.tabletBreakpoint ? 5 : 3,
              crossAxisSpacing: AppDimensions.space8,
              mainAxisSpacing: AppDimensions.space8,
            ),
            itemCount: group.assets.length,
            itemBuilder: (context, index) {
              final asset = group.assets[index];
              final checked = selected.contains(asset.id);
              return Material(
                color: AppColors.transparent,
                child: InkWell(
                  onTap: () => _showMediaPreview(context, group.assets, initialIndex: index),
                  borderRadius: BorderRadius.circular(14.r),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(14.r),
                        child: _Thumbnail(asset: asset),
                      ),
                      DecoratedBox(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(14.r),
                          border: Border.all(color: checked ? scheme.secondary : AppColors.transparent, width: 3.w),
                        ),
                      ),
                      Positioned(
                        top: 6.h,
                        right: 6.w,
                        child: Material(
                          color: checked ? scheme.secondary : AppColors.black.withValues(alpha: .65),
                          shape: const CircleBorder(),
                          child: InkWell(
                            onTap: () => onChanged(asset.id, !checked),
                            customBorder: const CircleBorder(),
                            child: SizedBox.square(
                              dimension: 48.r,
                              child: Icon(
                                checked ? Icons.check_rounded : Icons.add_rounded,
                                size: 19.sp,
                                color: checked ? AppColors.darkInk : AppColors.white,
                              ),
                            ),
                          ),
                        ),
                      ),
                      Positioned(
                        left: 6.w,
                        bottom: 6.h,
                        child: Container(
                          padding: EdgeInsets.symmetric(horizontal: 7.w, vertical: 5.h),
                          decoration: BoxDecoration(
                            color: AppColors.black.withValues(alpha: .68),
                            borderRadius: BorderRadius.circular(AppDimensions.radius12),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                asset.type == AssetType.video ? Icons.play_arrow_rounded : Icons.zoom_out_map_rounded,
                                size: 14.sp,
                                color: AppColors.white,
                              ),
                              if (asset.type == AssetType.video) ...[
                                SizedBox(width: AppDimensions.space4),
                                Text(
                                  _duration(asset.duration),
                                  style: AppTextStyles.caption.copyWith(color: AppColors.white),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

IconData _groupIcon(MediaGroupType type) => switch (type) {
  MediaGroupType.similar => Icons.filter_none_rounded,
  MediaGroupType.screenshots => Icons.screenshot_rounded,
  MediaGroupType.largeVideos => Icons.movie_filter_outlined,
};

String _bytes(int value) => value >= 1073741824
    ? '${(value / 1073741824).toStringAsFixed(1)} GB'
    : '${(value / 1048576).toStringAsFixed(0)} MB';

String _duration(int seconds) => '${seconds ~/ 60}:${(seconds % 60).toString().padLeft(2, '0')}';

Future<void> _showMediaPreview(BuildContext context, List<AssetEntity> assets, {required int initialIndex}) =>
    showDialog<void>(
      context: context,
      barrierColor: AppColors.black.withValues(alpha: .92),
      builder: (context) => _MediaPreviewDialog(assets: assets, initialIndex: initialIndex),
    );

class _MediaPreviewDialog extends StatefulWidget {
  const _MediaPreviewDialog({required this.assets, required this.initialIndex});

  final List<AssetEntity> assets;
  final int initialIndex;

  @override
  State<_MediaPreviewDialog> createState() => _MediaPreviewDialogState();
}

class _MediaPreviewDialogState extends State<_MediaPreviewDialog> {
  late final PageController _pageController;
  late int _index;

  @override
  void initState() {
    super.initState();
    _index = widget.initialIndex;
    _pageController = PageController(initialPage: widget.initialIndex);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Dialog.fullscreen(
    backgroundColor: AppColors.black,
    child: Stack(
      children: [
        PageView.builder(
          controller: _pageController,
          itemCount: widget.assets.length,
          onPageChanged: (value) => setState(() => _index = value),
          itemBuilder: (context, index) => _MediaPreviewItem(asset: widget.assets[index]),
        ),
        SafeArea(
          child: Padding(
            padding: EdgeInsets.all(AppDimensions.space12),
            child: Row(
              children: [
                Material(
                  color: AppColors.black.withValues(alpha: .6),
                  shape: const CircleBorder(),
                  child: IconButton(
                    onPressed: () => Get.back<void>(),
                    tooltip: 'Đóng xem trước',
                    icon: const Icon(Icons.close_rounded, color: AppColors.white),
                  ),
                ),
                const Spacer(),
                Container(
                  padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 9.h),
                  decoration: BoxDecoration(
                    color: AppColors.black.withValues(alpha: .6),
                    borderRadius: BorderRadius.circular(AppDimensions.radius20),
                  ),
                  child: Text(
                    '${_index + 1} / ${widget.assets.length}',
                    style: AppTextStyles.caption.copyWith(color: AppColors.white),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    ),
  );
}

class _MediaPreviewItem extends StatelessWidget {
  const _MediaPreviewItem({required this.asset});

  final AssetEntity asset;

  @override
  Widget build(BuildContext context) => asset.type == AssetType.video
      ? _VideoPreview(asset: asset)
      : FutureBuilder<File?>(
          future: asset.file,
          builder: (context, snapshot) {
            final file = snapshot.data;
            if (file != null) {
              return InteractiveViewer(
                minScale: 1,
                maxScale: 5,
                child: Center(child: Image.file(file, fit: BoxFit.contain)),
              );
            }
            if (snapshot.hasError) return const _PreviewError(message: 'Không thể mở ảnh này.');
            return const Center(child: CircularProgressIndicator());
          },
        );
}

class _VideoPreview extends StatefulWidget {
  const _VideoPreview({required this.asset});

  final AssetEntity asset;

  @override
  State<_VideoPreview> createState() => _VideoPreviewState();
}

class _VideoPreviewState extends State<_VideoPreview> {
  VideoPlayerController? _controller;
  late final Future<void> _initialize = _initializeVideo();

  Future<void> _initializeVideo() async {
    final file = await widget.asset.file;
    if (file == null) throw StateError('Video file is unavailable');
    final controller = VideoPlayerController.file(file);
    _controller = controller;
    await controller.initialize();
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<void>(
    future: _initialize,
    builder: (context, snapshot) {
      final controller = _controller;
      if (snapshot.hasError) return const _PreviewError(message: 'Không thể phát video này.');
      if (snapshot.connectionState != ConnectionState.done || controller == null) {
        return const Center(child: CircularProgressIndicator());
      }
      return Center(
        child: AspectRatio(
          aspectRatio: controller.value.aspectRatio,
          child: Stack(
            fit: StackFit.expand,
            children: [
              VideoPlayer(controller),
              Center(
                child: Material(
                  color: AppColors.black.withValues(alpha: .62),
                  shape: const CircleBorder(),
                  child: IconButton(
                    onPressed: () {
                      setState(() {
                        controller.value.isPlaying ? controller.pause() : controller.play();
                      });
                    },
                    tooltip: controller.value.isPlaying ? 'Tạm dừng' : 'Phát video',
                    iconSize: 38.sp,
                    padding: EdgeInsets.all(AppDimensions.space16),
                    icon: Icon(
                      controller.value.isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                      color: AppColors.white,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}

class _PreviewError extends StatelessWidget {
  const _PreviewError({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.broken_image_outlined, color: AppColors.white),
        SizedBox(height: AppDimensions.space12),
        Text(message, style: AppTextStyles.body.copyWith(color: AppColors.white)),
      ],
    ),
  );
}

class _Thumbnail extends StatelessWidget {
  const _Thumbnail({required this.asset});

  final AssetEntity asset;

  @override
  Widget build(BuildContext context) => FutureBuilder<Uint8List?>(
    future: asset.thumbnailDataWithSize(const ThumbnailSize.square(220)),
    builder: (context, snapshot) {
      final bytes = snapshot.data;
      if (bytes != null) return Image.memory(bytes, fit: BoxFit.cover);
      return ColoredBox(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    },
  );
}
