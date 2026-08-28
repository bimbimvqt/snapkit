import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:get/get.dart';
import 'package:photo_manager/photo_manager.dart';

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
                                    'Phân tích thumbnail độ phân giải thấp ngay trên máy. Không upload ảnh/video.',
                              ),
                              SizedBox(height: 22.h),
                              if (controller.status == CleanerStatus.initial) _HeroScan(onScan: controller.scan),
                              if (controller.isLoading) const _ScanningCard(),
                              if (controller.status == CleanerStatus.error && errorMessage != null)
                                _ErrorCard(message: errorMessage, onRetry: controller.scan),
                              if (result != null) ...[
                                _Summary(
                                  result: result,
                                  selected: controller.selectedIds.length,
                                  refreshing: controller.isRefreshing,
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
  const _ScanningCard();

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: EdgeInsets.all(AppDimensions.space28),
      child: Column(
        children: [
          CircularProgressIndicator(color: Theme.of(context).colorScheme.secondary),
          SizedBox(height: 18.h),
          Text('Đang phân tích an toàn…', style: AppTextStyles.bodyStrong),
          SizedBox(height: 6.h),
          Text(
            'Có thể mất một lúc với thư viện lớn',
            style: AppTextStyles.caption.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
          ),
        ],
      ),
    ),
  );
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
  const _Summary({required this.result, required this.selected, required this.refreshing, required this.onScan});

  final MediaScanResult result;
  final int selected;
  final bool refreshing;
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
                  onTap: () => onChanged(asset.id, !checked),
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
                        child: Container(
                          width: 28.r,
                          height: 28.r,
                          decoration: BoxDecoration(
                            color: checked ? scheme.secondary : AppColors.black.withValues(alpha: .65),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            checked ? Icons.check_rounded : Icons.add_rounded,
                            size: 17.sp,
                            color: checked ? AppColors.darkInk : AppColors.white,
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
