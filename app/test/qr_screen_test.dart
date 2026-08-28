import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get/get.dart';
import 'package:snapkit/core/styles/app_dimensions.dart';
import 'package:snapkit/core/theme/snapkit_theme.dart';
import 'package:snapkit/features/qr/application/qr_editor_controller.dart';
import 'package:snapkit/features/qr/data/device_qr_logo_picker.dart';
import 'package:snapkit/features/qr/domain/qr_gallery_saver.dart';
import 'package:snapkit/features/qr/domain/qr_repository.dart';
import 'package:snapkit/features/qr/presentation/qr_screen.dart';

void main() {
  setUp(() {
    Get.testMode = true;
    Get.put(
      QrEditorController(
        repository: _FakeQrRepository(),
        logoPicker: _FakeQrLogoPicker(),
        gallerySaver: _FakeQrGallerySaver(),
        isFeatureEnabled: () => true,
      ),
    );
  });

  tearDown(Get.reset);

  testWidgets('QR editor remains usable on a 375px phone and renders the floral preset', (tester) async {
    await _setViewport(tester, const Size(375, 812));
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ScreenUtilInit(
        designSize: AppDimensions.designSize,
        minTextAdapt: true,
        splitScreenMode: true,
        fontSizeResolver: AppDimensions.resolveFontSize,
        builder: (context, _) => GetMaterialApp(
          theme: SnapkitTheme.light(),
          darkTheme: SnapkitTheme.dark(),
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context).copyWith(textScaler: const TextScaler.linear(1.5)),
            child: child ?? const SizedBox.shrink(),
          ),
          home: const QrScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('QR Studio'), findsOneWidget);
    final mainScrollable = find.byWidgetPredicate(
      (widget) => widget is Scrollable && widget.axisDirection == AxisDirection.down,
    );
    await tester.scrollUntilVisible(find.text('Chọn phong cách nhanh'), 300, scrollable: mainScrollable);
    await tester.ensureVisible(find.byType(ListView));
    await tester.pumpAndSettle();
    await tester.drag(find.byType(ListView), const Offset(-180, 0));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Vườn hoa'));
    await tester.enterText(find.byType(TextFormField).first, 'https://snapkit.local');
    await tester.pumpAndSettle();

    expect(find.textContaining('sẵn sàng quét'), findsOneWidget);
    expect(find.text('MỞ BẰNG CAMERA'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Tùy chỉnh chi tiết'), 300, scrollable: mainScrollable);
    await tester.pumpAndSettle();

    expect(find.text('Preview luôn hiển thị'), findsOneWidget);
    expect(tester.getTopLeft(find.text('Preview luôn hiển thị')).dy, lessThan(240));
    expect(find.text('Lưu ảnh'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('QR editor has no layout exception in phone landscape', (tester) async {
    await _setViewport(tester, const Size(812, 375));
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ScreenUtilInit(
        designSize: AppDimensions.designSize,
        minTextAdapt: true,
        splitScreenMode: true,
        fontSizeResolver: AppDimensions.resolveFontSize,
        builder: (context, _) =>
            GetMaterialApp(theme: SnapkitTheme.light(), darkTheme: SnapkitTheme.dark(), home: const QrScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Chọn phong cách nhanh'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('color controls open a full custom picker and accept an exact HEX value', (tester) async {
    await _setViewport(tester, const Size(375, 812));
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ScreenUtilInit(
        designSize: AppDimensions.designSize,
        minTextAdapt: true,
        splitScreenMode: true,
        fontSizeResolver: AppDimensions.resolveFontSize,
        builder: (context, _) =>
            GetMaterialApp(theme: SnapkitTheme.light(), darkTheme: SnapkitTheme.dark(), home: const QrScreen()),
      ),
    );
    await tester.pumpAndSettle();

    final mainScrollable = find.byWidgetPredicate(
      (widget) => widget is Scrollable && widget.axisDirection == AxisDirection.down,
    );
    await tester.scrollUntilVisible(find.text('Màu QR'), 400, scrollable: mainScrollable);
    await tester.ensureVisible(find.text('Màu QR'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Màu QR'));
    await tester.pumpAndSettle();

    expect(find.text('Sắc độ'), findsOneWidget);
    expect(find.text('Độ rực'), findsOneWidget);
    expect(find.text('Độ sáng'), findsOneWidget);
    expect(find.text('Mã HEX'), findsOneWidget);
    await tester.enterText(find.byType(TextField), '#123456');
    await tester.pump();
    await tester.tap(find.text('Áp dụng'));
    await tester.pumpAndSettle();

    expect(find.text('#123456', skipOffstage: false), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

Future<void> _setViewport(WidgetTester tester, Size size) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = size;
}

class _FakeQrRepository implements QrRepository {
  @override
  Future<bool> save({required String kind, required String content, required Map<String, Object> style}) async => true;

  @override
  Future<void> trackCreated({required String kind, required String frameStyle, required String icon}) async {}
}

class _FakeQrLogoPicker implements QrLogoPicker {
  @override
  Future<PickedQrLogo?> pick() async => null;
}

class _FakeQrGallerySaver implements QrGallerySaver {
  @override
  Future<void> savePng(Uint8List bytes) async {}
}
