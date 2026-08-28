import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get/get.dart';
import 'package:snapkit/core/styles/app_dimensions.dart';
import 'package:snapkit/core/theme/snapkit_theme.dart';
import 'package:snapkit/features/cleaner/application/cleaner_controller.dart';
import 'package:snapkit/features/cleaner/domain/cleaner_repository.dart';
import 'package:snapkit/features/cleaner/domain/cleaner_scan_settings.dart';
import 'package:snapkit/features/cleaner/domain/media_scan_result.dart';
import 'package:snapkit/features/cleaner/presentation/cleaner_screen.dart';

void main() {
  setUp(() => Get.testMode = true);
  tearDown(Get.reset);

  testWidgets('scan loading shows real count and stays usable on a small phone', (tester) async {
    await _setViewport(tester, const Size(375, 812));
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final repository = _PendingCleanerRepository();
    Get.put(
      CleanerController(
        repository: repository,
        isFeatureEnabled: () => true,
        scanSettings: () => const CleanerScanSettings(maxScanAssets: 100),
      ),
    );

    await tester.pumpWidget(_app());
    await tester.tap(find.text('Quét thư viện'));
    await tester.pump();

    expect(find.text('Đang phân tích thư viện'), findsOneWidget);
    expect(find.text('Đã quét 25 / 100 mục'), findsOneWidget);
    expect(find.text('25%'), findsOneWidget);
    expect(tester.takeException(), isNull);

    repository.complete();
    await tester.pumpAndSettle();
  });

  testWidgets('cleaner initial state has no layout exception in phone landscape', (tester) async {
    await _setViewport(tester, const Size(812, 375));
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    Get.put(
      CleanerController(
        repository: _PendingCleanerRepository(),
        isFeatureEnabled: () => true,
        scanSettings: () => const CleanerScanSettings(),
      ),
    );

    await tester.pumpWidget(_app());

    expect(find.text('Dọn bộ nhớ thông minh'), findsOneWidget);
    expect(find.text('Quét thư viện'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

Widget _app() => ScreenUtilInit(
  designSize: AppDimensions.designSize,
  minTextAdapt: true,
  splitScreenMode: true,
  fontSizeResolver: AppDimensions.resolveFontSize,
  builder: (context, _) =>
      GetMaterialApp(theme: SnapkitTheme.light(), darkTheme: SnapkitTheme.dark(), home: const CleanerScreen()),
);

Future<void> _setViewport(WidgetTester tester, Size size) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = size;
}

class _PendingCleanerRepository implements CleanerRepository {
  final _completer = Completer<MediaScanResult>();

  void complete() {
    if (_completer.isCompleted) return;
    _completer.complete(const MediaScanResult(scanned: 100, groups: [], duration: Duration(seconds: 1)));
  }

  @override
  Future<MediaScanResult> scan(CleanerScanSettings settings, {required void Function(MediaScanProgress) onProgress}) {
    onProgress(const MediaScanProgress(completed: 25, total: 100));
    return _completer.future;
  }

  @override
  Future<bool> syncScan(MediaScanResult result, CleanerScanSettings settings) async => true;

  @override
  Future<void> trackScan(MediaScanResult result) async {}

  @override
  Future<CleanerDeleteReport> deleteSelected(MediaScanResult result, Set<String> selectedIds) async =>
      const CleanerDeleteReport(removedCount: 0, bytesFreed: 0);

  @override
  Future<void> reportCleanup(MediaScanResult result, CleanerDeleteReport report) async {}

  @override
  Future<void> showCompletionAd() async {}
}
