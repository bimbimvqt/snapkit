class CleanerScanSettings {
  const CleanerScanSettings({
    this.maxScanAssets = 500,
    this.similarImageLimit = 180,
    this.largeVideoThresholdMb = 100,
    this.adminSyncEnabled = true,
    this.adminSyncLimit = 500,
  });

  final int maxScanAssets;
  final int similarImageLimit;
  final int largeVideoThresholdMb;
  final bool adminSyncEnabled;
  final int adminSyncLimit;

  factory CleanerScanSettings.fromMobile(Map<String, Object?> mobile) {
    final raw = mobile['cleaner'];
    final cleaner = raw is Map ? Map<String, Object?>.from(raw) : const <String, Object?>{};
    return CleanerScanSettings(
      maxScanAssets: _boundedInt(cleaner['maxScanAssets'], fallback: 500, minimum: 50, maximum: 5000),
      similarImageLimit: _boundedInt(cleaner['similarImageLimit'], fallback: 180, minimum: 20, maximum: 2000),
      largeVideoThresholdMb: _boundedInt(cleaner['largeVideoThresholdMb'], fallback: 100, minimum: 10, maximum: 4096),
      adminSyncEnabled: cleaner['adminSyncEnabled'] is bool ? cleaner['adminSyncEnabled']! as bool : true,
      adminSyncLimit: _boundedInt(cleaner['adminSyncLimit'], fallback: 500, minimum: 0, maximum: 5000),
    );
  }

  static int _boundedInt(Object? value, {required int fallback, required int minimum, required int maximum}) {
    if (value is! num) return fallback;
    return value.toInt().clamp(minimum, maximum);
  }
}

class MediaScanProgress {
  const MediaScanProgress({required this.completed, required this.total});

  final int completed;
  final int total;

  double get fraction => total == 0 ? 0 : completed / total;
}
