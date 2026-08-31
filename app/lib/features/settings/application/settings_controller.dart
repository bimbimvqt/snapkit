import 'dart:async';

import 'package:get/get.dart';

import '../../auth/application/auth_controller.dart';
import '../../auth/domain/auth_user.dart';
import '../domain/settings_repository.dart';

class SettingsController extends GetxController {
  SettingsController({required SettingsRepository repository, required AuthController authController})
    : _repository = repository,
      _authController = authController;

  final SettingsRepository _repository;
  final AuthController _authController;

  AuthUser? get user => _authController.user;
  bool get isSigningOut => _authController.isSigningOut;

  void openPaywall({String? planId}) {
    unawaited(_repository.trackPaywallViewed(planId: planId));
  }

  Future<void> signOut() => _authController.signOut();
}
