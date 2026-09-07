import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:get/get.dart';

import '../../../core/config/remote_config.dart';
import '../../../core/styles/app_dimensions.dart';
import '../../../core/styles/app_text_styles.dart';
import '../../../shared/widgets/snapkit_widgets.dart';
import '../../auth/domain/auth_user.dart';
import '../application/settings_controller.dart';
import '../domain/pro_subscription_config.dart';
import 'widgets/pro_pricing_section.dart';

class SettingsScreen extends GetView<SettingsController> {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: LayoutBuilder(
        builder: (context, constraints) => ListView(
          padding: EdgeInsets.fromLTRB(
            AppDimensions.pageHorizontal(constraints.maxWidth),
            AppDimensions.space24,
            AppDimensions.pageHorizontal(constraints.maxWidth),
            36.h,
          ),
          children: [
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: AppDimensions.maxContentWidth),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const PageHeader(
                      eyebrow: 'Tài khoản',
                      title: 'Cài đặt',
                      description: 'Quản lý tài khoản và trải nghiệm Snapkit của bạn.',
                    ),
                    SizedBox(height: AppDimensions.space24),
                    Obx(() {
                      final user = controller.user;
                      if (user != null && user.isPro) {
                        return Padding(
                          padding: EdgeInsets.only(bottom: AppDimensions.space24),
                          child: _ProStatusCard(planId: user.planId),
                        );
                      }
                      if (!RemoteConfig.instance.enabled('pro_paywall')) return const SizedBox.shrink();
                      return Padding(
                        padding: EdgeInsets.only(bottom: AppDimensions.space32),
                        child: ProPricingSection(
                          config: RemoteConfig.instance.proSubscription,
                          onPlanSelected: (plan) => _selectPlan(context, plan),
                        ),
                      );
                    }),
                    Obx(() {
                      final user = controller.user;
                      if (user == null) return const SizedBox.shrink();
                      return Padding(
                        padding: EdgeInsets.only(bottom: AppDimensions.space16),
                        child: _AccountCard(
                          user: user,
                          signingOut: controller.isSigningOut,
                          onSignOut: controller.signOut,
                        ),
                      );
                    }),
                    Card(
                      child: Column(
                        children: [
                          const _Tile(
                            icon: Icons.shield_outlined,
                            title: 'Xóa có xác nhận',
                            subtitle: 'Luôn xem lại và chọn nội dung trước khi xóa',
                          ),
                          const _Divider(),
                          Obx(() {
                            final isPro = controller.user?.isPro == true;
                            return _Tile(
                              icon: isPro ? Icons.block_rounded : Icons.ads_click_outlined,
                              title: isPro ? 'Trải nghiệm không quảng cáo' : 'Quảng cáo có kiểm soát',
                              subtitle: isPro
                                  ? 'Quyền lợi Pro đang hoạt động trên tài khoản này'
                                  : 'Banner ở trang chủ; interstitial chỉ sau khi dọn xong',
                            );
                          }),
                        ],
                      ),
                    ),
                    SizedBox(height: AppDimensions.space20),
                    const PrivacyPill(),
                    SizedBox(height: AppDimensions.space12),
                    Text(
                      'Snapkit 1.0.0',
                      textAlign: TextAlign.center,
                      style: AppTextStyles.caption.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );

  void _selectPlan(BuildContext context, ProPlan plan) {
    controller.openPaywall(planId: plan.id);
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      useSafeArea: true,
      isScrollControlled: true,
      builder: (context) {
        final scheme = Theme.of(context).colorScheme;
        return SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(24.w, 8.h, 24.w, 24.h),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Icon(Icons.shopping_bag_outlined, size: 36.sp, color: scheme.primary),
                SizedBox(height: AppDimensions.space16),
                Text('Bạn đã chọn ${plan.name}', textAlign: TextAlign.center, style: AppTextStyles.titleLarge),
                SizedBox(height: AppDimensions.space8),
                Text(
                  '${plan.priceLabel} ${plan.periodLabel}. Bạn chưa bị tính phí; bước thanh toán qua cửa hàng ứng dụng sẽ được mở khi sản phẩm sẵn sàng.',
                  textAlign: TextAlign.center,
                  style: AppTextStyles.body.copyWith(color: scheme.onSurfaceVariant),
                ),
                SizedBox(height: AppDimensions.space20),
                SizedBox(
                  height: AppDimensions.minTouchTarget,
                  child: FilledButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Đã hiểu')),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _ProStatusCard extends StatelessWidget {
  const _ProStatusCard({required this.planId});

  final String planId;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      child: Padding(
        padding: EdgeInsets.all(AppDimensions.space20),
        child: Row(
          children: [
            Container(
              width: 48.r,
              height: 48.r,
              decoration: BoxDecoration(
                color: scheme.primary.withValues(alpha: .14),
                borderRadius: BorderRadius.circular(AppDimensions.radius16),
              ),
              child: Icon(Icons.workspace_premium_rounded, color: scheme.primary),
            ),
            SizedBox(width: AppDimensions.space16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Snapkit Pro đang hoạt động', style: AppTextStyles.bodyStrong),
                  SizedBox(height: AppDimensions.space4),
                  Text(
                    'Gói $planId · không quảng cáo',
                    style: AppTextStyles.caption.copyWith(color: scheme.onSurfaceVariant),
                  ),
                ],
              ),
            ),
            Icon(Icons.check_circle_rounded, color: scheme.primary),
          ],
        ),
      ),
    );
  }
}

class _AccountCard extends StatelessWidget {
  const _AccountCard({required this.user, required this.signingOut, required this.onSignOut});

