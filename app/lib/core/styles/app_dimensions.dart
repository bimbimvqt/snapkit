import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

abstract final class AppDimensions {
  static const designSize = Size(390, 844);
  static const maxContentWidth = 1080.0;
  static const tabletBreakpoint = 720.0;
  static const desktopBreakpoint = 900.0;

  static double get space4 => 4.r;
  static double get space8 => 8.r;
  static double get space12 => 12.r;
  static double get space16 => 16.r;
  static double get space20 => 20.r;
  static double get space24 => 24.r;
  static double get space28 => 28.r;
  static double get space32 => 32.r;
  static double get space40 => 40.r;
  static double get space48 => 48.r;

  static double get radius12 => 12.r;
  static double get radius16 => 16.r;
  static double get radius20 => 20.r;
  static double get radius24 => 24.r;
  static double get radius28 => 28.r;

  static double pageHorizontal(double width) => width >= desktopBreakpoint ? 32.w : 20.w;
  static const minTouchTarget = 48.0;
  static double get iconSmall => math.max(18, 18.sp);
  static double get iconMedium => math.max(22, 22.sp);
  static double get iconLarge => math.max(28, 28.sp);

  static double resolveFontSize(num fontSize, ScreenUtil screenUtil) {
    final adaptiveScale = math.min(screenUtil.scaleWidth, screenUtil.scaleHeight);
    return fontSize * math.max(1, adaptiveScale);
  }
}
