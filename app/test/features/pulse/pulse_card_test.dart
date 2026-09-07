import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get/get.dart';
import 'package:snapkit/core/styles/app_dimensions.dart';
import 'package:snapkit/core/theme/snapkit_theme.dart';
import 'package:snapkit/features/pulse/application/pulse_controller.dart';
import 'package:snapkit/features/pulse/domain/pulse_progress.dart';
import 'package:snapkit/features/pulse/domain/pulse_repository.dart';
import 'package:snapkit/features/pulse/presentation/widgets/pulse_card.dart';

void main() {
  setUp(() => Get.testMode = true);
  tearDown(Get.reset);

  testWidgets('Pulse card stays readable on small, landscape, tablet and dark large-text layouts', (tester) async {
    final scenarios = <({Size size, ThemeMode mode, double textScale, bool reducedMotion})>[
      (size: const Size(375, 812), mode: ThemeMode.light, textScale: 1, reducedMotion: false),
      (size: const Size(375, 812), mode: ThemeMode.dark, textScale: 1.5, reducedMotion: true),
      (size: const Size(812, 375), mode: ThemeMode.dark, textScale: 1, reducedMotion: true),
      (size: const Size(768, 1024), mode: ThemeMode.dark, textScale: 1.5, reducedMotion: true),
    ];

    for (final scenario in scenarios) {
      await _setViewport(tester, scenario.size);
      Get.reset();
      Get.put(
        PulseController(
          repository: _StaticPulseRepository(
            PulseSnapshot(
              progress: PulseProgress(
                weekStartedAt: DateTime(2026, 8, 31),
                cleanedItems: 3,
                cleanedBytes: 8 * 1024 * 1024,
                focusedItems: 1,
              ),
              streakWeeks: 2,
            ),
          ),
          clock: () => DateTime(2026, 9, 4),
        ),
      );

      await tester.pumpWidget(
        ScreenUtilInit(
          designSize: AppDimensions.designSize,
          minTextAdapt: true,
          splitScreenMode: true,
          fontSizeResolver: AppDimensions.resolveFontSize,
          builder: (context, _) => GetMaterialApp(
            theme: SnapkitTheme.light(),
            darkTheme: SnapkitTheme.dark(),
            themeMode: scenario.mode,
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(
                context,
              ).copyWith(textScaler: TextScaler.linear(scenario.textScale), disableAnimations: scenario.reducedMotion),
              child: child ?? const SizedBox.shrink(),
            ),
            home: Scaffold(
              body: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: PulseCard(onOpenCleaner: () {}, onOpenQr: () {}),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Nhịp tuần'), findsOneWidget);
      expect(find.text('Dọn 5 media'), findsOneWidget);
      expect(find.text('Một việc với QR'), findsOneWidget);
      expect(tester.takeException(), isNull);
    }

    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });
}

class _StaticPulseRepository implements PulseRepository {
  _StaticPulseRepository(this.value);

  PulseSnapshot value;

  @override
  Future<PulseSnapshot?> read() async => value;

  @override
  Future<void> write(PulseSnapshot snapshot) async => value = snapshot;

  @override
  Future<bool> isInterstitialRewardActive(DateTime now) async => false;
}

Future<void> _setViewport(WidgetTester tester, Size size) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = size;
}
