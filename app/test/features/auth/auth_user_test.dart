import 'package:flutter_test/flutter_test.dart';
import 'package:snapkit/features/auth/domain/auth_user.dart';

void main() {
  test('parses the server-side Pro entitlement', () {
    final user = AuthUser.fromJson({
      'id': 'user-pro',
      'email': 'pro@example.com',
      'role': 'USER',
      'isPro': true,
      'planId': 'yearly',
    });

    expect(user.isPro, isTrue);
    expect(user.planId, 'yearly');
  });

  test('treats old or malformed entitlement responses as Free', () {
    final user = AuthUser.fromJson({
      'id': 'user-free',
      'email': 'free@example.com',
      'role': 'USER',
      'isPro': 'true',
      'planId': 123,
    });

    expect(user.isPro, isFalse);
    expect(user.planId, 'free');
  });
}
