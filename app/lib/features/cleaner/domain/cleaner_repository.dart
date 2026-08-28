import 'cleaner_scan_settings.dart';
import 'media_scan_result.dart';

class CleanerDeleteReport {
  const CleanerDeleteReport({required this.removedCount, required this.bytesFreed});

  final int removedCount;
  final int bytesFreed;
}

abstract interface class CleanerRepository {
  Future<MediaScanResult> scan(CleanerScanSettings settings, {required void Function(MediaScanProgress) onProgress});
  Future<bool> syncScan(MediaScanResult result, CleanerScanSettings settings);
  Future<CleanerDeleteReport> deleteSelected(MediaScanResult result, Set<String> selectedIds);
  Future<void> trackScan(MediaScanResult result);
  Future<void> reportCleanup(MediaScanResult result, CleanerDeleteReport report);
  Future<void> showCompletionAd();
}
