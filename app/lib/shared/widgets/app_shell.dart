import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/config/remote_config.dart';
import '../../core/theme/toolbox_theme.dart';

class AppShell extends StatelessWidget {
  const AppShell({required this.shell, super.key});
  final StatefulNavigationShell shell;

  static const _destinations = [
    _AppDestination(icon: Icons.grid_view_rounded, label: 'Tổng quan'),
    _AppDestination(
      icon: Icons.auto_delete_outlined,
      selectedIcon: Icons.auto_delete_rounded,
      label: 'Dọn dẹp',
    ),
    _AppDestination(icon: Icons.qr_code_2_rounded, label: 'QR Studio'),
    _AppDestination(icon: Icons.tune_rounded, label: 'Cài đặt'),
  ];

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: RemoteConfig.instance,
    builder: (context, _) {
      final style = RemoteConfig.instance.theme.navigationStyle;
      return Scaffold(
        body: shell,
        bottomNavigationBar: _BottomNavigation(
          style: style,
          currentIndex: shell.currentIndex,
          destinations: _destinations,
          onSelected: (index) => shell.goBranch(
            index,
            initialLocation: index == shell.currentIndex,
          ),
        ),
      );
    },
  );
}

class _BottomNavigation extends StatelessWidget {
  const _BottomNavigation({
    required this.style,
    required this.currentIndex,
    required this.destinations,
    required this.onSelected,
  });
  final ToolboxNavigationStyle style;
  final int currentIndex;
  final List<_AppDestination> destinations;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final solid = style == ToolboxNavigationStyle.solid;
    final glass = style == ToolboxNavigationStyle.glass;
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    final bar = Container(
      margin: solid ? EdgeInsets.zero : const EdgeInsets.fromLTRB(12, 8, 12, 8),
      padding: EdgeInsets.symmetric(
        horizontal: solid ? 8 : 7,
        vertical: solid ? 7 : 6,
      ),
      decoration: BoxDecoration(
        color: glass ? scheme.surface.withValues(alpha: .78) : scheme.surface,
        borderRadius: solid ? BorderRadius.zero : BorderRadius.circular(28),
        border: Border.all(
          color: scheme.outlineVariant.withValues(alpha: glass ? .72 : 1),
        ),
        boxShadow: solid
            ? null
            : [
                BoxShadow(
                  color: Colors.black.withValues(alpha: .18),
                  blurRadius: 28,
                  offset: const Offset(0, 10),
                ),
              ],
      ),
      child: Row(
        children: List.generate(destinations.length, (index) {
          final destination = destinations[index];
          final selected = currentIndex == index;
          return Expanded(
            child: Semantics(
              selected: selected,
              button: true,
              label: destination.label,
              child: InkWell(
                onTap: () => onSelected(index),
                borderRadius: BorderRadius.circular(21),
                child: AnimatedContainer(
                  duration: reduceMotion
                      ? Duration.zero
                      : const Duration(milliseconds: 220),
                  curve: Curves.easeOutCubic,
                  constraints: const BoxConstraints(minHeight: 58),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 3,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: selected
                        ? scheme.secondary.withValues(alpha: solid ? .2 : 1)
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        selected
                            ? destination.selectedIcon ?? destination.icon
                            : destination.icon,
                        size: 22,
                        color: selected
                            ? (solid ? scheme.secondary : scheme.onSecondary)
                            : scheme.onSurfaceVariant,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        destination.label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 10.5,
                          height: 1,
                          fontWeight: selected
                              ? FontWeight.w800
                              : FontWeight.w600,
                          color: selected
                              ? (solid ? scheme.secondary : scheme.onSecondary)
                              : scheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        }),
      ),
    );

    return Material(
      color: Colors.transparent,
      child: SafeArea(
        top: false,
        minimum: solid ? EdgeInsets.zero : const EdgeInsets.only(bottom: 4),
        child: glass
            ? ClipRRect(
                borderRadius: BorderRadius.circular(28),
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
                  child: bar,
                ),
              )
            : bar,
      ),
    );
  }
}

class _AppDestination {
  const _AppDestination({
    required this.icon,
    required this.label,
    this.selectedIcon,
  });
  final IconData icon;
  final IconData? selectedIcon;
  final String label;
}
