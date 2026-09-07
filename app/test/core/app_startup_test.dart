import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:snapkit/core/bootstrap/app_startup.dart';

void main() {
  testWidgets('startup failure shows a safe retry and opens app after success', (tester) async {
    var attempts = 0;
    await tester.pumpWidget(
      AppStartup(
        initialize: () async {
          attempts++;
          if (attempts == 1) throw StateError('private native failure details');
        },
        appBuilder: (_) => const MaterialApp(home: Text('Ready')),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Chưa thể mở Snapkit'), findsOneWidget);
    expect(find.textContaining('private native'), findsNothing);
    await tester.tap(find.text('Thử lại'));
    await tester.pumpAndSettle();
    expect(attempts, 2);
    expect(find.text('Ready'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
