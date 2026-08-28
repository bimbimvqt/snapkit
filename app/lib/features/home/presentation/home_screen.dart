import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:get/get.dart';

import '../../../core/ads/ad_service.dart';
import '../../../core/styles/app_colors.dart';
import '../../../core/styles/app_dimensions.dart';
import '../../../core/styles/app_text_styles.dart';
import '../../../shared/application/app_shell_controller.dart';
import '../../../shared/widgets/snapkit_widgets.dart';
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
                            width: 48.r,
                            height: 48.r,
                            decoration: BoxDecoration(
                              color: scheme.secondary,
                              borderRadius: BorderRadius.circular(AppDimensions.radius16),
                            ),
                            child: const Icon(Icons.shield_rounded, color: AppColors.darkInk),
                          ),
                          const Flexible(child: PrivacyPill()),
                        ],
                      ),
                      SizedBox(height: AppDimensions.space32),
                      const PageHeader(
                        eyebrow: 'Snapkit',
                        title: 'Nhẹ máy. Gọn việc.',
                        description:
                            'Bộ công cụ thiết yếu, được thiết kế để dữ liệu riêng tư luôn ở lại trên điện thoại của bạn.',
                      ),
                      SizedBox(height: AppDimensions.space28),
                      Container(
                        padding: EdgeInsets.all(AppDimensions.space24),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              Color.alphaBlend(scheme.primary.withValues(alpha: .2), scheme.surface),
                              scheme.surface,
                            ],
                          ),
                          borderRadius: BorderRadius.circular(AppDimensions.radius28),
                          border: Border.all(color: scheme.outlineVariant),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(Icons.bolt_rounded, color: scheme.secondary, size: AppDimensions.iconLarge),
                            SizedBox(height: AppDimensions.space28),
                            Text('2 công cụ sẵn sàng', style: AppTextStyles.heroTitle),
                            SizedBox(height: AppDimensions.space8),
                            Text(
                              'Dọn media thông minh và QR Studio đa năng.',
                              style: AppTextStyles.body.copyWith(color: scheme.onSurfaceVariant),
                            ),
                          ],
                        ),
                      ),
                      SizedBox(height: AppDimensions.space24),
                      ToolCard(
                        icon: Icons.auto_delete_rounded,
                        title: 'Smart Media Cleaner',
                        subtitle: 'Tìm ảnh tương tự, screenshot và video lớn.',
                        onTap: () => _openTool(context, featureKey: 'media_cleaner', tab: AppTab.cleaner),
                      ),
                      SizedBox(height: AppDimensions.space12),
                      ToolCard(
                        icon: Icons.qr_code_2_rounded,
                        title: 'QR Studio',
                        subtitle: 'Quét, tạo Wi-Fi, URL và mã cá nhân hóa.',
                        color: scheme.secondary,
                        onTap: () => _openTool(context, featureKey: 'qr_studio', tab: AppTab.qr),
                      ),
                      SizedBox(height: AppDimensions.space28),
                      Row(
                        children: [
                          const Expanded(
                            child: _Stat(value: '0 B', label: 'Media tải lên'),
                          ),
                          SizedBox(width: AppDimensions.space12),
                          const Expanded(
                            child: _Stat(value: '100%', label: 'Xử lý local'),
                          ),
                        ],
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
}

class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label});

  final String value;
  final String label;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: EdgeInsets.all(18.w),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value, style: AppTextStyles.titleLarge),
          SizedBox(height: 5.h),
          Text(
            label,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.caption.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
          ),
        ],
      ),
    ),
  );
}
