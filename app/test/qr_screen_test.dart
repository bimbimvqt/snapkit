import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:snapkit/core/theme/snapkit_theme.dart';
import 'package:snapkit/features/qr/presentation/qr_screen.dart';

void main() {
  testWidgets('QR editor remains usable on a 375px phone and renders the floral preset', (tester) async {
    await _setViewport(tester, const Size(375, 812));
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        theme: SnapkitTheme.light(),
        darkTheme: SnapkitTheme.dark(),
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(textScaler: const TextScaler.linear(1.5)),
          child: child ?? const SizedBox.shrink(),
        ),
        home: const QrScreen(),
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
      MaterialApp(theme: SnapkitTheme.light(), darkTheme: SnapkitTheme.dark(), home: const QrScreen()),
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
      MaterialApp(theme: SnapkitTheme.light(), darkTheme: SnapkitTheme.dark(), home: const QrScreen()),
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
