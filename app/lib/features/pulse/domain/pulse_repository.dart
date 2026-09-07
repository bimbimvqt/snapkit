import 'pulse_progress.dart';

abstract interface class PulseRepository {
  Future<PulseSnapshot?> read();

  Future<void> write(PulseSnapshot snapshot);

  Future<bool> isInterstitialRewardActive(DateTime now);
}

abstract interface class PulseActivityRecorder {
  Future<void> recordCleanup({required int removedCount, required int bytesFreed, required int focusedCount});

  Future<void> recordQrAction();
}
