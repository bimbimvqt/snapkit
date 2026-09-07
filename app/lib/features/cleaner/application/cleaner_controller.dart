import 'dart:async';

import 'package:get/get.dart';
import 'package:photo_manager/photo_manager.dart';

import '../../pulse/domain/pulse_repository.dart';
import '../domain/cleaner_failure.dart';
import '../domain/cleaner_repository.dart';
import '../domain/cleaner_scan_settings.dart';
import '../domain/media_scan_result.dart';

enum CleanerStatus { initial, loading, success, error }

enum CleanerDeleteResult { deleted, empty, failed }

class CleanerController extends GetxController {
  CleanerController({
    required CleanerRepository repository,
    required PulseActivityRecorder pulseRecorder,
    required bool Function() isFeatureEnabled,
    required CleanerScanSettings Function() scanSettings,
    bool Function()? isAIStudioEnabled,
  }) : _repository = repository,
       _pulseRecorder = pulseRecorder,
       _isFeatureEnabled = isFeatureEnabled,
       _scanSettings = scanSettings,
       _isAIStudioEnabled = isAIStudioEnabled ?? _featureDisabled;

  final CleanerRepository _repository;
  final PulseActivityRecorder _pulseRecorder;
  final bool Function() _isFeatureEnabled;
  final bool Function() _isAIStudioEnabled;
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
  DateTime? _lastProgressNotification;
  int _scanGeneration = 0;
  bool _disposed = false;

  bool get hasSelection => selectedIds.isNotEmpty;
  bool get canOpenAIStudio => _isAIStudioEnabled() && _selectedImageAssets().isNotEmpty;
  bool get isLoading => status == CleanerStatus.loading;
  double get scanProgress => totalItems == 0 ? 0 : scannedItems / totalItems;
  int get selectedBytes => result?.bytesFor(selectedIds) ?? 0;
  Set<String> get recommendedIds => {
    for (final group in result?.groups ?? const <MediaGroup>[])
      if (group.type == MediaGroupType.similar)
        for (final asset in group.assets.skip(1)) asset.id,
  };

  bool get mediaUploadIsAvailable {
    final settings = _scanSettings();
    return settings.adminSyncEnabled && settings.adminMediaUploadEnabled;
  }

  @override
  void onClose() {
    _disposed = true;
    _scanGeneration++;
    super.onClose();
  }

  void resetForSessionChange() {
    _scanGeneration++;
    result = null;
    selectedIds.clear();
    status = CleanerStatus.initial;
    errorMessage = null;
    isRefreshing = false;
    isSyncing = false;
    syncSucceeded = null;
    scannedItems = 0;
    totalItems = 0;
    lastDeletedCount = 0;
    if (!_disposed) update();
  }

  Future<void> scan({bool allowMediaUpload = false}) async {
    if (_disposed || isLoading || isRefreshing || isDeleting) return;
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
    _lastProgressNotification = null;
    final generation = ++_scanGeneration;
    if (result == null) {
      status = CleanerStatus.loading;
    } else {
      isRefreshing = true;
    }
    update();

    MediaScanResult? completedResult;
    CleanerScanSettings? completedSettings;
    try {
      final settings = _scanSettings().withMediaUploadConsent(allowMediaUpload);
      completedSettings = settings;
      final scanResult = await _repository.scan(
        settings,
        onProgress: (progress) {
          if (_disposed || generation != _scanGeneration) return;
          scannedItems = progress.completed;
          totalItems = progress.total;
          final now = DateTime.now();
          if (_lastProgressNotification == null ||
              progress.completed == progress.total ||
              now.difference(_lastProgressNotification!) >= const Duration(milliseconds: 100)) {
            _lastProgressNotification = now;
            update();
          }
        },
      );
      if (_disposed || generation != _scanGeneration) return;
      completedResult = scanResult;
      result = scanResult;
      selectedIds
        ..clear()
        ..addAll(_recommendedIdsFor(scanResult));
      status = CleanerStatus.success;
      isSyncing = settings.adminSyncEnabled;
    } on CleanerFailure catch (failure) {
      if (_disposed || generation != _scanGeneration) return;
      errorMessage = failure.message;
      status = result == null ? CleanerStatus.error : CleanerStatus.success;
    } catch (_) {
      if (_disposed || generation != _scanGeneration) return;
      errorMessage = const CleanerUnexpectedFailure().message;
      status = result == null ? CleanerStatus.error : CleanerStatus.success;
    } finally {
      if (!_disposed && generation == _scanGeneration) {
        isRefreshing = false;
        if (completedResult == null) isSyncing = false;
        update();
      }
    }
    if (completedResult != null && completedSettings != null) {
      unawaited(_completeScanInBackground(completedResult, completedSettings, generation));
    }
  }

  void toggleSelection(String id, {required bool selected}) {
    if (_disposed || isDeleting || isRefreshing) return;
    final changed = selected ? selectedIds.add(id) : selectedIds.remove(id);
    if (changed) update();
  }

