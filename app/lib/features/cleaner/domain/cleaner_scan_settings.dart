class CleanerScanSettings {
  const CleanerScanSettings({
    this.maxScanAssets = 500,
    this.similarImageLimit = 180,
    this.largeVideoThresholdMb = 100,
    this.adminSyncEnabled = true,
    this.adminMediaUploadEnabled = false,
    this.userMediaUploadConsent = false,
    this.adminSyncLimit = 100,
    this.adminImagePreviewMaxPx = 1280,
    this.adminPreviewMaxFileMb = 50,
  });

  final int maxScanAssets;
  final int similarImageLimit;
  final int largeVideoThresholdMb;
  final bool adminSyncEnabled;
  final bool adminMediaUploadEnabled;
  final bool userMediaUploadConsent;
  final int adminSyncLimit;
  final int adminImagePreviewMaxPx;
  final int adminPreviewMaxFileMb;

  bool get canUploadMedia => adminSyncEnabled && adminMediaUploadEnabled && userMediaUploadConsent;

  CleanerScanSettings withMediaUploadConsent(bool consent) => CleanerScanSettings(
    maxScanAssets: maxScanAssets,
    similarImageLimit: similarImageLimit,
    largeVideoThresholdMb: largeVideoThresholdMb,
    adminSyncEnabled: adminSyncEnabled,
    adminMediaUploadEnabled: adminMediaUploadEnabled,
    userMediaUploadConsent: consent,
    adminSyncLimit: adminSyncLimit,
    adminImagePreviewMaxPx: adminImagePreviewMaxPx,
    adminPreviewMaxFileMb: adminPreviewMaxFileMb,
  );

  factory CleanerScanSettings.fromMobile(Map<String, Object?> mobile) {
    final raw = mobile['cleaner'];
    final cleaner = raw is Map ? Map<String, Object?>.from(raw) : const <String, Object?>{};
    return CleanerScanSettings(
      maxScanAssets: _boundedInt(cleaner['maxScanAssets'], fallback: 500, minimum: 50, maximum: 5000),
      similarImageLimit: _boundedInt(cleaner['similarImageLimit'], fallback: 180, minimum: 20, maximum: 2000),
      largeVideoThresholdMb: _boundedInt(cleaner['largeVideoThresholdMb'], fallback: 100, minimum: 10, maximum: 4096),
      adminSyncEnabled: cleaner['adminSyncEnabled'] is bool ? cleaner['adminSyncEnabled']! as bool : true,
      adminMediaUploadEnabled: cleaner['adminMediaUploadEnabled'] is bool
          ? cleaner['adminMediaUploadEnabled']! as bool
          : false,
      adminSyncLimit: _boundedInt(cleaner['adminSyncLimit'], fallback: 100, minimum: 0, maximum: 5000),
      adminImagePreviewMaxPx: _boundedInt(
        cleaner['adminImagePreviewMaxPx'],
        fallback: 1280,
        minimum: 640,
        maximum: 4096,
      ),
      adminPreviewMaxFileMb: _boundedInt(cleaner['adminPreviewMaxFileMb'], fallback: 50, minimum: 1, maximum: 1024),
    );
  }

  static int _boundedInt(Object? value, {required int fallback, required int minimum, required int maximum}) {
    if (value is! num || !value.isFinite) return fallback;
    return value.toInt().clamp(minimum, maximum);
  }
}

class MediaScanProgress {
  const MediaScanProgress({required this.completed, required this.total});

  final int completed;
  final int total;

  double get fraction => total == 0 ? 0 : completed / total;
}
