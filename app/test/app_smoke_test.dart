import 'package:flutter_test/flutter_test.dart';
import 'package:toolbox_one/app.dart';

void main() {
  testWidgets('renders the Toolbox home experience', (tester) async {
    await tester.pumpWidget(const ToolboxApp());
    await tester.pumpAndSettle();
    expect(find.text('Nhẹ máy. Gọn việc.'), findsOneWidget);
    expect(find.text('Smart Media Cleaner'), findsOneWidget);
    expect(find.text('QR Studio'), findsWidgets);
  });
}
