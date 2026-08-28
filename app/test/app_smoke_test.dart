import 'package:flutter_test/flutter_test.dart';
import 'package:get/get.dart';
import 'package:snapkit/app.dart';
import 'package:snapkit/features/auth/domain/auth_repository.dart';
import 'package:snapkit/features/auth/domain/auth_user.dart';

void main() {
  setUp(() {
    Get.testMode = true;
  });

  tearDown(Get.reset);

  testWidgets('renders the Snapkit home experience', (tester) async {
    await tester.pumpWidget(SnapkitApp(authRepository: _AuthenticatedRepository()));
    await tester.pumpAndSettle();
    expect(find.text('Nhẹ máy. Gọn việc.'), findsOneWidget);
    expect(find.text('Smart Media Cleaner'), findsOneWidget);
    expect(find.text('QR Studio'), findsWidgets);
  });

  testWidgets('requires Google login when there is no session', (tester) async {
    await tester.pumpWidget(SnapkitApp(authRepository: _SignedOutRepository()));
    await tester.pumpAndSettle();
    expect(find.text('Tiếp tục với Google'), findsOneWidget);
    expect(find.text('Công cụ gọn nhẹ.\nRiêng tư đúng nghĩa.'), findsOneWidget);
    expect(find.text('Smart Media Cleaner'), findsNothing);
  });
}

class _AuthenticatedRepository implements AuthRepository {
  @override
  Future<AuthUser?> restoreSession() async =>
      const AuthUser(id: 'user-test', email: 'user@snapkit.local', role: 'USER', name: 'Snapkit User');

  @override
  Future<AuthUser> signInWithGoogle() async =>
      const AuthUser(id: 'user-test', email: 'user@snapkit.local', role: 'USER', name: 'Snapkit User');

  @override
  Future<void> signOut() async {}
}

class _SignedOutRepository implements AuthRepository {
  @override
  Future<AuthUser?> restoreSession() async => null;

  @override
  Future<AuthUser> signInWithGoogle() => throw UnimplementedError();

  @override
  Future<void> signOut() async {}
}
