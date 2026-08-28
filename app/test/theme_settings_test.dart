import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:snapkit/core/theme/snapkit_theme.dart';

void main() {
  test('parses the remote theme contract', () {
    final settings = AppThemeSettings.fromMobile({
      'theme': {'preset': 'violet_pulse', 'mode': 'system', 'navigationStyle': 'glass'},
    });

    expect(settings.preset, SnapkitThemePreset.violetPulse);
    expect(settings.mode, ThemeMode.system);
    expect(settings.navigationStyle, SnapkitNavigationStyle.glass);
  });

  test('falls back safely when remote values are unsupported', () {
    final settings = AppThemeSettings.fromMobile({
      'theme': {'preset': 'unknown', 'mode': 'sepia', 'navigationStyle': 'legacy'},
    });

    expect(settings, const AppThemeSettings());
  });

  test('presets generate distinct semantic color schemes', () {
    final lime = SnapkitTheme.dark(SnapkitThemePreset.midnightLime);
    final ocean = SnapkitTheme.dark(SnapkitThemePreset.oceanCyan);

    expect(lime.colorScheme.primary, isNot(ocean.colorScheme.primary));
    expect(lime.scaffoldBackgroundColor, isNot(ocean.scaffoldBackgroundColor));
  });

  test('parses and renders the Threads-inspired monochrome preset', () {
    final settings = AppThemeSettings.fromMobile({
      'theme': {'preset': 'threads_mono', 'mode': 'dark', 'navigationStyle': 'glass'},
    });
    final theme = SnapkitTheme.dark(settings.preset);
    final lightTheme = SnapkitTheme.light(settings.preset);

    expect(settings.preset, SnapkitThemePreset.threadsMono);
    expect(settings.navigationStyle, SnapkitNavigationStyle.glass);
    expect(theme.scaffoldBackgroundColor, const Color(0xFF101010));
    expect(theme.colorScheme.surface, const Color(0xFF171717));
    expect(theme.colorScheme.onSurface, const Color(0xFFF5F5F5));
    expect(lightTheme.scaffoldBackgroundColor, const Color(0xFFF7F7F7));
    expect(_contrastRatio(theme.colorScheme.onSurface, theme.scaffoldBackgroundColor), greaterThanOrEqualTo(4.5));
  });
}

double _contrastRatio(Color foreground, Color background) {
  final lighter = foreground.computeLuminance() > background.computeLuminance() ? foreground : background;
  final darker = foreground == lighter ? background : foreground;
  return (lighter.computeLuminance() + 0.05) / (darker.computeLuminance() + 0.05);
}
