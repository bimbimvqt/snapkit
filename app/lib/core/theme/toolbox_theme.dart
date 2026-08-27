import 'package:flutter/material.dart';

enum ToolboxThemePreset {
  midnightLime('midnight_lime'),
  oceanCyan('ocean_cyan'),
  violetPulse('violet_pulse'),
  sunsetCoral('sunset_coral'),
  mintLight('mint_light');

  const ToolboxThemePreset(this.wireName);
  final String wireName;
}

enum ToolboxNavigationStyle {
  floating('floating'),
  glass('glass'),
  solid('solid');

  const ToolboxNavigationStyle(this.wireName);
  final String wireName;
}

class AppThemeSettings {
  const AppThemeSettings({
    this.preset = ToolboxThemePreset.midnightLime,
    this.mode = ThemeMode.dark,
    this.navigationStyle = ToolboxNavigationStyle.floating,
  });

  factory AppThemeSettings.fromMobile(Map<String, Object?> mobile) {
    final rawTheme = mobile['theme'];
    final theme = rawTheme is Map ? rawTheme : const {};
    final presetName = theme['preset']?.toString();
    final modeName = theme['mode']?.toString();
    final navigationName = theme['navigationStyle']?.toString();
    return AppThemeSettings(
      preset: ToolboxThemePreset.values.firstWhere(
        (value) => value.wireName == presetName,
        orElse: () => ToolboxThemePreset.midnightLime,
      ),
      mode: switch (modeName) {
        'light' => ThemeMode.light,
        'system' => ThemeMode.system,
        _ => ThemeMode.dark,
      },
      navigationStyle: ToolboxNavigationStyle.values.firstWhere(
        (value) => value.wireName == navigationName,
        orElse: () => ToolboxNavigationStyle.floating,
      ),
    );
  }

  final ToolboxThemePreset preset;
  final ThemeMode mode;
  final ToolboxNavigationStyle navigationStyle;

  @override
  bool operator ==(Object other) =>
      other is AppThemeSettings &&
      other.preset == preset &&
      other.mode == mode &&
      other.navigationStyle == navigationStyle;

  @override
  int get hashCode => Object.hash(preset, mode, navigationStyle);
}

abstract final class ToolboxColors {
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
  });
  final Color brand, accent, darkCanvas, darkSurface, darkRaised, lightCanvas;
}

abstract final class ToolboxTheme {
  static ThemeData dark([
    ToolboxThemePreset preset = ToolboxThemePreset.midnightLime,
  ]) => _theme(Brightness.dark, preset);

  static ThemeData light([
    ToolboxThemePreset preset = ToolboxThemePreset.midnightLime,
  ]) => _theme(Brightness.light, preset);

  static _Palette _palette(ToolboxThemePreset preset) => switch (preset) {
    ToolboxThemePreset.midnightLime => const _Palette(
      brand: Color(0xFF55D6A7),
      accent: Color(0xFFB7F34D),
      darkCanvas: Color(0xFF0B1513),
      darkSurface: Color(0xFF111E1B),
      darkRaised: Color(0xFF182824),
      lightCanvas: Color(0xFFF3F8F6),
    ),
    ToolboxThemePreset.oceanCyan => const _Palette(
      brand: Color(0xFF22D3EE),
      accent: Color(0xFF67E8F9),
      darkCanvas: Color(0xFF07151C),
      darkSurface: Color(0xFF0D222C),
      darkRaised: Color(0xFF14313E),
      lightCanvas: Color(0xFFF0FAFC),
    ),
    ToolboxThemePreset.violetPulse => const _Palette(
      brand: Color(0xFFA78BFA),
      accent: Color(0xFFE879F9),
      darkCanvas: Color(0xFF100C1C),
      darkSurface: Color(0xFF1B142B),
      darkRaised: Color(0xFF281D3D),
      lightCanvas: Color(0xFFF8F5FF),
    ),
    ToolboxThemePreset.sunsetCoral => const _Palette(
      brand: Color(0xFFFB7185),
      accent: Color(0xFFFDBA74),
      darkCanvas: Color(0xFF1C1012),
      darkSurface: Color(0xFF28171A),
      darkRaised: Color(0xFF382024),
      lightCanvas: Color(0xFFFFF7F4),
    ),
    ToolboxThemePreset.mintLight => const _Palette(
      brand: Color(0xFF0F9F72),
      accent: Color(0xFF84CC16),
      darkCanvas: Color(0xFF091713),
      darkSurface: Color(0xFF10241D),
      darkRaised: Color(0xFF183329),
      lightCanvas: Color(0xFFF3FAF7),
    ),
  };

  static ThemeData _theme(Brightness brightness, ToolboxThemePreset preset) {
    final palette = _palette(preset);
    final dark = brightness == Brightness.dark;
    final surface = dark ? palette.darkSurface : Colors.white;
    final raised = dark ? palette.darkRaised : const Color(0xFFEDF4F1);
    final onSurface = dark ? const Color(0xFFF3F8F6) : const Color(0xFF13231D);
    final outline = dark ? const Color(0xFF30443E) : const Color(0xFFD7E4DF);
    final scheme =
        ColorScheme.fromSeed(
          seedColor: palette.brand,
          brightness: brightness,
          surface: surface,
        ).copyWith(
          primary: palette.brand,
          onPrimary: _contrastColor(palette.brand),
          secondary: palette.accent,
          onSecondary: _contrastColor(palette.accent),
          tertiary: palette.accent,
          surface: surface,
          onSurface: onSurface,
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
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(48, 52),
          side: BorderSide(color: outline),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: raised,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 16,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide.none,
        ),
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
      ThemeData.estimateBrightnessForColor(background) == Brightness.dark
      ? Colors.white
      : const Color(0xFF102019);
}
