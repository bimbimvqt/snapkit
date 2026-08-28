import 'dart:async';

import 'package:get/get.dart';

import '../domain/auth_failure.dart';
import '../domain/auth_repository.dart';
import '../domain/auth_user.dart';

enum AuthStatus { checking, unauthenticated, authenticated }

enum AuthOperation { none, signingIn, signingOut }

class AuthController extends GetxController {
  AuthController(this._repository);

  final AuthRepository _repository;
  final _status = AuthStatus.checking.obs;
  final _operation = AuthOperation.none.obs;
  final _user = Rxn<AuthUser>();
  final _errorMessage = RxnString();
  bool _initialized = false;

  AuthStatus get status => _status.value;
  AuthOperation get operation => _operation.value;
  AuthUser? get user => _user.value;
  String? get errorMessage => _errorMessage.value;
  bool get isSigningIn => operation == AuthOperation.signingIn;
  bool get isSigningOut => operation == AuthOperation.signingOut;

  @override
  void onInit() {
    super.onInit();
    unawaited(initialize());
  }

  Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;
    try {
      _user.value = await _repository.restoreSession();
      _status.value = user == null ? AuthStatus.unauthenticated : AuthStatus.authenticated;
    } on AuthFailure catch (failure) {
      _errorMessage.value = failure.message;
      _status.value = AuthStatus.unauthenticated;
    } catch (_) {
      _errorMessage.value = const AuthUnexpectedFailure().message;
      _status.value = AuthStatus.unauthenticated;
    }
  }

  Future<void> signInWithGoogle() async {
    if (operation != AuthOperation.none) return;
    _operation.value = AuthOperation.signingIn;
    _errorMessage.value = null;
    try {
      _user.value = await _repository.signInWithGoogle();
      _status.value = AuthStatus.authenticated;
    } on AuthCanceledFailure {
      // Canceling account selection leaves the user on the login screen without an error banner.
    } on AuthFailure catch (failure) {
      _errorMessage.value = failure.message;
    } catch (_) {
      _errorMessage.value = const AuthUnexpectedFailure().message;
    } finally {
      _operation.value = AuthOperation.none;
    }
  }

  Future<void> signOut() async {
    if (operation != AuthOperation.none) return;
    _operation.value = AuthOperation.signingOut;
    try {
      await _repository.signOut();
    } catch (_) {
      // A failed revocation must not keep valid credentials on this device.
    } finally {
      _user.value = null;
      _errorMessage.value = null;
      _status.value = AuthStatus.unauthenticated;
      _operation.value = AuthOperation.none;
    }
  }

  void clearError() {
    if (errorMessage == null) return;
    _errorMessage.value = null;
  }
}
