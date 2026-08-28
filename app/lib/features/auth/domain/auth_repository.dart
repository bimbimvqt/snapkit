import 'auth_user.dart';

abstract interface class AuthRepository {
  Future<AuthUser?> restoreSession();
  Future<AuthUser> signInWithGoogle();
  Future<void> signOut();
}
