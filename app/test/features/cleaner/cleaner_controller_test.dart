import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:photo_manager/photo_manager.dart';
import 'package:snapkit/features/cleaner/application/cleaner_controller.dart';
import 'package:snapkit/features/cleaner/domain/cleaner_failure.dart';
import 'package:snapkit/features/cleaner/domain/cleaner_repository.dart';
import 'package:snapkit/features/cleaner/domain/cleaner_scan_settings.dart';
import 'package:snapkit/features/cleaner/domain/media_scan_result.dart';
import 'package:snapkit/features/pulse/domain/pulse_repository.dart';

import '../../support/noop_pulse_activity_recorder.dart';

const _scanResult = MediaScanResult(scanned: 12, groups: [], duration: Duration(milliseconds: 80));

void main() {
  test('scan transitions to success and tracks safe metadata', () async {
    final repository = _FakeCleanerRepository();
    final controller = _controller(repository);

    await controller.scan();

    expect(controller.status, CleanerStatus.success);
    expect(controller.result, _scanResult);
    expect(controller.errorMessage, isNull);
    expect(controller.scannedItems, 12);
    expect(controller.totalItems, 12);
    expect(controller.isSyncing, isTrue);

    await Future<void>.delayed(Duration.zero);

    expect(repository.trackScanCalls, 1);
    expect(repository.syncScanCalls, 1);
    expect(controller.syncSucceeded, isTrue);
    expect(controller.isSyncing, isFalse);
  });

  test('scan exposes a friendly error and supports retry', () async {
    final repository = _FakeCleanerRepository(scanFailure: const CleanerPermissionFailure());
    final controller = _controller(repository);

    await controller.scan();
    expect(controller.status, CleanerStatus.error);
    expect(controller.errorMessage, contains('quyền truy cập'));

    repository.scanFailure = null;
    await controller.scan();
    expect(controller.status, CleanerStatus.success);
    expect(controller.errorMessage, isNull);
  });

  test('scan ignores duplicate submissions while a request is in progress', () async {
    final completer = Completer<MediaScanResult>();
    final repository = _FakeCleanerRepository(scanCompleter: completer);
    final controller = _controller(repository);

    final first = controller.scan();
    final second = controller.scan();
    expect(repository.scanCalls, 1);

    completer.complete(_scanResult);
    await Future.wait([first, second]);
    expect(controller.status, CleanerStatus.success);
  });

  test('delete resets the submitting state on success and failure', () async {
    final repository = _FakeCleanerRepository();
    final controller = _controller(repository);
    await controller.scan();
    controller.selectedIds.add('asset-1');

    final success = await controller.deleteSelected();
    expect(success, CleanerDeleteResult.deleted);
    expect(controller.lastDeletedCount, 1);
    expect(controller.isDeleting, isFalse);
    expect(controller.selectedIds, isEmpty);

    controller.selectedIds.add('asset-2');
    repository.deleteFailure = const CleanerUnexpectedFailure();
    final failure = await controller.deleteSelected();
    expect(failure, CleanerDeleteResult.failed);
    expect(controller.errorMessage, isNotEmpty);
    expect(controller.isDeleting, isFalse);
    expect(controller.selectedIds, contains('asset-2'));
  });

  test('successful deletion records removed and focused media in Pulse', () async {
    final keeper = _asset('keeper');
    final duplicate = _asset('duplicate');
    final repository = _FakeCleanerRepository(
      scanResult: MediaScanResult(
        scanned: 2,
        groups: [
          MediaGroup(type: MediaGroupType.similar, title: 'Nhóm tương tự', assets: [keeper, duplicate], bytes: 1024),
        ],
        duration: const Duration(milliseconds: 80),
      ),
    );
    final pulse = _RecordingPulseActivity();
    final controller = _controller(repository, pulseRecorder: pulse);

    await controller.scan();
    await controller.deleteSelected();

    expect(pulse.cleanedItems, 1);
    expect(pulse.cleanedBytes, 1024);
    expect(pulse.focusedItems, 1);
  });

  test('canceled deletion preserves selection and does not show an ad', () async {
    final repository = _FakeCleanerRepository()..deletedIds = {};
    final controller = _controller(repository)..result = _scanResult;
    controller.selectedIds.add('asset-1');

    expect(await controller.deleteSelected(), CleanerDeleteResult.empty);
    expect(controller.selectedIds, {'asset-1'});
    expect(controller.lastDeletedCount, 0);
    expect(repository.completionAdCalls, 0);
  });

  test('partial deletion updates the library and preserves undeleted selection despite telemetry errors', () async {
    final first = _asset('first');
    final second = _asset('second');
    final repository = _FakeCleanerRepository()
      ..deletedIds = {'first'}
      ..failSideEffects = true;
    final controller = _controller(repository)
      ..result = MediaScanResult(
        scanned: 2,
        groups: [
          MediaGroup(type: MediaGroupType.screenshots, title: 'Ảnh', assets: [first, second], bytes: 30),
        ],
        assets: [
          ScannedMediaAsset(asset: first, bytes: 10, categories: {MediaAssetCategory.screenshot}),
          ScannedMediaAsset(asset: second, bytes: 20, categories: {MediaAssetCategory.screenshot}),
        ],
        duration: Duration.zero,
      )
      ..selectedIds.addAll({'first', 'second'});

    expect(await controller.deleteSelected(), CleanerDeleteResult.deleted);
    expect(controller.lastDeletedCount, 1);
    expect(controller.selectedIds, {'second'});
    expect(controller.result?.groups.single.assets.map((asset) => asset.id), ['second']);
    expect(controller.result?.reclaimable, 20);
    expect(controller.errorMessage, isNull);
  });

  test('a survivor hidden after a similarity group disappears is no longer selected', () async {
    final keeper = _asset('keeper');
    final duplicate = _asset('duplicate');
    final repository = _FakeCleanerRepository()..deletedIds = {'duplicate'};
    final controller = _controller(repository)
      ..result = MediaScanResult(
        scanned: 2,
        groups: [
          MediaGroup(type: MediaGroupType.similar, title: 'Ảnh', assets: [keeper, duplicate], bytes: 20),
        ],
        duration: Duration.zero,
      )
      ..selectedIds.addAll({'keeper', 'duplicate'});

    expect(await controller.deleteSelected(), CleanerDeleteResult.deleted);
    expect(controller.result?.groups, isEmpty);
    expect(controller.selectedIds, isEmpty);
  });

  test('scan and selection cannot race with an in-progress deletion', () async {
    final completer = Completer<CleanerDeleteReport>();
    final repository = _FakeCleanerRepository()..deleteCompleter = completer;
    final controller = _controller(repository)..result = _scanResult;
    controller.selectedIds.add('first');

    final pending = controller.deleteSelected();
    await controller.scan();
    controller.toggleSelection('second', selected: true);
    expect(repository.scanCalls, 0);
    expect(controller.selectedIds, {'first'});
    completer.complete(const CleanerDeleteReport(removedIds: {'first'}, bytesFreed: 10));
    await pending;
  });

  test('scan completion after disposal cannot publish results or start synchronization', () async {
    final completer = Completer<MediaScanResult>();
    final repository = _FakeCleanerRepository(scanCompleter: completer);
    final controller = _controller(repository);
    final pending = controller.scan();
    controller.onClose();
    completer.complete(_scanResult);
    await pending;
    expect(controller.result, isNull);
    expect(repository.syncScanCalls, 0);
  });

  test('session reset discards old scans without clearing a new session loading state', () async {
    final oldScan = Completer<MediaScanResult>();
    final newScan = Completer<MediaScanResult>();
    final repository = _FakeCleanerRepository(scanCompleter: oldScan);
    final controller = _controller(repository);
    final oldPending = controller.scan();
    controller.resetForSessionChange();
    repository.scanCompleter = newScan;
    final newPending = controller.scan();
    oldScan.complete(_scanResult);
    await oldPending;
    expect(controller.result, isNull);
    expect(controller.isLoading, isTrue);
    newScan.complete(_scanResult);
    await newPending;
    expect(controller.result, _scanResult);
    await Future<void>.delayed(Duration.zero);
    expect(repository.syncCancellation?.call(), isFalse);
    controller.resetForSessionChange();
    expect(repository.syncCancellation?.call(), isTrue);
    expect(controller.result, isNull);
  });

  test('session reset during deletion keeps native operation locked and ignores its eventual result', () async {
    final completer = Completer<CleanerDeleteReport>();
    final repository = _FakeCleanerRepository()..deleteCompleter = completer;
    final pulse = _RecordingPulseActivity();
    final controller = _controller(repository, pulseRecorder: pulse)
      ..result = _scanResult
      ..selectedIds.add('first');
    final pending = controller.deleteSelected();
    controller.resetForSessionChange();
    expect(controller.result, isNull);
    expect(controller.selectedIds, isEmpty);
    expect(controller.isDeleting, isTrue);
    completer.complete(const CleanerDeleteReport(removedIds: {'first'}, bytesFreed: 100));
    expect(await pending, CleanerDeleteResult.empty);
    expect(controller.isDeleting, isFalse);
    expect(controller.lastDeletedCount, 0);
    expect(pulse.cleanedItems, 0);
    expect(repository.completionAdCalls, 0);
  });

  test('media synchronization requires consent again for each scan', () async {
    final repository = _FakeCleanerRepository();
    final controller = CleanerController(
      repository: repository,
      pulseRecorder: const NoopPulseActivityRecorder(),
      isFeatureEnabled: () => true,
      scanSettings: () => const CleanerScanSettings(adminMediaUploadEnabled: true),
    );
    await controller.scan();
    await Future<void>.delayed(Duration.zero);
    expect(repository.syncedSettings?.canUploadMedia, isFalse);
    await controller.scan(allowMediaUpload: true);
    await Future<void>.delayed(Duration.zero);
    expect(repository.syncedSettings?.canUploadMedia, isTrue);
    await controller.scan();
    await Future<void>.delayed(Duration.zero);
    expect(repository.syncedSettings?.canUploadMedia, isFalse);
  });

  test('AI Studio entry is available only for selected images and an enabled feature flag', () async {
    final image = _asset('image');
    final repository = _FakeCleanerRepository(
      scanResult: MediaScanResult(
        scanned: 1,
        groups: [
          MediaGroup(type: MediaGroupType.screenshots, title: 'Ảnh', assets: [image], bytes: 100),
        ],
        duration: const Duration(milliseconds: 80),
      ),
    );
    final controller = _controller(repository, aiStudioEnabled: true);

    await controller.scan();
    expect(controller.canOpenAIStudio, isFalse);
    controller.selectedIds.add(image.id);
    expect(controller.canOpenAIStudio, isTrue);

    final disabledController = _controller(repository, aiStudioEnabled: false)
      ..result = controller.result
      ..selectedIds.add(image.id);
    expect(disabledController.canOpenAIStudio, isFalse);
  });
}

