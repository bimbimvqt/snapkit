import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:get/get.dart';

import '../../../../core/styles/app_colors.dart';
import '../../../../core/styles/app_dimensions.dart';
import '../../../../core/styles/app_text_styles.dart';
import '../../application/pulse_controller.dart';
import '../../domain/pulse_progress.dart';

class PulseCard extends StatelessWidget {
  const PulseCard({required this.onOpenCleaner, required this.onOpenQr, super.key});

  final VoidCallback onOpenCleaner;
  final VoidCallback onOpenQr;

  @override
  Widget build(BuildContext context) => GetBuilder<PulseController>(
    builder: (controller) {
      final progress = controller.progress;
      return Card(
        clipBehavior: Clip.antiAlias,
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: _backgroundColors(context),
            ),
          ),
          child: Padding(
            padding: EdgeInsets.all(AppDimensions.space20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _PulseHeader(controller: controller),
                SizedBox(height: AppDimensions.space16),
                ClipRRect(
                  borderRadius: BorderRadius.circular(99.r),
                  child: LinearProgressIndicator(
                    minHeight: 8.h,
                    value: progress.completion,
                    backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest,
                  ),
                ),
                SizedBox(height: AppDimensions.space8),
                Text(
                  progress.isComplete
                      ? 'Đã hoàn thành 3/3 mục tiêu tuần này'
                      : '${progress.completedGoals}/3 mục tiêu · tiến độ lưu riêng trên thiết bị',
                  style: AppTextStyles.caption.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
                ),
                SizedBox(height: AppDimensions.space12),
                _PulseGoalTile(
                  icon: Icons.cleaning_services_rounded,
                  color: Theme.of(context).colorScheme.primary,
                  title: 'Dọn 5 media',
                  value: '${progress.cleanedItems.clamp(0, PulseGoals.cleanedItems)}/${PulseGoals.cleanedItems}',
                  detail: progress.cleanedBytes > 0
                      ? 'Đã giải phóng ${_formatBytes(progress.cleanedBytes)}'
                      : 'Bắt đầu thật nhỏ',
                  complete: progress.cleanedItems >= PulseGoals.cleanedItems,
                  onTap: onOpenCleaner,
                ),
                SizedBox(height: AppDimensions.space8),
                _PulseGoalTile(
                  icon: Icons.photo_filter_rounded,
                  color: Theme.of(context).colorScheme.secondary,
                  title: 'Ảnh cần chú ý',
                  value: '${progress.focusedItems.clamp(0, PulseGoals.focusedItems)}/${PulseGoals.focusedItems}',
                  detail: 'Screenshot hoặc ảnh tương tự',
                  complete: progress.focusedItems >= PulseGoals.focusedItems,
                  onTap: onOpenCleaner,
                ),
                SizedBox(height: AppDimensions.space8),
                _PulseGoalTile(
                  icon: Icons.qr_code_scanner_rounded,
                  color: Theme.of(context).brightness == Brightness.dark
                      ? AppColors.pulseQrDark
                      : AppColors.pulseQrLight,
                  title: 'Một việc với QR',
                  value: '${progress.qrActions.clamp(0, PulseGoals.qrActions)}/${PulseGoals.qrActions}',
                  detail: 'Tạo, lưu hoặc quét một mã',
                  complete: progress.qrActions >= PulseGoals.qrActions,
                  onTap: onOpenQr,
                ),
                if (progress.isComplete) ...[
                  SizedBox(height: AppDimensions.space12),
                  Container(
                    padding: EdgeInsets.all(AppDimensions.space12),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.primary.withValues(alpha: .1),
                      borderRadius: BorderRadius.circular(AppDimensions.radius12),
                      border: Border.all(color: Theme.of(context).colorScheme.primary.withValues(alpha: .2)),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(
                          Icons.verified_rounded,
                          size: AppDimensions.iconSmall,
                          color: Theme.of(context).colorScheme.primary,
                        ),
                        SizedBox(width: AppDimensions.space8),
                        Expanded(
                          child: Text(
                            controller.rewardIsActive
                                ? 'Thưởng tuần: Free tắt quảng cáo xen kẽ 3 ngày; Pro luôn không quảng cáo.'
                                : 'Nhịp tuần đã hoàn tất. Tuần mới sẽ bắt đầu vào thứ Hai.',
                            style: AppTextStyles.caption.copyWith(fontWeight: FontWeight.w700),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      );
    },
  );

  List<Color> _backgroundColors(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return [
      Color.alphaBlend(scheme.primary.withValues(alpha: .09), scheme.surface),
      Color.alphaBlend(scheme.secondary.withValues(alpha: .04), scheme.surface),
    ];
  }
}

class _PulseHeader extends StatelessWidget {
  const _PulseHeader({required this.controller});

  final PulseController controller;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final streak = controller.snapshot.streakWeeks;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 44.r,
          height: 44.r,
          decoration: BoxDecoration(
            color: scheme.primary.withValues(alpha: .14),
            borderRadius: BorderRadius.circular(AppDimensions.radius12),
          ),
          child: Icon(Icons.monitor_heart_rounded, color: scheme.primary, size: AppDimensions.iconMedium),
        ),
        SizedBox(width: AppDimensions.space12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Nhịp tuần', style: AppTextStyles.titleMedium),
              SizedBox(height: AppDimensions.space4),
              Text(
                'Ba việc nhỏ để Snapkit luôn hữu ích.',
                style: AppTextStyles.caption.copyWith(color: scheme.onSurfaceVariant),
              ),
            ],
          ),
        ),
        SizedBox(width: AppDimensions.space8),
        Container(
          constraints: const BoxConstraints(minHeight: AppDimensions.minTouchTarget),
          padding: EdgeInsets.symmetric(horizontal: AppDimensions.space12, vertical: AppDimensions.space8),
          decoration: BoxDecoration(
            color: scheme.surface.withValues(alpha: .8),
            borderRadius: BorderRadius.circular(99.r),
            border: Border.all(color: scheme.outlineVariant),
          ),
          alignment: Alignment.center,
          child: Text(streak == 0 ? 'Tuần đầu' : '$streak tuần', style: AppTextStyles.label),
        ),
      ],
    );
  }
}

