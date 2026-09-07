import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:snapkit/core/theme/snapkit_theme.dart';

double _contrastRatio(Color first, Color second) {
  final firstLuminance = first.computeLuminance();
  final secondLuminance = second.computeLuminance();
  final lighter = firstLuminance > secondLuminance ? firstLuminance : secondLuminance;
  final darker = firstLuminance > secondLuminance ? secondLuminance : firstLuminance;
  return (lighter + .05) / (darker + .05);
}

void main() {
  for (final preset in SnapkitThemePreset.values) {
    for (final brightness in Brightness.values) {
      test('${preset.wireName} ${brightness.name} keeps primary text and controls readable', () {
        final theme = brightness == Brightness.dark ? SnapkitTheme.dark(preset) : SnapkitTheme.light(preset);
        final scheme = theme.colorScheme;
        final surfaces = {
          'canvas': theme.scaffoldBackgroundColor,
          'surface': scheme.surface,
          'surfaceContainerLowest': scheme.surfaceContainerLowest,
          'surfaceContainerLow': scheme.surfaceContainerLow,
          'surfaceContainer': scheme.surfaceContainer,
          'surfaceContainerHigh': scheme.surfaceContainerHigh,
          'raised': scheme.surfaceContainerHighest,
        };
        for (final entry in surfaces.entries) {
          expect(
            _contrastRatio(scheme.primary, entry.value),
            greaterThanOrEqualTo(4.5),
            reason: 'Primary text must be readable on ${entry.key}',
          );
        }
        expect(_contrastRatio(scheme.onPrimary, scheme.primary), greaterThanOrEqualTo(4.5));
        final focusedBorder = theme.inputDecorationTheme.focusedBorder;
        expect(focusedBorder, isNotNull);
        expect(focusedBorder?.borderSide.color, scheme.primary);
      });
    }
  }

  test('Threads monochrome keeps neutral primary text in both themes', () {
    for (final theme in [
      SnapkitTheme.light(SnapkitThemePreset.threadsMono),
      SnapkitTheme.dark(SnapkitThemePreset.threadsMono),
    ]) {
      final primary = theme.colorScheme.primary;
      expect(primary.r, primary.g);
      expect(primary.g, primary.b);
    }
  });
}
