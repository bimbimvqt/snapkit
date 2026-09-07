import 'package:snapkit/features/pulse/domain/pulse_repository.dart';

class NoopPulseActivityRecorder implements PulseActivityRecorder {
  const NoopPulseActivityRecorder();

  @override
  Future<void> recordCleanup({required int removedCount, required int bytesFreed, required int focusedCount}) async {}

  @override
  Future<void> recordQrAction() async {}
}