CleanerController _controller(
  CleanerRepository repository, {
  PulseActivityRecorder pulseRecorder = const NoopPulseActivityRecorder(),
  bool aiStudioEnabled = false,
}) => CleanerController(
  repository: repository,
  pulseRecorder: pulseRecorder,
  isFeatureEnabled: () => true,
  isAIStudioEnabled: () => aiStudioEnabled,
  scanSettings: () => const CleanerScanSettings(),
);

class _FakeCleanerRepository implements CleanerRepository {
  _FakeCleanerRepository({this.scanFailure, this.scanCompleter, this.scanResult = _scanResult});

  CleanerFailure? scanFailure;
  CleanerFailure? deleteFailure;
  Completer<MediaScanResult>? scanCompleter;
  final MediaScanResult scanResult;
  Completer<CleanerDeleteReport>? deleteCompleter;
  Set<String>? deletedIds;
  bool failSideEffects = false;
  int completionAdCalls = 0;
  CleanerScanSettings? syncedSettings;
  bool Function()? syncCancellation;
  int scanCalls = 0;
  int trackScanCalls = 0;
  int syncScanCalls = 0;

  @override
  Future<MediaScanResult> scan(
    CleanerScanSettings settings, {
    required void Function(MediaScanProgress) onProgress,
  }) async {
    scanCalls += 1;
    final failure = scanFailure;
    if (failure != null) throw failure;
    onProgress(const MediaScanProgress(completed: 12, total: 12));
    return scanCompleter?.future ?? scanResult;
  }

