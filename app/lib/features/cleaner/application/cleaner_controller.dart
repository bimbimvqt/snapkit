import 'package:get/get.dart';

import '../domain/cleaner_failure.dart';
import '../domain/cleaner_repository.dart';
import '../domain/cleaner_scan_settings.dart';
import '../domain/media_scan_result.dart';

enum CleanerStatus { initial, loading, success, error }

enum CleanerDeleteResult { deleted, empty, failed }

class CleanerController extends GetxController {
  CleanerController({
    required CleanerRepository repository,
    required bool Function() isFeatureEnabled,
    required CleanerScanSettings Function() scanSettings,
  }) : _repository = repository,
       _isFeatureEnabled = isFeatureEnabled,
       _scanSettings = scanSettings;

  final CleanerRepository _repository;
  final bool Function() _isFeatureEnabled;
  final CleanerScanSettings Function() _scanSettings;

  CleanerStatus status = CleanerStatus.initial;
  MediaScanResult? result;
  String? errorMessage;
  bool isRefreshing = false;
  bool isDeleting = false;
  bool isSyncing = false;
  bool? syncSucceeded;
  int scannedItems = 0;
  int totalItems = 0;
  int lastDeletedCount = 0;
  final selectedIds = <String>{};

  bool get hasSelection => selectedIds.isNotEmpty;
  bool get isLoading => status == CleanerStatus.loading;
  double get scanProgress => totalItems == 0 ? 0 : scannedItems / totalItems;

  Future<void> scan() async {
    if (isLoading || isRefreshing) return;
    if (!_isFeatureEnabled()) {
      errorMessage = 'Tính năng đang tạm bảo trì. Vui lòng thử lại sau.';
      status = result == null ? CleanerStatus.error : CleanerStatus.success;
      update();
      return;
    }

    errorMessage = null;
    syncSucceeded = null;
    scannedItems = 0;
    totalItems = 0;
    if (result == null) {
      status = CleanerStatus.loading;
    } else {
      isRefreshing = true;
    }
    update();

    try {
      final settings = _scanSettings();
      final scanResult = await _repository.scan(
        settings,
        onProgress: (progress) {
          scannedItems = progress.completed;
          totalItems = progress.total;
          if (progress.completed == 1 || progress.completed == progress.total || progress.completed % 5 == 0) {
            update();
          }
        },
      );
      result = scanResult;
      selectedIds
        ..clear()
        ..addAll(
          scanResult.groups
              .where((group) => group.type == MediaGroupType.similar)
              .expand((group) => group.assets.skip(1))
              .map((asset) => asset.id),
        );
      status = CleanerStatus.success;
      isSyncing = settings.adminSyncEnabled;
      update();
      await _repository.trackScan(scanResult);
      if (settings.adminSyncEnabled) {
        syncSucceeded = await _repository.syncScan(scanResult, settings);
      }
    } on CleanerFailure catch (failure) {
      errorMessage = failure.message;
      status = result == null ? CleanerStatus.error : CleanerStatus.success;
    } catch (_) {
      errorMessage = const CleanerUnexpectedFailure().message;
      status = result == null ? CleanerStatus.error : CleanerStatus.success;
    } finally {
      isRefreshing = false;
      isSyncing = false;
      update();
    }
  }

  void toggleSelection(String id, {required bool selected}) {
    selected ? selectedIds.add(id) : selectedIds.remove(id);
    update();
  }

  Future<CleanerDeleteResult> deleteSelected() async {
    final currentResult = result;
    if (currentResult == null || selectedIds.isEmpty || isDeleting) return CleanerDeleteResult.empty;
    isDeleting = true;
    errorMessage = null;
    update();
    try {
      final report = await _repository.deleteSelected(currentResult, Set<String>.from(selectedIds));
      lastDeletedCount = report.removedCount;
      await _repository.reportCleanup(currentResult, report);
      await _repository.showCompletionAd();
      selectedIds.clear();
      return CleanerDeleteResult.deleted;
    } on CleanerFailure catch (failure) {
      errorMessage = failure.message;
      return CleanerDeleteResult.failed;
    } catch (_) {
      errorMessage = const CleanerUnexpectedFailure().message;
      return CleanerDeleteResult.failed;
    } finally {
      isDeleting = false;
      update();
    }
  }
}
