import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:get/get.dart';

import '../../core/config/remote_config.dart';
import '../../core/styles/app_colors.dart';
import '../../core/styles/app_dimensions.dart';
import '../../core/styles/app_text_styles.dart';
import '../../core/theme/snapkit_theme.dart';
import '../../features/cleaner/presentation/cleaner_screen.dart';
import '../../features/home/presentation/home_screen.dart';
import '../../features/qr/presentation/qr_screen.dart';
import '../../features/settings/presentation/settings_screen.dart';
import '../application/app_shell_controller.dart';

class AppShell extends GetView<AppShellController> {
  const AppShell({super.key});

  static const _destinations = [
    _AppDestination(icon: Icons.grid_view_rounded, label: 'Tổng quan'),
    _AppDestination(icon: Icons.auto_delete_outlined, selectedIcon: Icons.auto_delete_rounded, label: 'Dọn dẹp'),
    _AppDestination(icon: Icons.qr_code_2_rounded, label: 'QR Studio'),
    _AppDestination(icon: Icons.tune_rounded, label: 'Cài đặt'),
  ];

  static const _screens = [HomeScreen(), CleanerScreen(), QrScreen(), SettingsScreen()];

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: RemoteConfig.instance,
    builder: (context, _) {
      final themeSettings = RemoteConfig.instance.theme;
      return Obx(
        () => Scaffold(
          body: IndexedStack(index: controller.currentIndex, children: _screens),
          bottomNavigationBar: _BottomNavigation(
            style: themeSettings.navigationStyle,
            preset: themeSettings.preset,
            currentIndex: controller.currentIndex,
            destinations: _destinations,
            onSelected: controller.selectIndex,
          ),
        ),
      );
    },
  );
}

class _BottomNavigation extends StatelessWidget {
  const _BottomNavigation({
    required this.style,
    required this.preset,
    required this.currentIndex,
    required this.destinations,
    required this.onSelected,
  });

  final SnapkitNavigationStyle style;
  final SnapkitThemePreset preset;
  final int currentIndex;
  final List<_AppDestination> destinations;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final solid = style == SnapkitNavigationStyle.solid;
    final glass = style == SnapkitNavigationStyle.glass;
    final threadsMono = preset == SnapkitThemePreset.threadsMono;
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    final solidSurface = Color.alphaBlend(scheme.primary.withValues(alpha: .035), scheme.surface);
    final bar = Container(
      margin: solid
          ? EdgeInsets.zero
          : EdgeInsets.fromLTRB(
              AppDimensions.space12,
              AppDimensions.space8,
              AppDimensions.space12,
              AppDimensions.space8,
            ),
      padding: EdgeInsets.symmetric(
        horizontal: solid ? AppDimensions.space8 : 7.w,
        vertical: solid ? AppDimensions.space8 : 6.h,
      ),
      decoration: BoxDecoration(
        color: solid
            ? solidSurface
            : glass
            ? scheme.surface.withValues(alpha: .78)
            : scheme.surface,
        borderRadius: solid ? BorderRadius.zero : BorderRadius.circular(AppDimensions.radius28),
        border: solid
            ? Border(top: BorderSide(color: scheme.outlineVariant.withValues(alpha: .86)))
            : Border.all(color: scheme.outlineVariant.withValues(alpha: glass ? .72 : 1)),
        boxShadow: solid
            ? [BoxShadow(color: AppColors.black.withValues(alpha: .1), blurRadius: 22.r, offset: Offset(0, -6.h))]
            : [BoxShadow(color: AppColors.black.withValues(alpha: .18), blurRadius: 28.r, offset: Offset(0, 10.h))],
      ),
      child: Row(
        children: List.generate(destinations.length, (index) {
          final destination = destinations[index];
          final selected = currentIndex == index;
          final selectedBackground = threadsMono
              ? scheme.onSurface.withValues(alpha: solid ? .1 : .14)
              : solid
              ? scheme.primary.withValues(alpha: .11)
              : scheme.secondary;
          final selectedForeground = threadsMono ? scheme.onSurface : (solid ? scheme.primary : scheme.onSecondary);
          return Expanded(
            child: InkWell(
              onTap: () => onSelected(index),
              borderRadius: BorderRadius.circular(21.r),
              child: AnimatedContainer(
                duration: reduceMotion ? Duration.zero : const Duration(milliseconds: 220),
                curve: Curves.easeOutCubic,
                constraints: BoxConstraints(minHeight: 60.h.clamp(AppDimensions.minTouchTarget, double.infinity)),
                padding: EdgeInsets.symmetric(horizontal: 3.w, vertical: solid ? 4.h : 6.h),
                decoration: BoxDecoration(
                  color: selected ? selectedBackground : AppColors.transparent,
                  borderRadius: BorderRadius.circular(AppDimensions.radius20),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (solid) ...[
                      AnimatedContainer(
                        duration: reduceMotion ? Duration.zero : const Duration(milliseconds: 220),
                        curve: Curves.easeOutCubic,
                        width: selected ? 28.w : 8.w,
                        height: 3.h,
                        decoration: BoxDecoration(
                          color: selected ? selectedForeground : AppColors.transparent,
                          borderRadius: BorderRadius.circular(99.r),
                        ),
                      ),
                      SizedBox(height: 5.h),
                    ],
                    Icon(
                      selected ? destination.selectedIcon ?? destination.icon : destination.icon,
                      size: AppDimensions.iconMedium,
                      color: selected ? selectedForeground : scheme.onSurfaceVariant,
                    ),
                    SizedBox(height: AppDimensions.space4),
                    Text(
                      destination.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.navigation.copyWith(
                        fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                        color: selected ? selectedForeground : scheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }),
      ),
    );

    if (solid) {
      return Material(
        color: solidSurface,
        child: SafeArea(top: false, child: bar),
      );
    }

    return Material(
      color: AppColors.transparent,
      child: SafeArea(
        top: false,
        minimum: EdgeInsets.only(bottom: AppDimensions.space4),
        child: glass
            ? ClipRRect(
                borderRadius: BorderRadius.circular(AppDimensions.radius28),
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 18.r, sigmaY: 18.r),
                  child: bar,
                ),
              )
            : bar,
      ),
    );
  }
}

class _AppDestination {
  const _AppDestination({required this.icon, required this.label, this.selectedIcon});

  final IconData icon;
  final IconData? selectedIcon;
  final String label;
}