  final AuthUser user;
  final bool signingOut;
  final VoidCallback onSignOut;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      child: Padding(
        padding: EdgeInsets.all(18.w),
        child: Column(
          children: [
            Row(
              children: [
                _Avatar(user: user),
                SizedBox(width: 14.w),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user.displayName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.bodyStrong,
                      ),
                      SizedBox(height: AppDimensions.space4),
                      Text(
                        user.email,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.caption.copyWith(color: scheme.onSurfaceVariant),
                      ),
                    ],
                  ),
                ),
                Icon(Icons.verified_user_rounded, color: scheme.primary),
              ],
            ),
            SizedBox(height: AppDimensions.space16),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: signingOut ? null : onSignOut,
                icon: signingOut
                    ? SizedBox.square(dimension: 18.r, child: const CircularProgressIndicator(strokeWidth: 2))
                    : Icon(Icons.logout_rounded, size: 20.sp),
                label: Text(signingOut ? 'Đang đăng xuất…' : 'Đăng xuất'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.user});

  final AuthUser user;

  @override
  Widget build(BuildContext context) {
    final avatarUrl = user.avatarUrl;
    final name = user.displayName.trim();
    final initial = name.isEmpty ? 'S' : name.characters.first.toUpperCase();
    final fallback = Container(
      color: Theme.of(context).colorScheme.primary.withValues(alpha: .15),
      alignment: Alignment.center,
      child: Text(initial, style: AppTextStyles.titleMedium.copyWith(color: Theme.of(context).colorScheme.primary)),
    );
    return ClipOval(
      child: SizedBox.square(
        dimension: 52.r,
        child: avatarUrl == null
            ? fallback
            : Image.network(avatarUrl, fit: BoxFit.cover, errorBuilder: (context, error, stackTrace) => fallback),
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({required this.icon, required this.title, required this.subtitle});

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) => ListTile(
    minTileHeight: 72.h.clamp(AppDimensions.minTouchTarget, double.infinity),
    leading: Icon(icon, color: Theme.of(context).colorScheme.primary),
    title: Text(title, style: AppTextStyles.bodyStrong),
    subtitle: Text(
      subtitle,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: AppTextStyles.caption.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
    ),
  );
}

class _Divider extends StatelessWidget {
  const _Divider();

  @override
  Widget build(BuildContext context) => Divider(height: 1.h, indent: 64.w);
}
