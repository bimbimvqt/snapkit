import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:get/get.dart';

import '../../../core/config/app_environment.dart';
import '../../../core/styles/app_colors.dart';
import '../../../core/styles/app_dimensions.dart';
import '../../../core/styles/app_text_styles.dart';
import '../../../shared/widgets/snapkit_widgets.dart';
import '../../auth/domain/auth_user.dart';
import '../application/settings_controller.dart';

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
                      eyebrow: 'Preferences',
                      title: 'Cài đặt',
                      description: 'Quyền riêng tư, gói sử dụng và thông tin môi trường.',
                    ),
                    SizedBox(height: AppDimensions.space24),
                    Container(
                      padding: EdgeInsets.all(22.w),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(colors: [AppColors.proGradientStart, AppColors.proGradientEnd]),
                        borderRadius: BorderRadius.circular(AppDimensions.radius24),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(Icons.workspace_premium_rounded, color: AppColors.darkInk),
                          SizedBox(height: 22.h),
                          Text('Snapkit Pro', style: AppTextStyles.titleLarge.copyWith(color: AppColors.darkInk)),
                          SizedBox(height: 7.h),
                          Text(
                            'Không quảng cáo, quét thư viện lớn và QR style premium.',
                            style: AppTextStyles.body.copyWith(color: AppColors.darkInk.withValues(alpha: .8)),
                          ),
                          SizedBox(height: 18.h),
                          FilledButton(
                            onPressed: controller.openPaywall,
                            style: FilledButton.styleFrom(
                              backgroundColor: AppColors.darkInk,
                              foregroundColor: AppColors.white,
                            ),
                            child: const Text('Xem gói nâng cấp'),
                          ),
                        ],
                      ),
                    ),
                    SizedBox(height: AppDimensions.space24),
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
                            title: 'Privacy by default',
                            subtitle: 'Media không rời khỏi thiết bị',
                          ),
                          const _Divider(),
                          const _Tile(
                            icon: Icons.ads_click_outlined,
                            title: 'Quảng cáo có kiểm soát',
                            subtitle: 'Không hiển thị trong lúc chọn/xóa media',
                          ),
                          const _Divider(),
                          _Tile(icon: Icons.cloud_outlined, title: 'API backend', subtitle: AppEnvironment.apiBaseUrl),
                          const _Divider(),
                          _Tile(
                            icon: Icons.science_outlined,
                            title: 'Môi trường',
                            subtitle: AppEnvironment.isProduction ? 'Production' : 'Development',
                          ),
                        ],
                      ),
                    ),
                    SizedBox(height: AppDimensions.space20),
                    const PrivacyPill(),
                    SizedBox(height: AppDimensions.space12),
                    Text(
                      'Snapkit 1.0.0 · Build privacy-first',
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
