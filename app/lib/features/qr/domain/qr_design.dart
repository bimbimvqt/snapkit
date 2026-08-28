import 'dart:typed_data';

import 'package:flutter/material.dart';

enum QrContentKind {
  text('text'),
  url('url'),
  wifi('wifi');

  const QrContentKind(this.wireName);
  final String wireName;
}

enum QrEyeStyle {
  square('square'),
  circle('circle');

  const QrEyeStyle(this.wireName);
  final String wireName;
}

enum QrModuleStyle {
  square('square'),
  circle('circle');

  const QrModuleStyle(this.wireName);
  final String wireName;
}

enum QrFrameStyle {
  none('none'),
  rounded('rounded'),
  badge('badge'),
  rainbow('rainbow'),
  floral('floral');

  const QrFrameStyle(this.wireName);
  final String wireName;
}

enum QrFrameShape {
  rounded('rounded'),
  square('square'),
  ticket('ticket');

  const QrFrameShape(this.wireName);
  final String wireName;
}

enum QrFrameShadow {
  none('none'),
  soft('soft'),
  glow('glow');

  const QrFrameShadow(this.wireName);
  final String wireName;
}

enum QrLogoKind {
  none('none'),
  shield('shield'),
  link('link'),
  wifi('wifi'),
  heart('heart'),
  business('business'),
  custom('custom');

  const QrLogoKind(this.wireName);
  final String wireName;
}

enum QrLogoShape {
  rounded('rounded'),
  circle('circle'),
  square('square');

  const QrLogoShape(this.wireName);
  final String wireName;
}

enum QrDesignPreset { classic, rainbow, floral, creator, business }

class QrDesign {
  const QrDesign({
    required this.foreground,
    required this.background,
    required this.frameColor,
    required this.frameSecondaryColor,
    required this.frameBackground,
    required this.logoColor,
    required this.logoBackground,
    required this.borderWidth,
    required this.cornerRadius,
    required this.framePadding,
    required this.logoScale,
    required this.eyeStyle,
    required this.moduleStyle,
    required this.frameStyle,
    required this.frameShape,
    required this.frameShadow,
    required this.logoKind,
    required this.logoShape,
    required this.frameLabel,
    this.customLogoBytes,
  });

  static const initial = QrDesign(
    foreground: Color(0xFF102019),
    background: Color(0xFFF2F8F5),
    frameColor: Color(0xFF55D6A7),
    frameSecondaryColor: Color(0xFFB7F34D),
    frameBackground: Color(0xFFFFFFFF),
    logoColor: Color(0xFF102019),
    logoBackground: Color(0xFFFFFFFF),
    borderWidth: 4,
    cornerRadius: 24,
    framePadding: 18,
    logoScale: .2,
    eyeStyle: QrEyeStyle.square,
    moduleStyle: QrModuleStyle.square,
    frameStyle: QrFrameStyle.rounded,
    frameShape: QrFrameShape.rounded,
    frameShadow: QrFrameShadow.soft,
    logoKind: QrLogoKind.none,
    logoShape: QrLogoShape.rounded,
    frameLabel: '',
  );

  final Color foreground;
  final Color background;
  final Color frameColor;
  final Color frameSecondaryColor;
  final Color frameBackground;
  final Color logoColor;
  final Color logoBackground;
  final double borderWidth;
  final double cornerRadius;
  final double framePadding;
  final double logoScale;
  final QrEyeStyle eyeStyle;
  final QrModuleStyle moduleStyle;
  final QrFrameStyle frameStyle;
  final QrFrameShape frameShape;
  final QrFrameShadow frameShadow;
  final QrLogoKind logoKind;
  final QrLogoShape logoShape;
  final String frameLabel;
  final Uint8List? customLogoBytes;

  double get contrastRatio => colorContrastRatio(foreground, background);
  bool get isScannable => contrastRatio >= 3;
  bool get hasCustomLogo => logoKind == QrLogoKind.custom && customLogoBytes != null;

  Map<String, Object> toPayload() => {
    'foreground': colorToHex(foreground),
    'background': colorToHex(background),
    'frameColor': colorToHex(frameColor),
    'frameSecondaryColor': colorToHex(frameSecondaryColor),
    'frameBackground': colorToHex(frameBackground),
    'iconColor': colorToHex(logoColor),
    'logoBackground': colorToHex(logoBackground),
    'borderWidth': borderWidth,
    'cornerRadius': cornerRadius,
    'framePadding': framePadding,
    'logoScale': logoScale,
    'eyeShape': eyeStyle.wireName,
    'moduleShape': moduleStyle.wireName,
    'frameStyle': frameStyle.wireName,
    'frameShape': frameShape.wireName,
    'frameShadow': frameShadow.wireName,
    'frameLabel': frameLabel.trim(),
    'icon': logoKind.wireName,
    'logoShape': logoShape.wireName,
  };

