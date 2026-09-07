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

import '../../support/noop_pulse_activity_recorder.dart';
import 'package:photo_manager/photo_manager.dart';

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
        pulseRecorder: const NoopPulseActivityRecorder(),
        isFeatureEnabled: () => true,
        scanSettings: () => const CleanerScanSettings(maxScanAssets: 100),
      ),
    );

    await tester.pumpWidget(_app());
    await tester.tap(find.text('Quét thư viện'));
    await tester.pump();

    expect(find.text('Đang phân tích thư viện'), findsOneWidget);
    expect(find.text('Đã quét 25 / 100 mục'), findsOneWidget);
    expect(find.ancestor(of: find.text('Đã quét 25 / 100 mục'), matching: find.byType(AnimatedSwitcher)), findsNothing);
    expect(find.text('25%'), findsOneWidget);
    expect(tester.takeException(), isNull);

    repository.complete();
    await tester.pumpAndSettle();
  });

  testWidgets('media upload requires a per-scan choice and local scanning remains available', (tester) async {
    await _setViewport(tester, const Size(375, 812));
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final repository = _PendingCleanerRepository();
    Get.put(
      CleanerController(
        repository: repository,
        pulseRecorder: const NoopPulseActivityRecorder(),
        isFeatureEnabled: () => true,
        scanSettings: () => const CleanerScanSettings(adminMediaUploadEnabled: true),
      ),
    );

    await tester.pumpWidget(_app());
    await tester.tap(find.text('Quét thư viện'));
    await tester.pumpAndSettle();
    expect(find.text('Chọn cách quét thư viện'), findsOneWidget);
    expect(repository.receivedSettings, isNull);
    await tester.tap(find.text('Quét trên máy'));
    await tester.pump();
    expect(repository.receivedSettings?.canUploadMedia, isFalse);
    repository.complete();
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });

  testWidgets('cleaner initial state has no layout exception in phone landscape', (tester) async {
    await _setViewport(tester, const Size(812, 375));
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    Get.put(
      CleanerController(
        repository: _PendingCleanerRepository(),
        pulseRecorder: const NoopPulseActivityRecorder(),
        isFeatureEnabled: () => true,
        scanSettings: () => const CleanerScanSettings(),
      ),
    );

    await tester.pumpWidget(_app());

    expect(find.text('Dọn bộ nhớ thông minh'), findsOneWidget);
    expect(find.text('Quét thư viện'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('result renders the smart summary once per unique group and unique selected bytes', (tester) async {
    await _setViewport(tester, const Size(390, 844));
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final controller = _controller();
    final keeperOne = _asset('keeper-1');
    final duplicateOne = _asset('duplicate-1');
    final keeperTwo = _asset('keeper-2');
    final duplicateTwo = _asset('duplicate-2');
    controller
      ..status = CleanerStatus.success
      ..result = MediaScanResult(
        scanned: 4,
        duration: const Duration(milliseconds: 850),
        groups: [
          MediaGroup(
            type: MediaGroupType.similar,
            title: '04/09/2026 · 09:30 · Nhóm 1',
            assets: [keeperOne, duplicateOne],
            bytes: 2 * 1024 * 1024,
          ),
          MediaGroup(
            type: MediaGroupType.similar,
            title: 'Bản sao không được hiển thị',
            assets: [duplicateOne, keeperOne],
            bytes: 2 * 1024 * 1024,
          ),
          MediaGroup(
            type: MediaGroupType.similar,
            title: '04/09/2026 · 10:05 · Nhóm 2',
            assets: [keeperTwo, duplicateTwo],
            bytes: 3 * 1024 * 1024,
          ),
        ],
        assets: [
          _scanned(keeperOne, 1024 * 1024),
          _scanned(duplicateOne, 2 * 1024 * 1024),
          _scanned(keeperTwo, 1024 * 1024),
          _scanned(duplicateTwo, 3 * 1024 * 1024),
        ],
      );
    controller.selectedIds.addAll({duplicateOne.id, duplicateTwo.id});
    Get.put(controller);

    await tester.pumpWidget(_app());
    await tester.pump();

    expect(find.text('Tổng quan dung lượng'), findsOneWidget);
    expect(find.text('Danh mục media'), findsOneWidget);
    expect(find.text('Dọn 2 mục (5 MB)'), findsOneWidget);
    final allColor = tester.widget<Icon>(find.byIcon(Icons.dashboard_customize_rounded)).color;
    final similarColor = tester.widget<Icon>(find.byIcon(Icons.filter_none_rounded).first).color;
    final screenshotColor = tester.widget<Icon>(find.byIcon(Icons.screenshot_rounded)).color;
    await tester.scrollUntilVisible(find.byIcon(Icons.movie_filter_outlined), 180, scrollable: _horizontalScrollable());
    final categoryIconColors = <Color?>{
      allColor,
      similarColor,
      screenshotColor,
      tester.widget<Icon>(find.byIcon(Icons.movie_filter_outlined)).color,
    };
    expect(categoryIconColors, hasLength(4));
    await tester.scrollUntilVisible(find.text('04/09/2026 · 09:30 · Nhóm 1'), 300, scrollable: _verticalScrollable());
    expect(find.text('04/09/2026 · 09:30 · Nhóm 1'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('04/09/2026 · 10:05 · Nhóm 2'), 300, scrollable: _verticalScrollable());
    expect(find.text('04/09/2026 · 10:05 · Nhóm 2'), findsOneWidget);
    expect(find.text('Bản sao không được hiển thị'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('result remains usable with large text on a small phone', (tester) async {
    await _setViewport(tester, const Size(375, 812));
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final controller = _controller()
      ..status = CleanerStatus.success
      ..result = const MediaScanResult(scanned: 12, groups: [], duration: Duration(seconds: 1));
    Get.put(controller);

    await tester.pumpWidget(_app(textScale: 1.6));
    await tester.pump();

    expect(find.text('Tổng quan dung lượng'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Không có mục nào trong danh mục này.'),
      300,
      scrollable: _verticalScrollable(),
    );
    expect(find.text('Không có mục nào trong danh mục này.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

Widget _app({double textScale = 1}) => ScreenUtilInit(
  designSize: AppDimensions.designSize,
  minTextAdapt: true,
  splitScreenMode: true,
  fontSizeResolver: AppDimensions.resolveFontSize,
  builder: (context, _) => MediaQuery(
    data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(textScale)),
    child: GetMaterialApp(theme: SnapkitTheme.light(), darkTheme: SnapkitTheme.dark(), home: const CleanerScreen()),
  ),
);

Future<void> _setViewport(WidgetTester tester, Size size) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = size;
}

Finder _verticalScrollable() =>
    find.byWidgetPredicate((widget) => widget is Scrollable && widget.axisDirection == AxisDirection.down);

Finder _horizontalScrollable() =>
    find.byWidgetPredicate((widget) => widget is Scrollable && widget.axisDirection == AxisDirection.right);

class _PendingCleanerRepository implements CleanerRepository {
  final _completer = Completer<MediaScanResult>();
  CleanerScanSettings? receivedSettings;

  void complete() {
    if (_completer.isCompleted) return;
    _completer.complete(const MediaScanResult(scanned: 100, groups: [], duration: Duration(seconds: 1)));
  }

  @override
  Future<MediaScanResult> scan(CleanerScanSettings settings, {required void Function(MediaScanProgress) onProgress}) {
    receivedSettings = settings;
    onProgress(const MediaScanProgress(completed: 25, total: 100));
    return _completer.future;
  }

  @override
  Future<bool> syncScan(MediaScanResult result, CleanerScanSettings settings, {bool Function()? isCancelled}) async =>
      true;

  @override
  Future<void> trackScan(MediaScanResult result) async {}

  @override
  Future<CleanerDeleteReport> deleteSelected(MediaScanResult result, Set<String> selectedIds) async =>
      const CleanerDeleteReport(removedIds: {}, bytesFreed: 0);

  @override
  Future<void> reportCleanup(MediaScanResult result, CleanerDeleteReport report) async {}

  @override
  Future<void> showCompletionAd() async {}
}

CleanerController _controller() => CleanerController(
  repository: _PendingCleanerRepository(),
  pulseRecorder: const NoopPulseActivityRecorder(),
  isFeatureEnabled: () => true,
  scanSettings: () => const CleanerScanSettings(),
);

AssetEntity _asset(String id) => AssetEntity(id: id, typeInt: AssetType.image.index, width: 1200, height: 1200);

ScannedMediaAsset _scanned(AssetEntity asset, int bytes) =>
    ScannedMediaAsset(asset: asset, bytes: bytes, categories: const {MediaAssetCategory.similar});
