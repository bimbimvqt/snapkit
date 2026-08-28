import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:get/get.dart';

import '../../../core/styles/app_assets.dart';
import '../../../core/styles/app_colors.dart';
import '../../../core/styles/app_dimensions.dart';
import '../../../core/styles/app_text_styles.dart';
import '../application/auth_controller.dart';

class LoginScreen extends GetView<AuthController> {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: LayoutBuilder(
        builder: (context, constraints) {
          final wide = constraints.maxWidth >= AppDimensions.tabletBreakpoint;
          final horizontalPadding = wide ? AppDimensions.space48 : AppDimensions.space20;
          return Stack(
            children: [
              Positioned(
                top: -90.h,
                right: -80.w,
                child: _AmbientOrb(size: 240.r),
              ),
              Positioned(
                bottom: -110.h,
                left: -100.w,
                child: _AmbientOrb(size: 280.r, color: Theme.of(context).colorScheme.secondary),
              ),
              SingleChildScrollView(
                padding: EdgeInsets.fromLTRB(horizontalPadding, AppDimensions.space24, horizontalPadding, 32.h),
                child: ConstrainedBox(
                  constraints: BoxConstraints(minHeight: constraints.maxHeight - 56.h),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: BoxConstraints(maxWidth: 520.w),
                      child: Obx(
                        () => _LoginContent(
                          errorMessage: controller.errorMessage,
                          isSigningIn: controller.isSigningIn,
                          onSignIn: controller.signInWithGoogle,
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
}

class _LoginContent extends StatelessWidget {
  const _LoginContent({required this.errorMessage, required this.isSigningIn, required this.onSignIn});

  final String? errorMessage;
  final bool isSigningIn;
  final VoidCallback onSignIn;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final resolvedErrorMessage = errorMessage;
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: Container(
            width: 64.r,
            height: 64.r,
            decoration: BoxDecoration(
              color: scheme.primary.withValues(alpha: .14),
              borderRadius: BorderRadius.circular(22.r),
              border: Border.all(color: scheme.primary.withValues(alpha: .28)),
            ),
            child: Icon(Icons.shield_rounded, color: scheme.primary, size: 32.sp),
          ),
        ),
        SizedBox(height: AppDimensions.space28),
        Text('Công cụ gọn nhẹ.\nRiêng tư đúng nghĩa.', style: AppTextStyles.display),
        SizedBox(height: AppDimensions.space16),
        Text(
          'Đăng nhập để sử dụng Snapkit và đồng bộ thiết lập tài khoản của bạn một cách an toàn.',
          style: AppTextStyles.body.copyWith(color: scheme.onSurfaceVariant),
        ),
        SizedBox(height: AppDimensions.space28),
        Card(
          child: Padding(
            padding: EdgeInsets.all(AppDimensions.space20),
            child: Column(
              children: const [
                _Benefit(icon: Icons.phone_iphone_rounded, text: 'Media vẫn được xử lý trực tiếp trên thiết bị'),
                _BenefitGap(),
                _Benefit(icon: Icons.lock_outline_rounded, text: 'Backend chỉ xác minh danh tính Google của bạn'),
                _BenefitGap(),
                _Benefit(icon: Icons.sync_rounded, text: 'Giữ phiên đăng nhập an toàn giữa các lần mở app'),
              ],
            ),
          ),
        ),
        if (resolvedErrorMessage != null) ...[
          SizedBox(height: AppDimensions.space16),
          Container(
            padding: EdgeInsets.all(14.w),
            decoration: BoxDecoration(
              color: scheme.error.withValues(alpha: .1),
              borderRadius: BorderRadius.circular(AppDimensions.radius16),
              border: Border.all(color: scheme.error.withValues(alpha: .38)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.error_outline_rounded, color: scheme.error, size: 20.sp),
                SizedBox(width: 10.w),
                Expanded(
                  child: Text(resolvedErrorMessage, style: AppTextStyles.body.copyWith(color: scheme.error)),
                ),
              ],
            ),
          ),
        ],
        SizedBox(height: AppDimensions.space24),
        OutlinedButton(
          onPressed: isSigningIn ? null : onSignIn,
          style: OutlinedButton.styleFrom(
            minimumSize: Size.fromHeight(56.h.clamp(AppDimensions.minTouchTarget, double.infinity)),
            backgroundColor: AppColors.googleSurface,
            foregroundColor: AppColors.googleText,
            disabledBackgroundColor: AppColors.googleDisabledSurface,
            disabledForegroundColor: AppColors.googleDisabledText,
            side: const BorderSide(color: AppColors.googleOutline),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppDimensions.radius16)),
          ),
          child: AnimatedSwitcher(
            duration: MediaQuery.disableAnimationsOf(context) ? Duration.zero : const Duration(milliseconds: 180),
            child: isSigningIn
                ? SizedBox.square(
                    key: const ValueKey('loading'),
                    dimension: 22.r,
                    child: const CircularProgressIndicator(strokeWidth: 2.4, color: AppColors.googleText),
                  )
                : Row(
                    key: const ValueKey('label'),
                    mainAxisSize: MainAxisSize.min,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      SvgPicture.asset(AppAssets.googleLogo, width: 20.r, height: 20.r),
                      SizedBox(width: AppDimensions.space12),
                      Flexible(
                        child: Text('Tiếp tục với Google', textAlign: TextAlign.center, style: AppTextStyles.button),
                      ),
                    ],
                  ),
          ),
        ),
        SizedBox(height: 14.h),
        Text(
          'Khi tiếp tục, bạn đồng ý cho Snapkit sử dụng tên, email và ảnh đại diện từ Google để tạo tài khoản.',
          textAlign: TextAlign.center,
          style: AppTextStyles.caption.copyWith(color: scheme.onSurfaceVariant),
        ),
      ],
    );
  }
}

class _Benefit extends StatelessWidget {
  const _Benefit({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Container(
        width: 42.r,
        height: 42.r,
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.primary.withValues(alpha: .12),
          borderRadius: BorderRadius.circular(14.r),
        ),
        child: Icon(icon, color: Theme.of(context).colorScheme.primary, size: 21.sp),
      ),
      SizedBox(width: 14.w),
      Expanded(child: Text(text, style: AppTextStyles.bodyStrong)),
    ],
  );
}

class _BenefitGap extends StatelessWidget {
  const _BenefitGap();

  @override
  Widget build(BuildContext context) => SizedBox(height: AppDimensions.space16);
}

class _AmbientOrb extends StatelessWidget {
  const _AmbientOrb({required this.size, this.color});

  final double size;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final resolvedColor = color ?? Theme.of(context).colorScheme.primary;
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(shape: BoxShape.circle, color: resolvedColor.withValues(alpha: .08)),
      ),
    );
  }
}
