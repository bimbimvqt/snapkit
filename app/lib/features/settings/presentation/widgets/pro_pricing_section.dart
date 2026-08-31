import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

import '../../../../core/styles/app_dimensions.dart';
import '../../../../core/styles/app_text_styles.dart';
import '../../domain/pro_subscription_config.dart';

class ProPricingSection extends StatelessWidget {
  const ProPricingSection({required this.config, required this.onPlanSelected, super.key});

  final ProSubscriptionConfig config;
  final ValueChanged<ProPlan> onPlanSelected;

  @override
  Widget build(BuildContext context) {
    final plans = config.enabledPlans;
    if (plans.isEmpty) return const SizedBox.shrink();
    final scheme = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Align(
          alignment: Alignment.center,
          child: Container(
            padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 7.h),
            decoration: BoxDecoration(
              color: scheme.primary.withValues(alpha: .12),
              borderRadius: BorderRadius.circular(99.r),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.workspace_premium_rounded, size: AppDimensions.iconSmall, color: scheme.primary),
                SizedBox(width: AppDimensions.space8),
                Text('SNAPKIT PRO', style: AppTextStyles.label.copyWith(color: scheme.primary, letterSpacing: .8)),
              ],
            ),
          ),
        ),
        SizedBox(height: AppDimensions.space16),
        Text(config.title, textAlign: TextAlign.center, style: AppTextStyles.pageTitle),
        SizedBox(height: AppDimensions.space8),
        Text(
          config.subtitle,
          textAlign: TextAlign.center,
          style: AppTextStyles.body.copyWith(color: scheme.onSurfaceVariant),
        ),
        SizedBox(height: AppDimensions.space24),
        LayoutBuilder(
          builder: (context, constraints) {
            final columns = constraints.maxWidth >= AppDimensions.tabletBreakpoint;
            if (!columns) {
              return Column(
                children: [
                  for (var index = 0; index < plans.length; index++) ...[
                    _PricingCard(plan: plans[index], onSelected: () => onPlanSelected(plans[index])),
                    if (index != plans.length - 1) SizedBox(height: AppDimensions.space16),
                  ],
                ],
              );
            }
            final cardWidth = plans.length == 1
                ? constraints.maxWidth.clamp(320.0, 440.0)
                : ((constraints.maxWidth - AppDimensions.space16 * (plans.length - 1)) / plans.length).clamp(
                    280.0,
                    360.0,
                  );
            return Wrap(
              alignment: WrapAlignment.center,
              runAlignment: WrapAlignment.start,
              spacing: AppDimensions.space16,
              runSpacing: AppDimensions.space16,
              children: plans
                  .map(
                    (plan) => SizedBox(
                      width: cardWidth,
                      child: _PricingCard(plan: plan, onSelected: () => onPlanSelected(plan)),
                    ),
                  )
                  .toList(),
            );
          },
        ),
        SizedBox(height: AppDimensions.space20),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.shield_outlined, size: AppDimensions.iconSmall, color: scheme.primary),
            SizedBox(width: AppDimensions.space8),
            Flexible(
              child: Text(
                config.footer,
                textAlign: TextAlign.center,
                style: AppTextStyles.caption.copyWith(color: scheme.onSurfaceVariant),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _PricingCard extends StatelessWidget {
  const _PricingCard({required this.plan, required this.onSelected});

  final ProPlan plan;
  final VoidCallback onSelected;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final outline = plan.highlighted ? scheme.primary : scheme.outlineVariant;
    return Container(
      padding: EdgeInsets.all(20.w),
      decoration: BoxDecoration(
        color: plan.highlighted ? scheme.primary.withValues(alpha: .06) : scheme.surfaceContainer,
        border: Border.all(color: outline, width: plan.highlighted ? 1.6 : 1),
        borderRadius: BorderRadius.circular(AppDimensions.radius24),
        boxShadow: plan.highlighted
            ? [BoxShadow(color: scheme.primary.withValues(alpha: .12), blurRadius: 28, offset: const Offset(0, 12))]
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: AppDimensions.minTouchTarget,
                height: AppDimensions.minTouchTarget,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: scheme.primary.withValues(alpha: .12),
                  borderRadius: BorderRadius.circular(AppDimensions.radius16),
                ),
                child: Icon(Icons.auto_awesome_rounded, color: scheme.primary, size: AppDimensions.iconMedium),
              ),
              const Spacer(),
              if (plan.badge.isNotEmpty)
                Container(
                  padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 6.h),
                  decoration: BoxDecoration(
                    color: plan.highlighted ? scheme.primary : scheme.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(99.r),
                  ),
                  child: Text(
                    plan.badge,
                    style: AppTextStyles.label.copyWith(
                      color: plan.highlighted ? scheme.onPrimary : scheme.onSurfaceVariant,
                    ),
                  ),
                ),
            ],
          ),
          SizedBox(height: AppDimensions.space20),
          Text(plan.name, style: AppTextStyles.titleLarge),
          SizedBox(height: AppDimensions.space12),
          Wrap(
            crossAxisAlignment: WrapCrossAlignment.end,
            spacing: AppDimensions.space8,
            runSpacing: AppDimensions.space4,
            children: [
              Text(
                plan.priceLabel,
                style: AppTextStyles.display.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
              ),
              Padding(
                padding: EdgeInsets.only(bottom: 4.h),
                child: Text(plan.periodLabel, style: AppTextStyles.body.copyWith(color: scheme.onSurfaceVariant)),
              ),
            ],
          ),
          SizedBox(height: AppDimensions.space12),
          Text(plan.description, style: AppTextStyles.body.copyWith(color: scheme.onSurfaceVariant)),
          SizedBox(height: AppDimensions.space12),
          Row(
            children: [
              Icon(Icons.cloud_outlined, size: 18.sp, color: scheme.primary),
              SizedBox(width: AppDimensions.space8),
              Expanded(
                child: Text(
                  '${_formatStorage(plan.storage.quotaMb)} lưu trữ cloud · video gốc ${plan.storage.originalVideoRetentionDays} ngày',
                  style: AppTextStyles.caption.copyWith(color: scheme.onSurfaceVariant, fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
          SizedBox(height: AppDimensions.space20),
          ...plan.features.map(
            (feature) => Padding(
              padding: EdgeInsets.only(bottom: AppDimensions.space12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 22.r,
                    height: 22.r,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: scheme.primary.withValues(alpha: .14), shape: BoxShape.circle),
                    child: Icon(Icons.check_rounded, size: 15.sp, color: scheme.primary),
                  ),
                  SizedBox(width: AppDimensions.space12),
                  Expanded(child: Text(feature, style: AppTextStyles.bodyStrong)),
                ],
              ),
            ),
          ),
          if (plan.benefits.isNotEmpty) ...[
            Divider(height: AppDimensions.space32),
            ...plan.benefits.map(
              (benefit) => Padding(
                padding: EdgeInsets.only(bottom: AppDimensions.space8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.verified_user_outlined, size: AppDimensions.iconSmall, color: scheme.onSurfaceVariant),
                    SizedBox(width: AppDimensions.space8),
                    Expanded(
                      child: Text(benefit, style: AppTextStyles.caption.copyWith(color: scheme.onSurfaceVariant)),
                    ),
                  ],
                ),
              ),
            ),
          ],
          SizedBox(height: AppDimensions.space16),
          SizedBox(
            width: double.infinity,
            height: AppDimensions.minTouchTarget,
            child: plan.highlighted
                ? FilledButton(onPressed: onSelected, child: Text(plan.ctaLabel))
                : OutlinedButton(onPressed: onSelected, child: Text(plan.ctaLabel)),
          ),
          if (plan.trialDays > 0) ...[
            SizedBox(height: AppDimensions.space8),
            Text(
              'Dùng thử ${plan.trialDays} ngày · Huỷ bất kỳ lúc nào',
              textAlign: TextAlign.center,
              style: AppTextStyles.caption.copyWith(color: scheme.onSurfaceVariant),
            ),
          ],
        ],
      ),
    );
  }
}

String _formatStorage(int megabytes) {
  if (megabytes >= 1024) {
    final gigabytes = megabytes / 1024;
    return '${gigabytes == gigabytes.roundToDouble() ? gigabytes.toStringAsFixed(0) : gigabytes.toStringAsFixed(1)} GB';
  }
  return '$megabytes MB';
}
