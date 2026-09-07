import 'dart:async';

import 'package:get/get.dart';

import '../domain/auth_failure.dart';
import '../domain/auth_repository.dart';
import '../domain/auth_user.dart';

enum AuthStatus { checking, unauthenticated, authenticated }

enum AuthOperation { none, signingIn, signingOut }

class AuthController extends GetxController {
  AuthController(this._repository, {void Function()? onSessionChanged}) : _onSessionChanged = onSessionChanged;

  final AuthRepository _repository;
  final void Function()? _onSessionChanged;
  final _status = AuthStatus.checking.obs;
  final _operation = AuthOperation.none.obs;
  final _user = Rxn<AuthUser>();
  final _errorMessage = RxnString();
  bool _initialized = false;
  bool _refreshing = false;
  int _sessionVersion = 0;

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
    final version = _sessionVersion;
    try {
      final restored = await _repository.restoreSession();
      if (isClosed || version != _sessionVersion) return;
      _updateUser(restored);
      _status.value = user == null ? AuthStatus.unauthenticated : AuthStatus.authenticated;
    } on AuthFailure catch (failure) {
      if (isClosed || version != _sessionVersion) return;
      _errorMessage.value = failure.message;
      _status.value = AuthStatus.unauthenticated;
    } catch (_) {
      if (isClosed || version != _sessionVersion) return;
      _errorMessage.value = const AuthUnexpectedFailure().message;
      _status.value = AuthStatus.unauthenticated;
    }
  }

  Future<void> signInWithGoogle() async {
    if (operation != AuthOperation.none) return;
    final version = ++_sessionVersion;
    _operation.value = AuthOperation.signingIn;
    _errorMessage.value = null;
    try {
      final signedIn = await _repository.signInWithGoogle();
      if (isClosed || version != _sessionVersion) return;
      _updateUser(signedIn);
      _status.value = AuthStatus.authenticated;
    } on AuthCanceledFailure {
      // Canceling account selection leaves the user on the login screen without an error banner.
    } on AuthFailure catch (failure) {
      if (isClosed || version != _sessionVersion) return;
      _errorMessage.value = failure.message;
    } catch (_) {
      if (isClosed || version != _sessionVersion) return;
      _errorMessage.value = const AuthUnexpectedFailure().message;
    } finally {
      if (!isClosed) _operation.value = AuthOperation.none;
    }
  }

  Future<void> signOut() async {
    if (operation != AuthOperation.none) return;
    _sessionVersion += 1;
    _operation.value = AuthOperation.signingOut;
    _updateUser(null);
    try {
      await _repository.signOut();
    } catch (_) {
      // A failed revocation must not keep valid credentials on this device.
    } finally {
      if (!isClosed) {
        _updateUser(null);
        _errorMessage.value = null;
        _status.value = AuthStatus.unauthenticated;
        _operation.value = AuthOperation.none;
      }
    }
  }

  Future<void> refreshSession() async {
    if (isClosed || _refreshing || status != AuthStatus.authenticated || operation != AuthOperation.none) return;
    final version = _sessionVersion;
    _refreshing = true;
    try {
      final refreshedUser = await _repository.restoreSession();
      if (isClosed || version != _sessionVersion) return;
      _updateUser(refreshedUser);
      _status.value = refreshedUser == null ? AuthStatus.unauthenticated : AuthStatus.authenticated;
    } catch (_) {
      // Keep the usable authenticated session when a background refresh fails.
    } finally {
      _refreshing = false;
    }
  }

  void _updateUser(AuthUser? nextUser) {
    final changedAccount = user?.id != nextUser?.id;
    _user.value = nextUser;
    if (changedAccount) _onSessionChanged?.call();
  }

  void clearError() {
    if (errorMessage == null) return;
    _errorMessage.value = null;
  }
}
