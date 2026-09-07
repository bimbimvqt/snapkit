import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:snapkit/core/styles/app_dimensions.dart';
import 'package:snapkit/core/theme/snapkit_theme.dart';
import 'package:snapkit/features/auth/presentation/splash_screen.dart';

void main() {
  testWidgets('renders the themed Snapkit brand and finishes once after the animation', (tester) async {
    var finishedCount = 0;
    await tester.pumpWidget(_app(onFinished: () => finishedCount++));

    expect(find.text('Snapkit'), findsOneWidget);
    expect(find.text('Smart Tech For Modern Needs'), findsOneWidget);
    expect(finishedCount, 0);

    await tester.pump();
    await tester.pump(const Duration(milliseconds: 899));
    expect(finishedCount, 0);
    await tester.pumpAndSettle();
    expect(finishedCount, 1);
    await tester.pump(const Duration(seconds: 1));
    expect(finishedCount, 1);
    expect(tester.takeException(), isNull);
  });

  testWidgets('splash screen supports reduced motion and finishes', (tester) async {
    var finishedCount = 0;
    await tester.pumpWidget(_app(disableAnimations: true, onFinished: () => finishedCount++));

    expect(find.text('Snapkit'), findsOneWidget);
    expect(find.text('Smart Tech For Modern Needs'), findsOneWidget);
    expect(finishedCount, 1);
    await tester.pump();
    expect(finishedCount, 1);
    expect(tester.takeException(), isNull);
  });

  testWidgets('does not finish after the splash has been disposed', (tester) async {
    var finishedCount = 0;
    await tester.pumpWidget(_app(onFinished: () => finishedCount++));
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(seconds: 2));

    expect(finishedCount, 0);
    expect(tester.takeException(), isNull);
  });

  testWidgets('remains usable in landscape with large text and dark mode', (tester) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(568, 320);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(_app(themeMode: ThemeMode.dark, textScale: 1.6));
    await tester.pump(const Duration(milliseconds: 600));

    expect(find.text('Snapkit'), findsOneWidget);
    expect(find.text('Smart Tech For Modern Needs'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

Widget _app({
  VoidCallback? onFinished,
  bool disableAnimations = false,
  ThemeMode themeMode = ThemeMode.light,
  double textScale = 1,
}) => ScreenUtilInit(
  designSize: AppDimensions.designSize,
  minTextAdapt: true,
  splitScreenMode: true,
  fontSizeResolver: AppDimensions.resolveFontSize,
  builder: (context, _) => MediaQuery(
    data: MediaQuery.of(
      context,
    ).copyWith(disableAnimations: disableAnimations, textScaler: TextScaler.linear(textScale)),
    child: MaterialApp(
      theme: SnapkitTheme.light(),
      darkTheme: SnapkitTheme.dark(),
      themeMode: themeMode,
      home: SplashScreen(onFinished: onFinished),
    ),
  ),
);