  QrDesign copyWith({
    Color? foreground,
    Color? background,
    Color? frameColor,
    Color? frameSecondaryColor,
    Color? frameBackground,
    Color? logoColor,
    Color? logoBackground,
    double? borderWidth,
    double? cornerRadius,
    double? framePadding,
    double? logoScale,
    QrEyeStyle? eyeStyle,
    QrModuleStyle? moduleStyle,
    QrFrameStyle? frameStyle,
    QrFrameShape? frameShape,
    QrFrameShadow? frameShadow,
    QrLogoKind? logoKind,
    QrLogoShape? logoShape,
    String? frameLabel,
    Uint8List? customLogoBytes,
    bool clearCustomLogo = false,
  }) => QrDesign(
    foreground: foreground ?? this.foreground,
    background: background ?? this.background,
    frameColor: frameColor ?? this.frameColor,
    frameSecondaryColor: frameSecondaryColor ?? this.frameSecondaryColor,
    frameBackground: frameBackground ?? this.frameBackground,
    logoColor: logoColor ?? this.logoColor,
    logoBackground: logoBackground ?? this.logoBackground,
    borderWidth: borderWidth ?? this.borderWidth,
    cornerRadius: cornerRadius ?? this.cornerRadius,
    framePadding: framePadding ?? this.framePadding,
    logoScale: logoScale ?? this.logoScale,
    eyeStyle: eyeStyle ?? this.eyeStyle,
    moduleStyle: moduleStyle ?? this.moduleStyle,
    frameStyle: frameStyle ?? this.frameStyle,
    frameShape: frameShape ?? this.frameShape,
    frameShadow: frameShadow ?? this.frameShadow,
    logoKind: logoKind ?? this.logoKind,
    logoShape: logoShape ?? this.logoShape,
    frameLabel: frameLabel ?? this.frameLabel,
    customLogoBytes: clearCustomLogo ? null : customLogoBytes ?? this.customLogoBytes,
  );

  static QrDesign fromPreset(QrDesignPreset preset) => switch (preset) {
    QrDesignPreset.classic => initial,
    QrDesignPreset.rainbow => initial.copyWith(
      background: Colors.white,
      frameBackground: Colors.white,
      frameColor: const Color(0xFF7C3AED),
      frameSecondaryColor: const Color(0xFFEC4899),
      frameStyle: QrFrameStyle.rainbow,
      frameLabel: 'SCAN ME',
      frameShadow: QrFrameShadow.glow,
    ),
    QrDesignPreset.floral => initial.copyWith(
      foreground: const Color(0xFF3B2F2F),
      background: const Color(0xFFFFFBF5),
      frameBackground: const Color(0xFFFFF7ED),
      frameColor: const Color(0xFFDB2777),
      frameSecondaryColor: const Color(0xFFF59E0B),
      frameStyle: QrFrameStyle.floral,
      frameLabel: 'MỞ BẰNG CAMERA',
    ),
    QrDesignPreset.creator => initial.copyWith(
      foreground: const Color(0xFF111111),
      background: Colors.white,
      frameBackground: const Color(0xFFF5F3FF),
      frameColor: const Color(0xFF8B5CF6),
      frameSecondaryColor: const Color(0xFF22D3EE),
      frameStyle: QrFrameStyle.rainbow,
      frameShape: QrFrameShape.ticket,
      frameLabel: '@CREATOR',
    ),
    QrDesignPreset.business => initial.copyWith(
      foreground: const Color(0xFF172554),
      background: Colors.white,
      frameBackground: const Color(0xFFF8FAFC),
      frameColor: const Color(0xFF1D4ED8),
      frameSecondaryColor: const Color(0xFF38BDF8),
      frameStyle: QrFrameStyle.badge,
      frameShape: QrFrameShape.square,
      frameLabel: 'SCAN TO CONNECT',
      logoKind: QrLogoKind.business,
    ),
  };
}

String colorToHex(Color color) {
  final value = color.toARGB32() & 0xFFFFFF;
  return '#${value.toRadixString(16).padLeft(6, '0').toUpperCase()}';
}

Color? colorFromHex(String input) {
  final normalized = input.trim().replaceFirst('#', '');
  if (!RegExp(r'^[0-9a-fA-F]{6}$').hasMatch(normalized)) return null;
  return Color(0xFF000000 | int.parse(normalized, radix: 16));
}

double colorContrastRatio(Color first, Color second) {
  final firstLuminance = first.computeLuminance();
  final secondLuminance = second.computeLuminance();
  final lighter = firstLuminance > secondLuminance ? firstLuminance : secondLuminance;
  final darker = firstLuminance < secondLuminance ? firstLuminance : secondLuminance;
  return (lighter + .05) / (darker + .05);
}
