import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:snapkit/features/cleaner/application/cleaner_controller.dart';
import 'package:snapkit/features/cleaner/domain/cleaner_failure.dart';
import 'package:snapkit/features/cleaner/domain/cleaner_repository.dart';
import 'package:snapkit/features/cleaner/domain/media_scan_result.dart';

const _scanResult = MediaScanResult(scanned: 12, groups: [], duration: Duration(milliseconds: 80));

void main() {
  test('scan transitions to success and tracks safe metadata', () async {
    final repository = _FakeCleanerRepository();
    final controller = CleanerController(repository: repository, isFeatureEnabled: () => true);

    await controller.scan();

    expect(controller.status, CleanerStatus.success);
    expect(controller.result, _scanResult);
    expect(controller.errorMessage, isNull);
    expect(repository.trackScanCalls, 1);
  });

  test('scan exposes a friendly error and supports retry', () async {
    final repository = _FakeCleanerRepository(scanFailure: const CleanerPermissionFailure());
    final controller = CleanerController(repository: repository, isFeatureEnabled: () => true);

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
    final controller = CleanerController(repository: repository, isFeatureEnabled: () => true);

    final first = controller.scan();
    final second = controller.scan();
    expect(repository.scanCalls, 1);

    completer.complete(_scanResult);
    await Future.wait([first, second]);
    expect(controller.status, CleanerStatus.success);
  });

  test('delete resets the submitting state on success and failure', () async {
    final repository = _FakeCleanerRepository();
    final controller = CleanerController(repository: repository, isFeatureEnabled: () => true);
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
}

class _FakeCleanerRepository implements CleanerRepository {
  _FakeCleanerRepository({this.scanFailure, this.scanCompleter});

  CleanerFailure? scanFailure;
  CleanerFailure? deleteFailure;
  final Completer<MediaScanResult>? scanCompleter;
  int scanCalls = 0;
  int trackScanCalls = 0;

  @override
  Future<MediaScanResult> scan() async {
    scanCalls += 1;
    final failure = scanFailure;
    if (failure != null) throw failure;
    return scanCompleter?.future ?? _scanResult;
  }

  @override
  Future<CleanerDeleteReport> deleteSelected(MediaScanResult result, Set<String> selectedIds) async {
    final failure = deleteFailure;
    if (failure != null) throw failure;
    return CleanerDeleteReport(removedCount: selectedIds.length, bytesFreed: 1024);
  }

  @override
  Future<void> reportCleanup(MediaScanResult result, CleanerDeleteReport report) async {}

  @override
  Future<void> showCompletionAd() async {}

  @override
  Future<void> trackScan(MediaScanResult result) async {
    trackScanCalls += 1;
  }
}
