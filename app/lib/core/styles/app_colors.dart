import 'package:flutter/material.dart';

class AppPalette {
  const AppPalette({
    required this.brand,
    required this.accent,
    required this.darkCanvas,
    required this.darkSurface,
    required this.darkRaised,
    required this.lightCanvas,
    this.darkOnSurface = AppColors.darkOnSurface,
    this.darkMuted = AppColors.darkMuted,
    this.darkOutline = AppColors.darkOutline,
    this.lightSurface = AppColors.white,
    this.lightRaised = AppColors.lightRaised,
    this.lightOnSurface = AppColors.lightOnSurface,
    this.lightMuted = AppColors.lightMuted,
    this.lightOutline = AppColors.lightOutline,
  });

  final Color brand;
  final Color accent;
  final Color darkCanvas;
  final Color darkSurface;
  final Color darkRaised;
  final Color darkOnSurface;
  final Color darkMuted;
  final Color darkOutline;
  final Color lightCanvas;
  final Color lightSurface;
  final Color lightRaised;
  final Color lightOnSurface;
  final Color lightMuted;
  final Color lightOutline;
}

abstract final class AppColors {
  static const transparent = Colors.transparent;
  static const white = Color(0xFFFFFFFF);
  static const black = Color(0xFF000000);
  static const darkInk = Color(0xFF102019);
  static const darkOnSurface = Color(0xFFF3F8F6);
  static const darkMuted = Color(0xFFB4C7C0);
  static const darkOutline = Color(0xFF30443E);
  static const lightRaised = Color(0xFFEDF4F1);
  static const lightOnSurface = Color(0xFF13231D);
  static const lightMuted = Color(0xFF52635D);
  static const lightOutline = Color(0xFFD7E4DF);
  static const darkError = Color(0xFFFF6F7E);
  static const lightError = Color(0xFFB4233B);

  static const googleSurface = white;
  static const googleText = Color(0xFF1F1F1F);
  static const googleDisabledSurface = Color(0xFFE6E6E6);
  static const googleDisabledText = Color(0xFF6F6F6F);
  static const googleOutline = Color(0xFF747775);

  static const proGradientStart = Color(0xFFB7F34D);
  static const proGradientEnd = Color(0xFF78DFAF);
  static const pulseQrLight = Color(0xFF2563EB);
  static const pulseQrDark = Color(0xFF60A5FA);

  static const rainbow = <Color>[
    Color(0xFFEF4444),
    Color(0xFFF59E0B),
    Color(0xFF22C55E),
    Color(0xFF06B6D4),
    Color(0xFF6366F1),
    Color(0xFFD946EF),
    Color(0xFFEF4444),
  ];

  static const midnightLime = AppPalette(
    brand: Color(0xFF55D6A7),
    accent: Color(0xFFB7F34D),
    darkCanvas: Color(0xFF0B1513),
    darkSurface: Color(0xFF111E1B),
    darkRaised: Color(0xFF182824),
    lightCanvas: Color(0xFFF3F8F6),
  );
  static const oceanCyan = AppPalette(
    brand: Color(0xFF22D3EE),
    accent: Color(0xFF67E8F9),
    darkCanvas: Color(0xFF07151C),
    darkSurface: Color(0xFF0D222C),
    darkRaised: Color(0xFF14313E),
    lightCanvas: Color(0xFFF0FAFC),
  );
  static const violetPulse = AppPalette(
    brand: Color(0xFFA78BFA),
    accent: Color(0xFFE879F9),
    darkCanvas: Color(0xFF100C1C),
    darkSurface: Color(0xFF1B142B),
    darkRaised: Color(0xFF281D3D),
    lightCanvas: Color(0xFFF8F5FF),
  );
  static const sunsetCoral = AppPalette(
    brand: Color(0xFFFB7185),
    accent: Color(0xFFFDBA74),
    darkCanvas: Color(0xFF1C1012),
    darkSurface: Color(0xFF28171A),
    darkRaised: Color(0xFF382024),
    lightCanvas: Color(0xFFFFF7F4),
  );
  static const mintLight = AppPalette(
    brand: Color(0xFF0F9F72),
    accent: Color(0xFF84CC16),
    darkCanvas: Color(0xFF091713),
    darkSurface: Color(0xFF10241D),
    darkRaised: Color(0xFF183329),
    lightCanvas: Color(0xFFF3FAF7),
  );
  static const threadsMono = AppPalette(
    brand: Color(0xFFF5F5F5),
    accent: Color(0xFFD6D6D6),
    darkCanvas: Color(0xFF101010),
    darkSurface: Color(0xFF171717),
    darkRaised: Color(0xFF222222),
    darkOnSurface: Color(0xFFF5F5F5),
    darkMuted: Color(0xFFA8A8A8),
    darkOutline: Color(0xFF303030),
    lightCanvas: Color(0xFFF7F7F7),
    lightSurface: white,
    lightRaised: Color(0xFFEEEEEE),
    lightOnSurface: Color(0xFF111111),
    lightMuted: Color(0xFF5F5F5F),
    lightOutline: Color(0xFFD5D5D5),
  );
}
