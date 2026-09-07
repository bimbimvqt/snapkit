import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:snapkit/core/styles/app_dimensions.dart';
import 'package:snapkit/features/settings/domain/pro_subscription_config.dart';
import 'package:snapkit/features/settings/presentation/widgets/pro_pricing_section.dart';

Widget _app({ThemeMode themeMode = ThemeMode.light, double textScale = 1}) => ScreenUtilInit(
  designSize: AppDimensions.designSize,
  minTextAdapt: true,
  builder: (context, child) => MaterialApp(
    theme: ThemeData.light(),
    darkTheme: ThemeData.dark(),
    themeMode: themeMode,
    home: MediaQuery(
      data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(textScale), disableAnimations: true),
      child: Scaffold(
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: ProPricingSection(config: defaultProSubscriptionConfig, onPlanSelected: (_) {}),
        ),
      ),
    ),
  ),
);

void main() {
  testWidgets('pricing section fits a 375px phone', (tester) async {
    tester.view.physicalSize = const Size(375, 812);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();
    expect(find.text('Nâng cấp Snapkit Pro'), findsOneWidget);
    expect(find.textContaining('Thanh toán chưa khả dụng'), findsOneWidget);
    expect(find.text('Xem thông tin gói'), findsNWidgets(2));
    expect(tester.takeException(), isNull);
  });

  testWidgets('pricing section remains usable in landscape', (tester) async {
    tester.view.physicalSize = const Size(812, 375);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();
    expect(find.text('Dự kiến dùng thử 7 ngày'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('pricing section supports dark mode, large text and reduced motion', (tester) async {
    tester.view.physicalSize = const Size(375, 812);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(_app(themeMode: ThemeMode.dark, textScale: 1.5));
    await tester.pumpAndSettle();
    expect(find.text('Pro hàng tháng'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('pricing section lays out both plans on a tablet', (tester) async {
    tester.view.physicalSize = const Size(1024, 1366);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();
    expect(find.text('Pro hàng tháng'), findsOneWidget);
    expect(find.text('Pro hàng năm'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
