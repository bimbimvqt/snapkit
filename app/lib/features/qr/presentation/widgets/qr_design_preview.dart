import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart' as qr;

import '../../domain/qr_design.dart';

class QrDesignPreview extends StatelessWidget {
  const QrDesignPreview({required this.data, required this.design, this.dimension = 220, super.key});

  final String data;
  final QrDesign design;
  final double dimension;

  @override
  Widget build(BuildContext context) {
    final frameRadius = design.frameShape == QrFrameShape.square ? 0.0 : design.cornerRadius;
    final shadowColor = design.frameStyle == QrFrameStyle.rainbow ? design.frameSecondaryColor : design.frameColor;
    final shadows = switch (design.frameShadow) {
      QrFrameShadow.none => const <BoxShadow>[],
      QrFrameShadow.soft => [
        BoxShadow(color: Colors.black.withValues(alpha: .16), blurRadius: 24, offset: const Offset(0, 10)),
      ],
      QrFrameShadow.glow => [BoxShadow(color: shadowColor.withValues(alpha: .26), blurRadius: 30, spreadRadius: 2)],
    };

    return Center(
      child: Container(
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(frameRadius), boxShadow: shadows),
        child: CustomPaint(
          painter: _QrFramePainter(design),
          child: Padding(
            padding: EdgeInsets.all(design.frameStyle == QrFrameStyle.none ? 8 : design.framePadding),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox.square(
                  dimension: dimension,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      qr.QrImageView(
                        data: data,
                        version: qr.QrVersions.auto,
                        errorCorrectionLevel: design.logoKind == QrLogoKind.none
                            ? qr.QrErrorCorrectLevel.M
                            : qr.QrErrorCorrectLevel.H,
                        size: dimension,
                        padding: const EdgeInsets.all(12),
                        backgroundColor: design.background,
                        eyeStyle: qr.QrEyeStyle(
                          eyeShape: design.eyeStyle == QrEyeStyle.circle ? qr.QrEyeShape.circle : qr.QrEyeShape.square,
                          color: design.foreground,
                        ),
                        dataModuleStyle: qr.QrDataModuleStyle(
                          dataModuleShape: design.moduleStyle == QrModuleStyle.circle
                              ? qr.QrDataModuleShape.circle
                              : qr.QrDataModuleShape.square,
                          color: design.foreground,
                        ),
                      ),
                      if (design.logoKind != QrLogoKind.none) _QrLogo(design: design, dimension: dimension),
                    ],
                  ),
                ),
                if (design.frameLabel.trim().isNotEmpty && design.frameStyle != QrFrameStyle.none) ...[
                  const SizedBox(height: 10),
                  Container(
                    constraints: const BoxConstraints(minHeight: 34),
                    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
                    decoration: BoxDecoration(
                      color: design.frameStyle == QrFrameStyle.rainbow
                          ? design.frameSecondaryColor.withValues(alpha: .14)
                          : design.frameColor.withValues(alpha: .14),
                      borderRadius: BorderRadius.circular(99),
                    ),
                    child: Text(
                      design.frameLabel.trim(),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: _readableColor(design.frameBackground),
                        fontSize: 11,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1.2,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _QrLogo extends StatelessWidget {
  const _QrLogo({required this.design, required this.dimension});

  final QrDesign design;
  final double dimension;

  @override
  Widget build(BuildContext context) {
    final size = (dimension * design.logoScale).clamp(38.0, 62.0);
    final radius = switch (design.logoShape) {
      QrLogoShape.circle => size / 2,
      QrLogoShape.rounded => size * .24,
      QrLogoShape.square => 4.0,
    };
    final customBytes = design.customLogoBytes;
    return Container(
      width: size,
      height: size,
      padding: EdgeInsets.all(design.logoKind == QrLogoKind.custom ? 3 : 7),
      decoration: BoxDecoration(
        color: design.logoBackground,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: design.frameColor.withValues(alpha: .34)),
      ),
      clipBehavior: Clip.antiAlias,
      child: design.logoKind == QrLogoKind.custom && customBytes != null
          ? Image.memory(customBytes, fit: BoxFit.cover, gaplessPlayback: true)
          : Icon(_logoIcon(design.logoKind), color: design.logoColor, size: size * .52),
    );
  }
}

class _QrFramePainter extends CustomPainter {
  const _QrFramePainter(this.design);

  final QrDesign design;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final path = _framePath(rect.deflate(design.borderWidth / 2));
    canvas.drawPath(path, Paint()..color = design.frameBackground);
    if (design.frameStyle == QrFrameStyle.none) return;

    final borderPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = design.borderWidth
      ..strokeJoin = StrokeJoin.round;
    if (design.frameStyle == QrFrameStyle.rainbow) {
      borderPaint.shader = const SweepGradient(
        colors: [
          Color(0xFFEF4444),
          Color(0xFFF59E0B),
          Color(0xFF22C55E),
          Color(0xFF06B6D4),
          Color(0xFF6366F1),
          Color(0xFFD946EF),
          Color(0xFFEF4444),
        ],
      ).createShader(rect);
    } else {
      borderPaint.color = design.frameColor;
    }
    canvas.drawPath(path, borderPaint);

    if (design.frameStyle == QrFrameStyle.floral) {
      _paintFlowers(canvas, rect);
    }
  }

  Path _framePath(Rect rect) {
    if (design.frameShape != QrFrameShape.ticket) {
      final radius = design.frameShape == QrFrameShape.square ? 0.0 : design.cornerRadius;
      return Path()..addRRect(RRect.fromRectAndRadius(rect, Radius.circular(radius)));
    }
    final notchRadius = math.min(12.0, rect.height * .06);
    return Path()
      ..moveTo(rect.left + design.cornerRadius, rect.top)
      ..lineTo(rect.right - design.cornerRadius, rect.top)
      ..quadraticBezierTo(rect.right, rect.top, rect.right, rect.top + design.cornerRadius)
      ..lineTo(rect.right, rect.center.dy - notchRadius)
      ..arcToPoint(
        Offset(rect.right, rect.center.dy + notchRadius),
        radius: Radius.circular(notchRadius),
        clockwise: false,
      )
      ..lineTo(rect.right, rect.bottom - design.cornerRadius)
      ..quadraticBezierTo(rect.right, rect.bottom, rect.right - design.cornerRadius, rect.bottom)
      ..lineTo(rect.left + design.cornerRadius, rect.bottom)
      ..quadraticBezierTo(rect.left, rect.bottom, rect.left, rect.bottom - design.cornerRadius)
      ..lineTo(rect.left, rect.center.dy + notchRadius)
      ..arcToPoint(
        Offset(rect.left, rect.center.dy - notchRadius),
        radius: Radius.circular(notchRadius),
        clockwise: false,
      )
      ..lineTo(rect.left, rect.top + design.cornerRadius)
      ..quadraticBezierTo(rect.left, rect.top, rect.left + design.cornerRadius, rect.top)
      ..close();
  }

  void _paintFlowers(Canvas canvas, Rect rect) {
    final centers = [
      Offset(rect.left + 16, rect.top + 16),
      Offset(rect.right - 16, rect.top + 16),
      Offset(rect.left + 16, rect.bottom - 16),
      Offset(rect.right - 16, rect.bottom - 16),
      Offset(rect.center.dx, rect.top + 8),
      Offset(rect.center.dx, rect.bottom - 8),
    ];
    final petal = Paint()..color = design.frameColor.withValues(alpha: .92);
    final centerPaint = Paint()..color = design.frameSecondaryColor;
    for (final center in centers) {
      for (var index = 0; index < 5; index++) {
        final angle = -math.pi / 2 + index * math.pi * 2 / 5;
        canvas.drawCircle(center + Offset(math.cos(angle) * 6, math.sin(angle) * 6), 4.2, petal);
      }
      canvas.drawCircle(center, 3.2, centerPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _QrFramePainter oldDelegate) => oldDelegate.design != design;
}

IconData _logoIcon(QrLogoKind kind) => switch (kind) {
  QrLogoKind.shield => Icons.shield_rounded,
  QrLogoKind.link => Icons.link_rounded,
  QrLogoKind.wifi => Icons.wifi_rounded,
  QrLogoKind.heart => Icons.favorite_rounded,
  QrLogoKind.business => Icons.business_rounded,
  _ => Icons.qr_code_2_rounded,
};

Color _readableColor(Color background) =>
    ThemeData.estimateBrightnessForColor(background) == Brightness.dark ? Colors.white : const Color(0xFF102019);
