import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:toolbox_one/core/theme/toolbox_theme.dart';

void main() {
  test('parses the remote theme contract', () {
    final settings = AppThemeSettings.fromMobile({
      'theme': {
        'preset': 'violet_pulse',
        'mode': 'system',
        'navigationStyle': 'glass',
      },
    });

    expect(settings.preset, ToolboxThemePreset.violetPulse);
    expect(settings.mode, ThemeMode.system);
    expect(settings.navigationStyle, ToolboxNavigationStyle.glass);
  });

  test('falls back safely when remote values are unsupported', () {
    final settings = AppThemeSettings.fromMobile({
      'theme': {
        'preset': 'unknown',
        'mode': 'sepia',
        'navigationStyle': 'legacy',
      },
    });

    expect(settings, const AppThemeSettings());
  });

  test('presets generate distinct semantic color schemes', () {
    final lime = ToolboxTheme.dark(ToolboxThemePreset.midnightLime);
    final ocean = ToolboxTheme.dark(ToolboxThemePreset.oceanCyan);

    expect(lime.colorScheme.primary, isNot(ocean.colorScheme.primary));
    expect(lime.scaffoldBackgroundColor, isNot(ocean.scaffoldBackgroundColor));
  });
}
