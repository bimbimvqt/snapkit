import 'dart:async';

import 'package:get/get.dart';

import '../../../shared/application/app_shell_controller.dart';
import '../domain/home_repository.dart';

class HomeController extends GetxController {
  HomeController({
    required HomeRepository repository,
    required AppShellController shellController,
    required bool Function(String key) isFeatureEnabled,
  }) : _repository = repository,
       _shellController = shellController,
       _isFeatureEnabled = isFeatureEnabled;

  final HomeRepository _repository;
  final AppShellController _shellController;
  final bool Function(String key) _isFeatureEnabled;

  @override
  void onReady() {
    super.onReady();
    unawaited(_trackAppOpened());
  }

  Future<void> _trackAppOpened() async {
    try {
      await _repository.trackAppOpened();
    } catch (_) {
      // Home remains available when analytics is offline.
    }
  }

  bool openTool({required String featureKey, required AppTab tab}) {
    if (!_isFeatureEnabled(featureKey)) return false;
    _shellController.selectTab(tab);
    return true;
  }

  bool featureIsEnabled(String featureKey) => _isFeatureEnabled(featureKey);
}
