import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

import '../../core/styles/app_dimensions.dart';
import '../../core/styles/app_text_styles.dart';

class PageHeader extends StatelessWidget {
  const PageHeader({required this.eyebrow, required this.title, this.description, super.key});
  final String eyebrow, title;
  final String? description;
  @override
  Widget build(BuildContext context) {
    final description = this.description;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          eyebrow.toUpperCase(),
          style: AppTextStyles.label.copyWith(
            color: Theme.of(context).colorScheme.primary,
            fontWeight: FontWeight.w800,
            letterSpacing: 1.2,
          ),
        ),
        SizedBox(height: AppDimensions.space8),
        Text(title, style: AppTextStyles.pageTitle),
        if (description != null) ...[
          SizedBox(height: 10.h),
          Text(description, style: AppTextStyles.body.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant)),
        ],
      ],
    );
  }
}

class ToolCard extends StatelessWidget {
  const ToolCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.color,
    this.tag,
    super.key,
  });
  final IconData icon;
  final String title, subtitle;
  final VoidCallback onTap;
  final Color? color;
  final String? tag;
  @override
  Widget build(BuildContext context) {
    final resolvedColor = color ?? Theme.of(context).colorScheme.primary;
    final tag = this.tag;
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(AppDimensions.radius24),
        onTap: onTap,
        child: Padding(
          padding: EdgeInsets.all(AppDimensions.space20),
          child: Row(
            children: [
              Container(
                width: 52.r,
                height: 52.r,
                decoration: BoxDecoration(
                  color: resolvedColor.withValues(alpha: .14),
                  borderRadius: BorderRadius.circular(17.r),
                  border: Border.all(color: resolvedColor.withValues(alpha: .2)),
                ),
                child: Icon(icon, color: resolvedColor, size: AppDimensions.iconMedium),
              ),
              SizedBox(width: AppDimensions.space16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (tag != null) ...[
                      Container(
                        padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 3.h),
                        decoration: BoxDecoration(
                          color: resolvedColor.withValues(alpha: .12),
                          borderRadius: BorderRadius.circular(6.r),
                        ),
                        child: Text(
                          tag.toUpperCase(),
                          style: AppTextStyles.caption.copyWith(
                            color: resolvedColor,
                            fontSize: 10.sp,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.8,
                          ),
                        ),
                      ),
                      SizedBox(height: 4.h),
                    ],
                    Text(title, style: AppTextStyles.sectionTitle),
                    SizedBox(height: 4.h),
                    Text(
                      subtitle,
                      style: AppTextStyles.body.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
                    ),
                  ],
                ),
              ),
              Icon(Icons.arrow_forward_ios_rounded, size: 16.sp, color: Theme.of(context).colorScheme.onSurfaceVariant),
            ],
          ),
        ),
      ),
    );
  }
}

class PrivacyPill extends StatelessWidget {
  const PrivacyPill({super.key});
  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return Container(
      padding: EdgeInsets.symmetric(horizontal: AppDimensions.space12, vertical: AppDimensions.space8),
      decoration: BoxDecoration(color: primary.withValues(alpha: .12), borderRadius: BorderRadius.circular(99.r)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.shield_outlined, size: 16.sp, color: primary),
          SizedBox(width: 7.w),
          Text(
            'Bạn luôn duyệt trước khi xóa',
            style: AppTextStyles.caption.copyWith(fontWeight: FontWeight.w700, color: primary),
          ),
        ],
      ),
    );
  }
}
