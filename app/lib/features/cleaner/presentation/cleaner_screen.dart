import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:get/get.dart';
import 'package:photo_manager/photo_manager.dart';

import '../../../core/routes/app_routes.dart';
import '../../../core/styles/app_colors.dart';
import '../../../core/styles/app_dimensions.dart';
import '../../../core/styles/app_text_styles.dart';
import '../../../shared/widgets/snapkit_widgets.dart';
import '../application/cleaner_controller.dart';
import '../domain/media_scan_result.dart';
import 'widgets/video_preview.dart';

class CleanerScreen extends StatefulWidget {
  const CleanerScreen({super.key});

  @override
  State<CleanerScreen> createState() => _CleanerScreenState();
}

enum _MediaFilter {
  all('Tất cả'),
  similar('Ảnh tương tự'),
  screenshots('Ảnh chụp màn hình'),
  largeVideos('Video lớn');

  const _MediaFilter(this.label);
  final String label;
}

class _CleanerScreenState extends State<CleanerScreen> {
  _MediaFilter _activeFilter = _MediaFilter.all;

  @override
  Widget build(BuildContext context) => GetBuilder<CleanerController>(
    builder: (controller) {
      final result = controller.result;
      final errorMessage = controller.errorMessage;

      final filteredGroups = result == null ? const <MediaGroup>[] : _filteredGroups(result, _activeFilter);

      return Scaffold(
        body: SafeArea(
          child: LayoutBuilder(
            builder: (context, constraints) {
              final horizontalPadding = AppDimensions.pageHorizontal(constraints.maxWidth);
              return Stack(
                children: [
                  CustomScrollView(
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
                                    eyebrow: 'Thư viện',
                                    title: 'Dọn bộ nhớ thông minh',
                                    description: 'Tìm nội dung chiếm dung lượng và xem lại kỹ trước khi xóa.',
                                  ),
                                  SizedBox(height: 22.h),
                                  if (controller.status == CleanerStatus.initial)
                                    _HeroScan(onScan: () => _requestScan(context, controller)),
                                  if (controller.isLoading || controller.isRefreshing)
                                    Column(
                                      children: [
                                        _ScanningCard(
                                          scanned: controller.scannedItems,
                                          total: controller.totalItems,
                                          progress: controller.scanProgress,
                                        ),
                                        SizedBox(height: 22.h),
                                      ],
                                    ),
                                  if (controller.status == CleanerStatus.error && errorMessage != null)
                                    _ErrorCard(message: errorMessage, onRetry: () => _requestScan(context, controller)),
                                  if (result != null) ...[
                                    _StorageSummary(
                                      result: result,
                                      refreshing: controller.isRefreshing || controller.isDeleting,
                                      syncing: controller.isSyncing,
                                      onScan: () => _requestScan(context, controller),
                                    ),
                                    SizedBox(height: AppDimensions.space12),
                                    _QuickActionCard(
                                      recommendedCount: controller.recommendedIds.length,
                                      recommendedBytes: result.bytesFor(controller.recommendedIds),
                                      selectedRecommendedCount: controller.recommendedIds
                                          .where(controller.selectedIds.contains)
                                          .length,
                                      onSelectRecommended: controller.selectRecommended,
                                    ),
                                    SizedBox(height: AppDimensions.space20),
                                    _CategoryPicker(
                                      result: result,
                                      activeFilter: _activeFilter,
                                      onFilterChanged: (filter) => setState(() => _activeFilter = filter),
                                    ),
                                    if (errorMessage != null) ...[
                                      SizedBox(height: AppDimensions.space12),
                                      _ErrorCard(
                                        message: errorMessage,
                                        onRetry: () => _requestScan(context, controller),
                                      ),
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
                          padding: EdgeInsets.fromLTRB(
                            horizontalPadding,
                            AppDimensions.space8,
                            horizontalPadding,
                            140.h,
                          ),
                          sliver: filteredGroups.isEmpty
                              ? SliverToBoxAdapter(
                                  child: Center(
                                    child: Padding(
                                      padding: EdgeInsets.all(AppDimensions.space32),
                                      child: Text(
                                        'Không có mục nào trong danh mục này.',
                                        style: AppTextStyles.body.copyWith(
                                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                                        ),
                                      ),
                                    ),
                                  ),
                                )
                              : SliverList.separated(
                                  itemCount: filteredGroups.length,
                                  itemBuilder: (context, index) => Center(
                                    child: ConstrainedBox(
                                      constraints: const BoxConstraints(maxWidth: AppDimensions.maxContentWidth),
                                      child: _GroupCard(
                                        key: ValueKey(_groupKey(filteredGroups[index])),
                                        group: filteredGroups[index],
                                        selected: controller.selectedIds,
                                        onChanged: (id, selected) => controller.toggleSelection(id, selected: selected),
                                        onGroupChanged: (ids, selected) =>
                                            controller.setSelection(ids, selected: selected),
                                      ),
                                    ),
                                  ),
                                  separatorBuilder: (_, _) => SizedBox(height: AppDimensions.space12),
                                ),
                        ),
                    ],
                  ),
                  Positioned(
                    left: horizontalPadding,
                    right: horizontalPadding,
                    bottom: 14.h,
                    child: Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: AppDimensions.maxContentWidth),
                        child: AnimatedSlide(
                          duration: const Duration(milliseconds: 240),
                          curve: Curves.easeOutCubic,
                          offset: controller.hasSelection ? Offset.zero : const Offset(0, 1.8),
                          child: AnimatedOpacity(
                            duration: const Duration(milliseconds: 200),
                            opacity: controller.hasSelection ? 1.0 : 0.0,
                            child: IgnorePointer(
                              ignoring: !controller.hasSelection,
                              child: _FloatingCleanDock(
                                count: controller.selectedIds.length,
                                bytes: controller.selectedBytes,
                                isDeleting: controller.isDeleting,
                                onDelete: controller.isDeleting || controller.isRefreshing
                                    ? null
                                    : () => _confirmDelete(context, controller),
                                onOpenAI:
                                    controller.canOpenAIStudio && !controller.isDeleting && !controller.isRefreshing
                                    ? () => _openSelectedImagesInAIStudio(context, controller)
                                    : null,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      );
    },
  );

  Future<void> _requestScan(BuildContext context, CleanerController controller) async {
    if (controller.isLoading || controller.isRefreshing || controller.isDeleting) return;
    var allowMediaUpload = false;
    if (controller.mediaUploadIsAvailable) {
      final choice = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          scrollable: true,
          title: const Text('Chọn cách quét thư viện'),
          content: const Text(
            'Phân tích được thực hiện trên thiết bị. Bạn có thể chọn gửi thêm ảnh xem trước, video và thông tin '
            'media tới máy chủ Snapkit để quản trị viên xem. Lựa chọn đồng bộ chỉ áp dụng cho lần quét này. '
            'Quét trên máy vẫn dùng được đầy đủ; chỉ số tổng hợp của lần quét có thể được gửi về máy chủ.',
          ),
          actions: [
            TextButton(onPressed: () => Get.back(result: true), child: const Text('Đồng ý gửi media')),
            FilledButton(onPressed: () => Get.back(result: false), child: const Text('Quét trên máy')),
          ],
        ),
      );
      if (choice == null || !context.mounted) return;
      allowMediaUpload = choice;
    }
    await controller.scan(allowMediaUpload: allowMediaUpload);
  }

  Future<void> _confirmDelete(BuildContext context, CleanerController controller) async {
    final approved =
        await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Xóa media đã chọn?'),
            content: Text(
              '${controller.selectedIds.length} mục sẽ bị xóa khỏi thư viện. Nếu thiết bị không hỗ trợ thùng rác, '
              'bạn có thể không khôi phục được. Hãy kiểm tra kỹ ảnh tương tự trước khi xác nhận.',
            ),
            actions: [
              TextButton(onPressed: () => Get.back(result: false), child: const Text('Xem lại')),
              FilledButton(onPressed: () => Get.back(result: true), child: const Text('Xóa mục đã chọn')),
            ],
          ),
        ) ??
        false;
    if (!approved || !context.mounted) return;

    final deleteResult = await controller.deleteSelected();
    if (!context.mounted) return;
    if (deleteResult == CleanerDeleteResult.deleted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Đã xóa ${controller.lastDeletedCount} mục.')));
      return;
    }
    if (deleteResult == CleanerDeleteResult.empty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Chưa có mục nào bị xóa.')));
      return;
    }
    if (deleteResult == CleanerDeleteResult.failed) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(controller.errorMessage ?? 'Không thể xóa media đã chọn. Vui lòng thử lại.')),
      );
    }
  }

  Future<void> _openSelectedImagesInAIStudio(BuildContext context, CleanerController controller) async {
    final paths = await controller.selectedImagePathsForAIStudio();
    if (!context.mounted) return;
    if (paths.isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Không thể đọc ảnh đã chọn. Vui lòng chọn lại ảnh.')));
      return;
    }
    Get.toNamed(AppRoutes.captionStudio, arguments: paths);
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
              height: 140.h,
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  colors: [scheme.primary.withValues(alpha: .28), scheme.surfaceContainerHighest],
                  radius: 0.85,
                ),
                borderRadius: BorderRadius.circular(AppDimensions.radius20),
                border: Border.all(color: scheme.primary.withValues(alpha: .2)),
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Container(
                    width: 80.r,
                    height: 80.r,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: scheme.primary.withValues(alpha: .12),
                      border: Border.all(color: scheme.primary.withValues(alpha: .3)),
                    ),
                  ),
                  Icon(Icons.radar_rounded, size: 48.sp, color: scheme.primary),
                ],
              ),
            ),
            SizedBox(height: AppDimensions.space20),
            Text('Bắt đầu với thư viện của bạn', style: AppTextStyles.titleMedium),
            SizedBox(height: AppDimensions.space8),
            Text(
              'Gom ảnh gần giống, ảnh chụp màn hình và video lớn để bạn xem lại nhanh hơn.',
              style: AppTextStyles.body.copyWith(color: scheme.onSurfaceVariant),
            ),
            SizedBox(height: AppDimensions.space16),
            Wrap(
              spacing: 8.w,
              runSpacing: 6.h,
              children: [
                _SecurityBadge(icon: Icons.lock_outline_rounded, label: 'Chỉ xử lý trên máy'),
                _SecurityBadge(icon: Icons.shield_outlined, label: 'Xem lại trước khi xóa'),
              ],
            ),
            SizedBox(height: AppDimensions.space20),
            FilledButton.icon(
              onPressed: onScan,
              style: FilledButton.styleFrom(
                minimumSize: Size(double.infinity, 52.h),
                backgroundColor: scheme.secondary,
                foregroundColor: AppColors.darkInk,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16.r)),
              ),
              icon: const Icon(Icons.radar_rounded, color: AppColors.darkInk),
              label: const Text(
                'Quét thư viện',
                style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.darkInk),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SecurityBadge extends StatelessWidget {
  const _SecurityBadge({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 5.h),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(99.r),
        border: Border.all(color: scheme.outlineVariant.withValues(alpha: .6)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13.sp, color: scheme.primary),
          SizedBox(width: 5.w),
          Text(
            label,
            style: AppTextStyles.caption.copyWith(
              color: scheme.onSurfaceVariant,
              fontSize: 11.sp,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
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
                    color: scheme.primary.withValues(alpha: .14),
                    borderRadius: BorderRadius.circular(AppDimensions.radius20),
                    border: Border.all(color: scheme.primary.withValues(alpha: .3)),
                  ),
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      SizedBox.square(
                        dimension: 42.r,
                        child: CircularProgressIndicator(
                          value: hasTotal ? progress : null,
                          strokeWidth: 3.5,
                          backgroundColor: scheme.surfaceContainerHighest,
                          color: scheme.secondary,
                        ),
                      ),
                      Icon(Icons.image_search_rounded, size: 20.sp, color: scheme.primary),
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
                      Text(
                        hasTotal ? 'Đã quét $scanned / $total mục' : 'Đang chuẩn bị danh sách media…',
                        style: AppTextStyles.caption.copyWith(
                          color: scheme.onSurfaceVariant,
                          fontFeatures: const [FontFeature.tabularFigures()],
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
                minHeight: 8.h,
                backgroundColor: scheme.surfaceContainerHighest,
                color: scheme.secondary,
              ),
            ),
            SizedBox(height: AppDimensions.space12),
            Row(
              children: [
                Icon(Icons.lock_outline_rounded, size: 15.sp, color: scheme.onSurfaceVariant),
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

class _StorageSummary extends StatelessWidget {
  const _StorageSummary({required this.result, required this.refreshing, required this.syncing, required this.onScan});

  final MediaScanResult result;
  final bool refreshing;
  final bool syncing;
  final VoidCallback onScan;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final segments = [
      _StorageSegment(
        label: 'Ảnh tương tự',
        bytes: result.categoryBytes(MediaGroupType.similar),
        color: scheme.secondary,
      ),
      _StorageSegment(
        label: 'Ảnh màn hình',
        bytes: result.categoryBytes(MediaGroupType.screenshots),
        color: scheme.primary,
      ),
      _StorageSegment(label: 'Video lớn', bytes: result.categoryBytes(MediaGroupType.largeVideos), color: scheme.error),
    ];
    final stackVertically = MediaQuery.textScalerOf(context).scale(1) > 1.3;

    final chart = SizedBox.square(
      dimension: 138.r,
      child: CustomPaint(
        painter: _StorageRingPainter(segments: segments, trackColor: scheme.outlineVariant.withValues(alpha: .35)),
        child: Center(
          child: Padding(
            padding: EdgeInsets.all(AppDimensions.space16),
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(_bytes(result.reclaimable), style: AppTextStyles.titleLarge),
                  SizedBox(height: 2.h),
                  Text('có thể dọn', style: AppTextStyles.caption.copyWith(color: scheme.onSurfaceVariant)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
    final legend = Column(
      children: segments
          .map(
            (segment) => Padding(
              padding: EdgeInsets.only(bottom: AppDimensions.space8),
              child: _StorageLegend(segment: segment),
            ),
          )
          .toList(growable: false),
    );

    return Card(
      child: Padding(
        padding: EdgeInsets.all(AppDimensions.space20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text('Tổng quan dung lượng', style: AppTextStyles.titleMedium)),
                if (syncing)
                  Padding(
                    padding: EdgeInsets.only(right: AppDimensions.space8),
                    child: Text('Đang đồng bộ', style: AppTextStyles.caption.copyWith(color: scheme.primary)),
                  ),
                IconButton(
                  onPressed: refreshing ? null : onScan,
                  tooltip: 'Quét lại thư viện',
                  icon: refreshing
                      ? SizedBox.square(
                          dimension: AppDimensions.iconSmall,
                          child: CircularProgressIndicator(strokeWidth: 2, color: scheme.primary),
                        )
                      : Icon(Icons.refresh_rounded, color: scheme.primary),
                ),
              ],
            ),
            SizedBox(height: AppDimensions.space12),
            if (stackVertically) ...[
              Center(child: chart),
              SizedBox(height: AppDimensions.space16),
              legend,
            ] else
              Row(
                children: [
                  chart,
                  SizedBox(width: AppDimensions.space16),
                  Expanded(child: legend),
                ],
              ),
            SizedBox(height: AppDimensions.space8),
            Text(
              'Đã quét ${result.scanned} mục trong ${_scanDuration(result.duration)}',
              style: AppTextStyles.caption.copyWith(color: scheme.onSurfaceVariant),
            ),
          ],
        ),
      ),
    );
  }
}

class _StorageSegment {
  const _StorageSegment({required this.label, required this.bytes, required this.color});

  final String label;
  final int bytes;
  final Color color;
}

class _StorageLegend extends StatelessWidget {
  const _StorageLegend({required this.segment});

  final _StorageSegment segment;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      constraints: BoxConstraints(minHeight: AppDimensions.minTouchTarget),
      padding: EdgeInsets.symmetric(horizontal: AppDimensions.space12, vertical: AppDimensions.space8),
      decoration: BoxDecoration(
        color: segment.color.withValues(alpha: .09),
        borderRadius: BorderRadius.circular(AppDimensions.radius12),
        border: Border.all(color: segment.color.withValues(alpha: .35)),
      ),
      child: Row(
        children: [
          Container(
            width: 10.r,
            height: 10.r,
            decoration: BoxDecoration(color: segment.color, shape: BoxShape.circle),
          ),
          SizedBox(width: AppDimensions.space8),
          Expanded(
            child: Text(
              segment.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.caption.copyWith(color: scheme.onSurface),
            ),
          ),
          SizedBox(width: AppDimensions.space8),
          Text(_bytes(segment.bytes), style: AppTextStyles.label.copyWith(color: segment.color)),
        ],
      ),
    );
  }
}

class _StorageRingPainter extends CustomPainter {
  const _StorageRingPainter({required this.segments, required this.trackColor});

  final List<_StorageSegment> segments;
  final Color trackColor;

  @override
  void paint(Canvas canvas, Size size) {
    final strokeWidth = size.shortestSide * .105;
    final rect = Offset.zero & size;
    final arcRect = rect.deflate(strokeWidth / 2);
    final track = Paint()
      ..color = trackColor
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = strokeWidth;
    canvas.drawArc(arcRect, -1.5708, 6.2832, false, track);

    final total = segments.fold<int>(0, (sum, segment) => sum + segment.bytes);
    if (total <= 0) return;
    const gap = .08;
    var start = -1.5708;
    for (final segment in segments.where((segment) => segment.bytes > 0)) {
      final sweep = (segment.bytes / total) * 6.2832;
      final paint = Paint()
        ..color = segment.color
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeWidth = strokeWidth;
      canvas.drawArc(arcRect, start + gap / 2, (sweep - gap).clamp(.02, 6.2832), false, paint);
      start += sweep;
    }
  }

  @override
  bool shouldRepaint(covariant _StorageRingPainter oldDelegate) =>
      oldDelegate.trackColor != trackColor ||
      oldDelegate.segments.length != segments.length ||
      List.generate(
        segments.length,
        (index) => segments[index].bytes,
      ).asMap().entries.any((entry) => oldDelegate.segments[entry.key].bytes != entry.value);
}

class _QuickActionCard extends StatelessWidget {
  const _QuickActionCard({
    required this.recommendedCount,
    required this.recommendedBytes,
    required this.selectedRecommendedCount,
    required this.onSelectRecommended,
  });

  final int recommendedCount;
  final int recommendedBytes;
  final int selectedRecommendedCount;
  final VoidCallback onSelectRecommended;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final allSelected = recommendedCount > 0 && selectedRecommendedCount == recommendedCount;
    return Container(
      padding: const EdgeInsets.all(1.2),
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: [scheme.secondary, scheme.primary]),
        borderRadius: BorderRadius.circular(AppDimensions.radius24),
        boxShadow: [BoxShadow(color: scheme.primary.withValues(alpha: .14), blurRadius: 22.r, offset: Offset(0, 8.h))],
      ),
      child: Container(
        padding: EdgeInsets.all(AppDimensions.space20),
        decoration: BoxDecoration(
          color: scheme.surface,
          borderRadius: BorderRadius.circular(AppDimensions.radius24 - 1.2),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Container(
                  width: 44.r,
                  height: 44.r,
                  decoration: BoxDecoration(
                    color: scheme.secondary.withValues(alpha: .14),
                    borderRadius: BorderRadius.circular(AppDimensions.radius12),
                  ),
                  child: Icon(Icons.auto_awesome_rounded, color: scheme.secondary),
                ),
                SizedBox(width: AppDimensions.space12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Dọn nhanh thông minh', style: AppTextStyles.bodyStrong),
                      SizedBox(height: 2.h),
                      Text(
                        recommendedCount == 0
                            ? 'Chưa có ảnh trùng được đề xuất'
                            : '$recommendedCount ảnh · ${_bytes(recommendedBytes)} có thể dọn',
                        style: AppTextStyles.caption.copyWith(color: scheme.onSurfaceVariant),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            SizedBox(height: AppDimensions.space16),
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(colors: [scheme.secondary, scheme.primary]),
                borderRadius: BorderRadius.circular(AppDimensions.radius16),
              ),
              child: FilledButton.icon(
                onPressed: recommendedCount == 0 || allSelected ? null : onSelectRecommended,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.transparent,
                  disabledBackgroundColor: scheme.surfaceContainerHighest,
                  foregroundColor: scheme.onSecondary,
                  disabledForegroundColor: scheme.onSurfaceVariant,
                  shadowColor: AppColors.transparent,
                ),
                icon: Icon(allSelected ? Icons.done_all_rounded : Icons.auto_fix_high_rounded),
                label: Text(allSelected ? 'Đã chọn đề xuất' : 'Chọn nội dung đề xuất'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CategoryPicker extends StatelessWidget {
  const _CategoryPicker({required this.result, required this.activeFilter, required this.onFilterChanged});

  final MediaScanResult result;
  final _MediaFilter activeFilter;
  final ValueChanged<_MediaFilter> onFilterChanged;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Danh mục media', style: AppTextStyles.titleMedium),
        SizedBox(height: AppDimensions.space12),
        SizedBox(
          height: 104.h,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: _MediaFilter.values.length,
            separatorBuilder: (_, _) => SizedBox(width: AppDimensions.space8),
            itemBuilder: (context, index) {
              final filter = _MediaFilter.values[index];
              final selected = filter == activeFilter;
              final color = _filterColor(filter, scheme);
              return SizedBox(
                width: 132.w.clamp(120, 152),
                child: Material(
                  color: selected ? color.withValues(alpha: .18) : scheme.surface,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppDimensions.radius20),
                    side: BorderSide(color: selected ? color : scheme.outlineVariant, width: selected ? 1.8 : 1),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: () => onFilterChanged(filter),
                    child: Padding(
                      padding: EdgeInsets.all(AppDimensions.space12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(_filterIcon(filter), color: color, size: AppDimensions.iconMedium),
                          const Spacer(),
                          Text(filter.label, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppTextStyles.label),
                          SizedBox(height: 2.h),
                          Text(
                            _filterMetric(filter, result),
                            style: AppTextStyles.caption.copyWith(color: scheme.onSurfaceVariant),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _GroupCard extends StatelessWidget {
  const _GroupCard({
    required this.group,
    required this.selected,
    required this.onChanged,
    required this.onGroupChanged,
    super.key,
  });

  final MediaGroup group;
  final Set<String> selected;
  final void Function(String, bool) onChanged;
  final void Function(Iterable<String>, bool) onGroupChanged;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final color = _groupColor(group.type, scheme);
    final selectableAssets = group.type == MediaGroupType.similar ? group.assets.skip(1).toList() : group.assets;
    final allSelectedInGroup =
        selectableAssets.isNotEmpty && selectableAssets.every((asset) => selected.contains(asset.id));
    final thumbnailWidth = (MediaQuery.sizeOf(context).width * .36).clamp(124.0, 168.0);

    return Card(
      clipBehavior: Clip.antiAlias,
      child: RepaintBoundary(
        child: Padding(
          padding: EdgeInsets.all(AppDimensions.space16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 44.r,
                    height: 44.r,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: .14),
                      borderRadius: BorderRadius.circular(AppDimensions.radius12),
                    ),
                    child: Icon(_groupIcon(group.type), color: color, size: AppDimensions.iconMedium),
                  ),
                  SizedBox(width: AppDimensions.space12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          group.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.bodyStrong,
                        ),
                        SizedBox(height: 2.h),
                        Text(
                          '${group.assets.length} mục · ${_bytes(group.bytes)}',
                          style: AppTextStyles.caption.copyWith(color: scheme.onSurfaceVariant),
                        ),
                      ],
                    ),
                  ),
                  TextButton.icon(
                    onPressed: selectableAssets.isEmpty
                        ? null
                        : () => onGroupChanged(selectableAssets.map((asset) => asset.id), !allSelectedInGroup),
                    style: TextButton.styleFrom(
                      foregroundColor: color,
                      minimumSize: const Size(48, 48),
                      padding: EdgeInsets.symmetric(horizontal: AppDimensions.space8),
                    ),
                    icon: Icon(allSelectedInGroup ? Icons.remove_done_rounded : Icons.done_all_rounded, size: 18.sp),
                    label: Text(allSelectedInGroup ? 'Bỏ chọn' : 'Chọn hết', style: AppTextStyles.label),
                  ),
                ],
              ),
              SizedBox(height: AppDimensions.space16),
              SizedBox(
                height: thumbnailWidth,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  cacheExtent: thumbnailWidth * 2,
                  itemCount: group.assets.length,
                  separatorBuilder: (_, _) => SizedBox(width: AppDimensions.space8),
                  itemBuilder: (context, index) {
                    final asset = group.assets[index];
                    final checked = selected.contains(asset.id);
                    final isBestShot = group.type == MediaGroupType.similar && index == 0;

                    return SizedBox(
                      width: thumbnailWidth,
                      child: _MediaTile(
                        key: ValueKey(asset.id),
                        asset: asset,
                        checked: checked,
                        isBestShot: isBestShot,
                        selectionColor: color,
                        onPreview: () => _showMediaPreview(context, group.assets, initialIndex: index),
                        onSelectionChanged: () => onChanged(asset.id, !checked),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MediaTile extends StatelessWidget {
  const _MediaTile({
    required this.asset,
    required this.checked,
    required this.isBestShot,
    required this.selectionColor,
    required this.onPreview,
    required this.onSelectionChanged,
    super.key,
  });

  final AssetEntity asset;
  final bool checked;
  final bool isBestShot;
  final Color selectionColor;
  final VoidCallback onPreview;
  final VoidCallback onSelectionChanged;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: AppColors.transparent,
      child: InkWell(
        onTap: onPreview,
        borderRadius: BorderRadius.circular(AppDimensions.radius16),
        child: Stack(
          fit: StackFit.expand,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(AppDimensions.radius16),
              child: RepaintBoundary(
                child: _Thumbnail(key: ValueKey('thumbnail-${asset.id}'), asset: asset),
              ),
            ),
            DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(AppDimensions.radius16),
                border: Border.all(color: checked ? selectionColor : scheme.outlineVariant, width: checked ? 3 : 1),
              ),
            ),
            if (isBestShot)
              Positioned(
                top: 7.h,
                left: 7.w,
                child: Container(
                  padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 5.h),
                  decoration: BoxDecoration(
                    color: scheme.secondary,
                    borderRadius: BorderRadius.circular(AppDimensions.radius12),
                    boxShadow: [BoxShadow(color: AppColors.black.withValues(alpha: .35), blurRadius: 6.r)],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.star_rounded, size: 14.sp, color: scheme.onSecondary),
                      SizedBox(width: AppDimensions.space4),
                      Text('Giữ lại', style: AppTextStyles.label.copyWith(color: scheme.onSecondary)),
                    ],
                  ),
                ),
              ),
            Positioned(
              top: 4.h,
              right: 4.w,
              child: Material(
                color: checked ? selectionColor : AppColors.black.withValues(alpha: .62),
                shape: const CircleBorder(),
                child: InkWell(
                  onTap: onSelectionChanged,
                  customBorder: const CircleBorder(),
                  child: SizedBox.square(
                    dimension: AppDimensions.minTouchTarget,
                    child: Icon(
                      checked ? Icons.check_rounded : Icons.add_rounded,
                      size: AppDimensions.iconMedium,
                      color: checked ? _onActionColor(selectionColor) : AppColors.white,
                    ),
                  ),
                ),
              ),
            ),
            Positioned(
              left: 7.w,
              bottom: 7.h,
              child: Container(
                constraints: const BoxConstraints(minHeight: 32),
                padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: AppDimensions.space4),
                decoration: BoxDecoration(
                  color: AppColors.black.withValues(alpha: .7),
                  borderRadius: BorderRadius.circular(AppDimensions.radius12),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      asset.type == AssetType.video ? Icons.play_arrow_rounded : Icons.open_in_full_rounded,
                      size: 15.sp,
                      color: AppColors.white,
                    ),
                    if (asset.type == AssetType.video) ...[
                      SizedBox(width: AppDimensions.space4),
                      Text(
                        _duration(asset.duration),
                        style: AppTextStyles.caption.copyWith(color: AppColors.white, fontSize: 10.sp),
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
  }
}

class _FloatingCleanDock extends StatelessWidget {
  const _FloatingCleanDock({
    required this.count,
    required this.bytes,
    required this.isDeleting,
    required this.onDelete,
    required this.onOpenAI,
  });

  final int count;
  final int bytes;
  final bool isDeleting;
  final VoidCallback? onDelete;
  final VoidCallback? onOpenAI;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      decoration: BoxDecoration(
        color: scheme.surface.withValues(alpha: .94),
        borderRadius: BorderRadius.circular(AppDimensions.radius24),
        border: Border.all(color: scheme.secondary.withValues(alpha: .35)),
        boxShadow: [BoxShadow(color: AppColors.black.withValues(alpha: .32), blurRadius: 26.r, offset: Offset(0, 8.h))],
      ),
      padding: EdgeInsets.all(AppDimensions.space8),
      child: Row(
        children: [
          Expanded(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(colors: [scheme.secondary, scheme.primary]),
                borderRadius: BorderRadius.circular(AppDimensions.radius16),
              ),
              child: FilledButton.icon(
                onPressed: onDelete,
                style: FilledButton.styleFrom(
                  minimumSize: Size(double.infinity, 52.h),
                  backgroundColor: AppColors.transparent,
                  foregroundColor: scheme.onSecondary,
                  disabledBackgroundColor: scheme.surfaceContainerHighest,
                  disabledForegroundColor: scheme.onSurfaceVariant,
                  shadowColor: AppColors.transparent,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppDimensions.radius16)),
                ),
                icon: isDeleting
                    ? SizedBox.square(
                        dimension: 18.r,
                        child: CircularProgressIndicator(strokeWidth: 2, color: scheme.onSecondary),
                      )
                    : const Icon(Icons.delete_outline_rounded),
                label: Text('Dọn $count mục (${_bytes(bytes)})', style: const TextStyle(fontWeight: FontWeight.w800)),
              ),
            ),
          ),
          if (onOpenAI != null) ...[
            SizedBox(width: 8.w),
            IconButton.filledTonal(
              tooltip: 'Mở ảnh trong AI Social Studio',
              style: IconButton.styleFrom(
                backgroundColor: scheme.surfaceContainerHighest,
                foregroundColor: scheme.primary,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16.r)),
                minimumSize: const Size(52, 52),
              ),
              onPressed: onOpenAI,
              icon: const Icon(Icons.auto_awesome_rounded),
            ),
          ],
        ],
      ),
    );
  }
}

Color _groupColor(MediaGroupType type, ColorScheme scheme) => switch (type) {
  MediaGroupType.similar => scheme.secondary,
  MediaGroupType.screenshots => scheme.primary,
  MediaGroupType.largeVideos => scheme.error,
};

IconData _groupIcon(MediaGroupType type) => switch (type) {
  MediaGroupType.similar => Icons.filter_none_rounded,
  MediaGroupType.screenshots => Icons.screenshot_rounded,
  MediaGroupType.largeVideos => Icons.movie_filter_outlined,
};

String _bytes(int value) => value >= 1073741824
    ? '${(value / 1073741824).toStringAsFixed(1)} GB'
    : '${(value / 1048576).toStringAsFixed(0)} MB';

String _duration(int seconds) => '${seconds ~/ 60}:${(seconds % 60).toString().padLeft(2, '0')}';

String _scanDuration(Duration duration) => duration.inSeconds < 1
    ? '${duration.inMilliseconds} ms'
    : '${duration.inSeconds}.${(duration.inMilliseconds % 1000) ~/ 100} giây';

Color _onActionColor(Color color) =>
    ThemeData.estimateBrightnessForColor(color) == Brightness.dark ? AppColors.white : AppColors.darkInk;

Color _filterColor(_MediaFilter filter, ColorScheme scheme) => switch (filter) {
  _MediaFilter.all => scheme.onSurfaceVariant,
  _MediaFilter.similar => scheme.secondary,
  _MediaFilter.screenshots => scheme.primary,
  _MediaFilter.largeVideos => scheme.error,
};

IconData _filterIcon(_MediaFilter filter) => switch (filter) {
  _MediaFilter.all => Icons.dashboard_customize_rounded,
  _MediaFilter.similar => Icons.filter_none_rounded,
  _MediaFilter.screenshots => Icons.screenshot_rounded,
  _MediaFilter.largeVideos => Icons.movie_filter_outlined,
};

String _filterMetric(_MediaFilter filter, MediaScanResult result) => switch (filter) {
  _MediaFilter.all => '${result.reclaimableAssetIds.length} mục',
  _MediaFilter.similar => '${result.categoryCount(MediaGroupType.similar)} ảnh',
  _MediaFilter.screenshots => '${result.categoryCount(MediaGroupType.screenshots)} ảnh',
  _MediaFilter.largeVideos => '${result.categoryCount(MediaGroupType.largeVideos)} video',
};

List<MediaGroup> _filteredGroups(MediaScanResult result, _MediaFilter filter) {
  final type = switch (filter) {
    _MediaFilter.all => null,
    _MediaFilter.similar => MediaGroupType.similar,
    _MediaFilter.screenshots => MediaGroupType.screenshots,
    _MediaFilter.largeVideos => MediaGroupType.largeVideos,
  };
  final seen = <String>{};
  return result.groups
      .where((group) {
        if (type != null && group.type != type) return false;
        final assetIds = group.assets.map((asset) => asset.id).toList(growable: false)..sort();
        final signature = '${group.type.name}:${assetIds.join(',')}';
        return seen.add(signature);
      })
      .toList(growable: false);
}

String _groupKey(MediaGroup group) =>
    '${group.type.name}:${group.assets.isEmpty ? group.title : group.assets.first.id}:${group.assets.length}';

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
          itemBuilder: (context, index) => _MediaPreviewItem(
            key: ValueKey(widget.assets[index].id),
            asset: widget.assets[index],
            isActive: index == _index,
          ),
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

class _MediaPreviewItem extends StatefulWidget {
  const _MediaPreviewItem({super.key, required this.asset, required this.isActive});

  final AssetEntity asset;
  final bool isActive;

  @override
  State<_MediaPreviewItem> createState() => _MediaPreviewItemState();
}

class _MediaPreviewItemState extends State<_MediaPreviewItem> {
  Future<File?>? _file;

  @override
  void initState() {
    super.initState();
    _cacheFile();
  }

  @override
  void didUpdateWidget(covariant _MediaPreviewItem oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.asset.id != widget.asset.id) _cacheFile();
  }

  void _cacheFile() {
    _file = widget.asset.type == AssetType.video ? null : widget.asset.file;
  }

  @override
  Widget build(BuildContext context) => widget.asset.type == AssetType.video
      ? MediaVideoPreview(asset: widget.asset, isActive: widget.isActive)
      : FutureBuilder<File?>(
          future: _file,
          builder: (context, snapshot) {
            final file = snapshot.data;
            if (file != null) {
              return InteractiveViewer(
                minScale: 1,
                maxScale: 5,
                child: Center(
                  child: Image.file(file, fit: BoxFit.contain, filterQuality: FilterQuality.medium),
                ),
              );
            }
            if (snapshot.hasError) {
              return const _PreviewError(message: 'Không thể mở ảnh này.');
            }
            return const Center(child: CircularProgressIndicator());
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

class _Thumbnail extends StatefulWidget {
  const _Thumbnail({required this.asset, super.key});

  final AssetEntity asset;

  @override
  State<_Thumbnail> createState() => _ThumbnailState();
}

class _ThumbnailState extends State<_Thumbnail> {
  late Future<Uint8List?> _thumbnail;

  @override
  void initState() {
    super.initState();
    _thumbnail = _load();
  }

  @override
  void didUpdateWidget(covariant _Thumbnail oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.asset.id != widget.asset.id) _thumbnail = _load();
  }

  Future<Uint8List?> _load() => widget.asset.thumbnailDataWithSize(const ThumbnailSize.square(220), quality: 78);

  @override
  Widget build(BuildContext context) => FutureBuilder<Uint8List?>(
    future: _thumbnail,
    builder: (context, snapshot) {
      final bytes = snapshot.data;
      if (bytes != null) {
        return Image.memory(bytes, fit: BoxFit.cover, filterQuality: FilterQuality.low, gaplessPlayback: true);
      }
      return ColoredBox(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        child: Center(
          child: SizedBox.square(
            dimension: 24.r,
            child: CircularProgressIndicator(strokeWidth: 2, color: Theme.of(context).colorScheme.primary),
          ),
        ),
      );
    },
  );
}
