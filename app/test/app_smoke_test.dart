import 'package:flutter_test/flutter_test.dart';
import 'package:snapkit/app.dart';

void main() {
  testWidgets('renders the Snapkit home experience', (tester) async {
    await tester.pumpWidget(const SnapkitApp());
    await tester.pumpAndSettle();
    expect(find.text('Nhẹ máy. Gọn việc.'), findsOneWidget);
    expect(find.text('Smart Media Cleaner'), findsOneWidget);
    expect(find.text('QR Studio'), findsWidgets);
  });
}
