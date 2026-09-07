import 'package:flutter/material.dart';

import '../styles/app_colors.dart';

enum SnapkitThemePreset {
  midnightLime('midnight_lime'),
  oceanCyan('ocean_cyan'),
  violetPulse('violet_pulse'),
  sunsetCoral('sunset_coral'),
  mintLight('mint_light'),
  threadsMono('threads_mono');

  const SnapkitThemePreset(this.wireName);
  final String wireName;
}

enum SnapkitNavigationStyle {
  floating('floating'),
  glass('glass'),
  solid('solid');

  const SnapkitNavigationStyle(this.wireName);
  final String wireName;
}

class AppThemeSettings {
  const AppThemeSettings({
    this.preset = SnapkitThemePreset.midnightLime,
    this.mode = ThemeMode.dark,
    this.navigationStyle = SnapkitNavigationStyle.floating,
  });

  factory AppThemeSettings.fromMobile(Map<String, Object?> mobile) {
    final rawTheme = mobile['theme'];
    final theme = rawTheme is Map ? rawTheme : const {};
    final presetName = theme['preset']?.toString();
    final modeName = theme['mode']?.toString();
    final navigationName = theme['navigationStyle']?.toString();
    return AppThemeSettings(
      preset: SnapkitThemePreset.values.firstWhere(
        (value) => value.wireName == presetName,
        orElse: () => SnapkitThemePreset.midnightLime,
      ),
      mode: switch (modeName) {
        'light' => ThemeMode.light,
        'system' => ThemeMode.system,
        _ => ThemeMode.dark,
      },
      navigationStyle: SnapkitNavigationStyle.values.firstWhere(
        (value) => value.wireName == navigationName,
        orElse: () => SnapkitNavigationStyle.floating,
      ),
    );
  }

  final SnapkitThemePreset preset;
  final ThemeMode mode;
  final SnapkitNavigationStyle navigationStyle;

  @override
  bool operator ==(Object other) =>
      other is AppThemeSettings &&
      other.preset == preset &&
      other.mode == mode &&
      other.navigationStyle == navigationStyle;

  @override
  int get hashCode => Object.hash(preset, mode, navigationStyle);
}

abstract final class SnapkitTheme {
  static ThemeData dark([SnapkitThemePreset preset = SnapkitThemePreset.midnightLime]) =>
      _theme(Brightness.dark, preset);

  static ThemeData light([SnapkitThemePreset preset = SnapkitThemePreset.midnightLime]) =>
      _theme(Brightness.light, preset);

  static AppPalette _palette(SnapkitThemePreset preset) => switch (preset) {
    SnapkitThemePreset.midnightLime => AppColors.midnightLime,
    SnapkitThemePreset.oceanCyan => AppColors.oceanCyan,
    SnapkitThemePreset.violetPulse => AppColors.violetPulse,
    SnapkitThemePreset.sunsetCoral => AppColors.sunsetCoral,
    SnapkitThemePreset.mintLight => AppColors.mintLight,
    SnapkitThemePreset.threadsMono => AppColors.threadsMono,
  };

  static ThemeData _theme(Brightness brightness, SnapkitThemePreset preset) {
    final palette = _palette(preset);
    final dark = brightness == Brightness.dark;
    final surface = dark ? palette.darkSurface : palette.lightSurface;
    final raised = dark ? palette.darkRaised : palette.lightRaised;
    final onSurface = dark ? palette.darkOnSurface : palette.lightOnSurface;
    final onSurfaceVariant = dark ? palette.darkMuted : palette.lightMuted;
    final outline = dark ? palette.darkOutline : palette.lightOutline;
    final generatedScheme = ColorScheme.fromSeed(seedColor: palette.brand, brightness: brightness, surface: surface);
    // Primary also colors text and focus indicators. Seed-derived tones preserve
    // each hue while keeping those controls legible on both light and dark surfaces.
    final primary = preset == SnapkitThemePreset.threadsMono ? onSurface : generatedScheme.primary;
    final scheme = generatedScheme.copyWith(
      primary: primary,
      onPrimary: _contrastColor(primary),
      secondary: palette.accent,
      onSecondary: _contrastColor(palette.accent),
      tertiary: palette.accent,
      surface: surface,
      onSurface: onSurface,
      onSurfaceVariant: onSurfaceVariant,
      surfaceContainerHighest: raised,
      outline: outline,
      outlineVariant: outline.withValues(alpha: .72),
      error: dark ? AppColors.darkError : AppColors.lightError,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor: dark ? palette.darkCanvas : palette.lightCanvas,
      fontFamily: 'SF Pro Display',
      cardTheme: CardThemeData(
        color: surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
          side: BorderSide(color: outline),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(48, 52),
          backgroundColor: palette.accent,
          foregroundColor: _contrastColor(palette.accent),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(48, 52),
          side: BorderSide(color: outline),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: raised,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: outline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: primary, width: 2),
        ),
      ),
      dividerColor: outline,
      snackBarTheme: SnackBarThemeData(
        backgroundColor: raised,
        contentTextStyle: TextStyle(color: onSurface),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
    );
  }

  static Color _contrastColor(Color background) =>
      ThemeData.estimateBrightnessForColor(background) == Brightness.dark ? AppColors.white : AppColors.darkInk;
}
