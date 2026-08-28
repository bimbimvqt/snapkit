import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

abstract final class AppTextStyles {
  static TextStyle get display =>
      TextStyle(fontSize: 34.sp, height: 1.06, fontWeight: FontWeight.w900, letterSpacing: -1.4);
  static TextStyle get pageTitle => TextStyle(fontSize: 28.sp, fontWeight: FontWeight.w800, letterSpacing: -1);
  static TextStyle get heroTitle => TextStyle(fontSize: 23.sp, fontWeight: FontWeight.w800, letterSpacing: -.6);
  static TextStyle get titleLarge => TextStyle(fontSize: 22.sp, fontWeight: FontWeight.w900);
  static TextStyle get titleMedium => TextStyle(fontSize: 18.sp, fontWeight: FontWeight.w800);
  static TextStyle get sectionTitle => TextStyle(fontSize: 16.sp, fontWeight: FontWeight.w800);
  static TextStyle get body => TextStyle(fontSize: 14.sp, height: 1.5);
  static TextStyle get bodyStrong => TextStyle(fontSize: 14.sp, height: 1.4, fontWeight: FontWeight.w700);
  static TextStyle get label => TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w800);
  static TextStyle get caption => TextStyle(fontSize: 12.sp, height: 1.35);
  static TextStyle get navigation => TextStyle(fontSize: 10.5.sp, height: 1, fontWeight: FontWeight.w600);
  static TextStyle get button => TextStyle(fontSize: 16.sp, fontWeight: FontWeight.w700);
}
