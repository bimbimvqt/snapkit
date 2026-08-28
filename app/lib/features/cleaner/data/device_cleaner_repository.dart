import '../../../core/ads/ad_service.dart';
import '../../../core/network/api_client.dart';
import '../domain/cleaner_failure.dart';
import '../domain/cleaner_repository.dart';
import '../domain/media_scan_result.dart';
import 'media_scanner.dart';

class DeviceCleanerRepository implements CleanerRepository {
  DeviceCleanerRepository({MediaScanner? scanner, ApiClient? apiClient})
    : _scanner = scanner ?? MediaScanner(),
      _apiClient = apiClient ?? ApiClient.instance;

  final MediaScanner _scanner;
  final ApiClient _apiClient;

  @override
  Future<MediaScanResult> scan() async {
    try {
      return await _scanner.scan();
    } on MediaPermissionException {
      throw const CleanerPermissionFailure();
    } catch (_) {
      throw const CleanerUnexpectedFailure();
    }
  }

  @override
  Future<CleanerDeleteReport> deleteSelected(MediaScanResult result, Set<String> selectedIds) async {
    try {
      final assets = result.groups.expand((group) => group.assets).where((asset) => selectedIds.contains(asset.id));
      var bytesFreed = 0;
      for (final asset in assets) {
        bytesFreed += await (await asset.file)?.length() ?? 0;
      }
      final deletedIds = await _scanner.delete(selectedIds.toList(growable: false));
      return CleanerDeleteReport(removedCount: deletedIds.length, bytesFreed: bytesFreed);
    } catch (_) {
      throw const CleanerUnexpectedFailure();
    }
  }

  @override
  Future<void> trackScan(MediaScanResult result) =>
      _apiClient.event('media_scan', {'scanned': result.scanned, 'groups': result.groups.length});

  @override
  Future<void> reportCleanup(MediaScanResult result, CleanerDeleteReport report) => _apiClient.reportCleanup(
    scanned: result.scanned,
    removed: report.removedCount,
    bytesFreed: report.bytesFreed,
    durationMs: result.duration.inMilliseconds,
  );

  @override
  Future<void> showCompletionAd() => AdService.showAfterCleanup();
}