  void setSelection(Iterable<String> ids, {required bool selected}) {
    if (_disposed || isDeleting || isRefreshing) return;
    var changed = false;
    for (final id in ids) {
      changed = (selected ? selectedIds.add(id) : selectedIds.remove(id)) || changed;
    }
    if (changed) update();
  }

  void selectRecommended() {
    setSelection(recommendedIds, selected: true);
  }

  Future<List<String>> selectedImagePathsForAIStudio() async {
    if (!canOpenAIStudio) return const [];
    final generation = _scanGeneration;
    final paths = <String>[];
    for (final asset in _selectedImageAssets().take(4)) {
      try {
        final file = await asset.file;
        if (_disposed || generation != _scanGeneration) return const [];
        if (file != null) paths.add(file.path);
      } catch (_) {
        // A missing local asset is skipped so the remaining selection stays usable.
      }
    }
    return paths;
  }

  Future<CleanerDeleteResult> deleteSelected() async {
    final currentResult = result;
    if (_disposed || currentResult == null || selectedIds.isEmpty || isDeleting || isLoading || isRefreshing) {
      return CleanerDeleteResult.empty;
    }
    isDeleting = true;
    final generation = _scanGeneration;
    errorMessage = null;
    lastDeletedCount = 0;
    update();
    try {
      final pendingIds = Set<String>.from(selectedIds);
      final report = await _repository.deleteSelected(currentResult, pendingIds);
      if (_disposed || generation != _scanGeneration) return CleanerDeleteResult.empty;
      lastDeletedCount = report.removedCount;
      if (report.removedCount == 0) return CleanerDeleteResult.empty;
      final remainingResult = currentResult.withoutAssets(report.removedIds);
      result = remainingResult;
      selectedIds.retainAll(remainingResult.groups.expand((group) => group.assets).map((asset) => asset.id));
      try {
        await _pulseRecorder.recordCleanup(
          removedCount: report.removedCount,
          bytesFreed: report.bytesFreed,
          focusedCount: _focusedIdsFor(currentResult).intersection(report.removedIds).length,
        );
      } catch (_) {
        // A local progress failure must not undo a successful system deletion.
      }
      if (_disposed || generation != _scanGeneration) return CleanerDeleteResult.deleted;
      try {
        await _repository.reportCleanup(currentResult, report);
      } catch (_) {
        // Cleanup telemetry is best effort after the files have been deleted.
      }
      if (!_disposed && generation == _scanGeneration) {
        try {
          await _repository.showCompletionAd();
        } catch (_) {
          // An unavailable ad must not report the deletion as failed.
        }
      }
      return CleanerDeleteResult.deleted;
    } on CleanerFailure catch (failure) {
      if (!_disposed && generation == _scanGeneration) errorMessage = failure.message;
      return CleanerDeleteResult.failed;
    } catch (_) {
      if (!_disposed && generation == _scanGeneration) errorMessage = const CleanerUnexpectedFailure().message;
      return CleanerDeleteResult.failed;
    } finally {
      isDeleting = false;
      if (!_disposed) update();
    }
  }

  Set<String> _recommendedIdsFor(MediaScanResult scanResult) => {
    for (final group in scanResult.groups)
      if (group.type == MediaGroupType.similar)
        for (final asset in group.assets.skip(1)) asset.id,
  };

  Set<String> _focusedIdsFor(MediaScanResult scanResult) => {
    for (final group in scanResult.groups)
      if (group.type == MediaGroupType.similar)
        for (final asset in group.assets.skip(1)) asset.id
      else if (group.type == MediaGroupType.screenshots)
        for (final asset in group.assets) asset.id,
  };

  List<AssetEntity> _selectedImageAssets() {
    final uniqueIds = <String>{};
    return [
      for (final group in result?.groups ?? const <MediaGroup>[])
        for (final asset in group.assets)
          if (asset.type == AssetType.image && selectedIds.contains(asset.id) && uniqueIds.add(asset.id)) asset,
    ];
  }

  Future<void> _completeScanInBackground(
    MediaScanResult scanResult,
    CleanerScanSettings settings,
    int generation,
  ) async {
    try {
      await _repository.trackScan(scanResult);
    } catch (_) {
      // Analytics is best effort and must not delay rendering scan results.
    }
    if (_disposed || generation != _scanGeneration || !settings.adminSyncEnabled) return;

    var succeeded = false;
    try {
      succeeded = await _repository.syncScan(
        scanResult,
        settings,
        isCancelled: () => _disposed || generation != _scanGeneration,
      );
    } catch (_) {
      succeeded = false;
    }
    if (_disposed || generation != _scanGeneration) return;
    syncSucceeded = succeeded;
    isSyncing = false;
    update();
  }
}

bool _featureDisabled() => false;
