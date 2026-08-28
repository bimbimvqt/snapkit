import 'package:flutter/material.dart';

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

abstract final class SnapkitColors {
  static const ink = Color(0xFFF2F8F5),
      muted = Color(0xFF9BB0A9),
      canvas = Color(0xFF0B1513),
      surface = Color(0xFF111E1B),
      raised = Color(0xFF182824),
      line = Color(0xFF263B35),
      brand = Color(0xFF55D6A7),
      accent = Color(0xFFB7F34D),
      danger = Color(0xFFFF6F7E);
}

class _Palette {
  const _Palette({
    required this.brand,
    required this.accent,
    required this.darkCanvas,
    required this.darkSurface,
    required this.darkRaised,
    required this.lightCanvas,
    this.darkOnSurface = const Color(0xFFF3F8F6),
    this.darkMuted = const Color(0xFFB4C7C0),
    this.darkOutline = const Color(0xFF30443E),
    this.lightSurface = Colors.white,
    this.lightRaised = const Color(0xFFEDF4F1),
    this.lightOnSurface = const Color(0xFF13231D),
    this.lightMuted = const Color(0xFF52635D),
    this.lightOutline = const Color(0xFFD7E4DF),
  });
  final Color brand,
      accent,
      darkCanvas,
      darkSurface,
      darkRaised,
      darkOnSurface,
      darkMuted,
      darkOutline,
      lightCanvas,
      lightSurface,
      lightRaised,
      lightOnSurface,
      lightMuted,
      lightOutline;
}

abstract final class SnapkitTheme {
  static ThemeData dark([SnapkitThemePreset preset = SnapkitThemePreset.midnightLime]) =>
      _theme(Brightness.dark, preset);

  static ThemeData light([SnapkitThemePreset preset = SnapkitThemePreset.midnightLime]) =>
      _theme(Brightness.light, preset);

  static _Palette _palette(SnapkitThemePreset preset) => switch (preset) {
    SnapkitThemePreset.midnightLime => const _Palette(
      brand: Color(0xFF55D6A7),
      accent: Color(0xFFB7F34D),
      darkCanvas: Color(0xFF0B1513),
      darkSurface: Color(0xFF111E1B),
      darkRaised: Color(0xFF182824),
      lightCanvas: Color(0xFFF3F8F6),
    ),
    SnapkitThemePreset.oceanCyan => const _Palette(
      brand: Color(0xFF22D3EE),
      accent: Color(0xFF67E8F9),
      darkCanvas: Color(0xFF07151C),
      darkSurface: Color(0xFF0D222C),
      darkRaised: Color(0xFF14313E),
      lightCanvas: Color(0xFFF0FAFC),
    ),
    SnapkitThemePreset.violetPulse => const _Palette(
      brand: Color(0xFFA78BFA),
      accent: Color(0xFFE879F9),
      darkCanvas: Color(0xFF100C1C),
      darkSurface: Color(0xFF1B142B),
      darkRaised: Color(0xFF281D3D),
      lightCanvas: Color(0xFFF8F5FF),
    ),
    SnapkitThemePreset.sunsetCoral => const _Palette(
      brand: Color(0xFFFB7185),
      accent: Color(0xFFFDBA74),
      darkCanvas: Color(0xFF1C1012),
      darkSurface: Color(0xFF28171A),
      darkRaised: Color(0xFF382024),
      lightCanvas: Color(0xFFFFF7F4),
    ),
    SnapkitThemePreset.mintLight => const _Palette(
      brand: Color(0xFF0F9F72),
      accent: Color(0xFF84CC16),
      darkCanvas: Color(0xFF091713),
      darkSurface: Color(0xFF10241D),
      darkRaised: Color(0xFF183329),
      lightCanvas: Color(0xFFF3FAF7),
    ),
    SnapkitThemePreset.threadsMono => const _Palette(
      brand: Color(0xFFF5F5F5),
      accent: Color(0xFFD6D6D6),
      darkCanvas: Color(0xFF101010),
      darkSurface: Color(0xFF171717),
      darkRaised: Color(0xFF222222),
      darkOnSurface: Color(0xFFF5F5F5),
      darkMuted: Color(0xFFA8A8A8),
      darkOutline: Color(0xFF303030),
      lightCanvas: Color(0xFFF7F7F7),
      lightSurface: Color(0xFFFFFFFF),
      lightRaised: Color(0xFFEEEEEE),
      lightOnSurface: Color(0xFF111111),
      lightMuted: Color(0xFF5F5F5F),
      lightOutline: Color(0xFFD5D5D5),
    ),
  };

  static ThemeData _theme(Brightness brightness, SnapkitThemePreset preset) {
    final palette = _palette(preset);
    final dark = brightness == Brightness.dark;
    final surface = dark ? palette.darkSurface : palette.lightSurface;
    final raised = dark ? palette.darkRaised : palette.lightRaised;
    final onSurface = dark ? palette.darkOnSurface : palette.lightOnSurface;
    final onSurfaceVariant = dark ? palette.darkMuted : palette.lightMuted;
    final outline = dark ? palette.darkOutline : palette.lightOutline;
    final scheme = ColorScheme.fromSeed(seedColor: palette.brand, brightness: brightness, surface: surface).copyWith(
      primary: palette.brand,
      onPrimary: _contrastColor(palette.brand),
      secondary: palette.accent,
      onSecondary: _contrastColor(palette.accent),
      tertiary: palette.accent,
      surface: surface,
      onSurface: onSurface,
      onSurfaceVariant: onSurfaceVariant,
      surfaceContainerHighest: raised,
      outline: outline,
      outlineVariant: outline.withValues(alpha: .72),
      error: dark ? const Color(0xFFFF6F7E) : const Color(0xFFB4233B),
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
          borderSide: BorderSide(color: palette.brand, width: 2),
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
      ThemeData.estimateBrightnessForColor(background) == Brightness.dark ? Colors.white : const Color(0xFF102019);
}