  @override
  Future<bool> syncScan(MediaScanResult result, CleanerScanSettings settings, {bool Function()? isCancelled}) async {
    syncScanCalls += 1;
    syncedSettings = settings;
    syncCancellation = isCancelled;
    return true;
  }

  @override
  Future<CleanerDeleteReport> deleteSelected(MediaScanResult result, Set<String> selectedIds) async {
    final failure = deleteFailure;
    if (failure != null) throw failure;
    return deleteCompleter?.future ?? CleanerDeleteReport(removedIds: deletedIds ?? selectedIds, bytesFreed: 1024);
  }

  @override
  Future<void> reportCleanup(MediaScanResult result, CleanerDeleteReport report) async {
    if (failSideEffects) throw StateError("offline");
  }

  @override
  Future<void> showCompletionAd() async {
    completionAdCalls++;
    if (failSideEffects) throw StateError("ad unavailable");
  }

  @override
  Future<void> trackScan(MediaScanResult result) async {
    trackScanCalls += 1;
  }
}

class _RecordingPulseActivity implements PulseActivityRecorder {
  int cleanedItems = 0;
  int cleanedBytes = 0;
  int focusedItems = 0;

  @override
  Future<void> recordCleanup({required int removedCount, required int bytesFreed, required int focusedCount}) async {
    cleanedItems += removedCount;
    cleanedBytes += bytesFreed;
    focusedItems += focusedCount;
  }

  @override
  Future<void> recordQrAction() async {}
}

AssetEntity _asset(String id) => AssetEntity(id: id, typeInt: AssetType.image.index, width: 100, height: 100);
