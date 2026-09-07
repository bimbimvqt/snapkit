import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:get/get.dart';

import '../../../core/ads/ad_service.dart';
import '../../../core/routes/app_routes.dart';
import '../../../core/styles/app_colors.dart';
import '../../../core/styles/app_dimensions.dart';
import '../../../core/styles/app_text_styles.dart';
import '../../../shared/application/app_shell_controller.dart';
import '../../../shared/widgets/snapkit_widgets.dart';
import '../../cleaner/application/cleaner_controller.dart';
import '../../pulse/presentation/widgets/pulse_card.dart';
import '../application/home_controller.dart';

class HomeScreen extends GetView<HomeController> {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) => ListView(
            padding: EdgeInsets.fromLTRB(
              AppDimensions.pageHorizontal(constraints.maxWidth),
              AppDimensions.space24,
              AppDimensions.pageHorizontal(constraints.maxWidth),
              AppDimensions.space32,
            ),
            children: [
              Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: AppDimensions.maxContentWidth),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Container(
                            width: 46.r,
                            height: 46.r,
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [scheme.primary, scheme.secondary],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                              borderRadius: BorderRadius.circular(AppDimensions.radius16),
                              boxShadow: [
                                BoxShadow(
                                  color: scheme.primary.withValues(alpha: .25),
                                  blurRadius: 16.r,
                                  offset: Offset(0, 4.h),
                                ),
                              ],
                            ),
                            child: const Icon(Icons.shield_rounded, color: AppColors.darkInk),
                          ),
                          const Flexible(child: PrivacyPill()),
                        ],
                      ),
                      SizedBox(height: AppDimensions.space28),
                      const PageHeader(
                        eyebrow: 'Snapkit',
                        title: 'Nhẹ máy. Gọn việc.',
                        description: 'Dọn thư viện và tạo mã QR nhanh chóng trong một ứng dụng gọn nhẹ.',
                      ),
                      SizedBox(height: AppDimensions.space24),
                      _StorageHealthHero(onQuickClean: () => _quickClean(context)),
                      SizedBox(height: AppDimensions.space24),
                      PulseCard(
                        onOpenCleaner: () => _openTool(context, featureKey: 'media_cleaner', tab: AppTab.cleaner),
                        onOpenQr: () => _openTool(context, featureKey: 'qr_studio', tab: AppTab.qr),
                      ),
                      SizedBox(height: AppDimensions.space24),
                      ToolCard(
                        icon: Icons.auto_delete_rounded,
                        tag: 'AI Phân Loại',
                        title: 'Smart Media Cleaner',
                        subtitle: 'Tìm ảnh tương tự, screenshot và video lớn.',
                        onTap: () => _openTool(context, featureKey: 'media_cleaner', tab: AppTab.cleaner),
                      ),
                      SizedBox(height: AppDimensions.space12),
                      ToolCard(
                        icon: Icons.qr_code_2_rounded,
                        tag: 'Studio Đa Năng',
                        title: 'QR Studio',
                        subtitle: 'Quét, tạo Wi-Fi, URL và mã cá nhân hóa.',
                        color: scheme.secondary,
                        onTap: () => _openTool(context, featureKey: 'qr_studio', tab: AppTab.qr),
                      ),
                      SizedBox(height: AppDimensions.space12),
                      ToolCard(
                        icon: Icons.auto_awesome_rounded,
                        tag: controller.featureIsEnabled('ai_caption_studio') ? 'AI sáng tạo' : 'Tạm bảo trì',
                        title: 'AI Social Studio',
                        subtitle: 'Phân tích ảnh và tạo caption phù hợp từng nền tảng.',
                        color: scheme.primary,
                        onTap: () => _openAIStudio(context),
                      ),
                      SizedBox(height: 22.h),
                      const SnapkitBannerAd(),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _openTool(BuildContext context, {required String featureKey, required AppTab tab}) {
    if (controller.openTool(featureKey: featureKey, tab: tab)) return;
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Tính năng đang được bảo trì.')));
  }

  void _quickClean(BuildContext context) {
    if (!_openToolWithReturn(featureKey: 'media_cleaner', tab: AppTab.cleaner)) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Tính năng đang được bảo trì.')));
      return;
    }
    if (Get.isRegistered<CleanerController>()) {
      final cleaner = Get.find<CleanerController>();
      if (cleaner.status == CleanerStatus.initial) {
        cleaner.scan();
      }
    }
  }

  void _openAIStudio(BuildContext context) {
    if (controller.featureIsEnabled('ai_caption_studio')) {
      Get.toNamed(AppRoutes.captionStudio);
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('AI Studio đang tạm bảo trì.')));
  }

  bool _openToolWithReturn({required String featureKey, required AppTab tab}) =>
      controller.openTool(featureKey: featureKey, tab: tab);
}

class _StorageHealthHero extends StatelessWidget {
  const _StorageHealthHero({required this.onQuickClean});

  final VoidCallback onQuickClean;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: EdgeInsets.all(AppDimensions.space24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color.alphaBlend(scheme.primary.withValues(alpha: .22), scheme.surface),
            Color.alphaBlend(scheme.secondary.withValues(alpha: .08), scheme.surface),
            scheme.surface,
          ],
        ),
        borderRadius: BorderRadius.circular(AppDimensions.radius28),
        border: Border.all(color: scheme.primary.withValues(alpha: .35)),
        boxShadow: [BoxShadow(color: scheme.primary.withValues(alpha: .1), blurRadius: 28.r, offset: Offset(0, 8.h))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 44.r,
                height: 44.r,
                decoration: BoxDecoration(
                  color: scheme.secondary.withValues(alpha: .16),
                  borderRadius: BorderRadius.circular(AppDimensions.radius12),
                  border: Border.all(color: scheme.secondary.withValues(alpha: .3)),
                ),
                child: Icon(Icons.bolt_rounded, color: scheme.secondary, size: AppDimensions.iconMedium),
              ),
              SizedBox(width: AppDimensions.space12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'TRẠNG THÁI HỆ THỐNG',
                      style: AppTextStyles.caption.copyWith(
                        color: scheme.primary,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.1,
                      ),
                    ),
                    SizedBox(height: 2.h),
                    Text('Sẵn sàng tối ưu', style: AppTextStyles.bodyStrong.copyWith(color: scheme.onSurface)),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: AppDimensions.space20),
          Text('Bộ công cụ riêng tư', style: AppTextStyles.heroTitle),
          SizedBox(height: AppDimensions.space8),
          Text(
            'Dọn media, QR Studio và các tiện ích AI được kiểm soát.',
            style: AppTextStyles.body.copyWith(color: scheme.onSurfaceVariant),
          ),
          SizedBox(height: AppDimensions.space20),
          FilledButton.icon(
            onPressed: onQuickClean,
            style: FilledButton.styleFrom(
              minimumSize: Size(double.infinity, 50.h),
              backgroundColor: scheme.secondary,
              foregroundColor: AppColors.darkInk,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16.r)),
            ),
            icon: const Icon(Icons.auto_fix_high_rounded),
            label: const Text('Dọn nhanh 1 chạm', style: TextStyle(fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
  }
}