class _PulseGoalTile extends StatelessWidget {
  const _PulseGoalTile({
    required this.icon,
    required this.color,
    required this.title,
    required this.value,
    required this.detail,
    required this.complete,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String value;
  final String detail;
  final bool complete;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: Theme.of(context).colorScheme.surface.withValues(alpha: .7),
    borderRadius: BorderRadius.circular(AppDimensions.radius16),
    child: InkWell(
      borderRadius: BorderRadius.circular(AppDimensions.radius16),
      onTap: complete ? null : onTap,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: AppDimensions.minTouchTarget),
        child: Padding(
          padding: EdgeInsets.all(AppDimensions.space12),
          child: Row(
            children: [
              Container(
                width: 36.r,
                height: 36.r,
                decoration: BoxDecoration(color: color.withValues(alpha: .14), shape: BoxShape.circle),
                child: Icon(complete ? Icons.check_rounded : icon, color: color, size: AppDimensions.iconSmall),
              ),
              SizedBox(width: AppDimensions.space12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: AppTextStyles.bodyStrong),
                    Text(
                      detail,
                      style: AppTextStyles.caption.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
                    ),
                  ],
                ),
              ),
              SizedBox(width: AppDimensions.space8),
              Text(value, style: AppTextStyles.bodyStrong.copyWith(color: complete ? color : null)),
              if (!complete) ...[
                SizedBox(width: AppDimensions.space4),
                Icon(Icons.chevron_right_rounded, color: Theme.of(context).colorScheme.onSurfaceVariant),
              ],
            ],
          ),
        ),
      ),
    ),
  );
}

String _formatBytes(int bytes) {
  if (bytes >= 1073741824) return '${(bytes / 1073741824).toStringAsFixed(1)} GB';
  if (bytes >= 1048576) return '${(bytes / 1048576).toStringAsFixed(bytes < 10485760 ? 1 : 0)} MB';
  if (bytes >= 1024) return '${(bytes / 1024).toStringAsFixed(0)} KB';
  return '$bytes B';
}
