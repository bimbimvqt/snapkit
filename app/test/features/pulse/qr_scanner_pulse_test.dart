import 'package:flutter_test/flutter_test.dart';
import 'package:snapkit/features/pulse/domain/pulse_repository.dart';
import 'package:snapkit/features/qr/application/qr_scanner_controller.dart';
import 'package:snapkit/features/qr/domain/qr_scanner_repository.dart';

void main() {
  test('a local scan records Pulse even when remote analytics fails', () async {
    final pulse = _RecordingPulseActivity();
    final controller = QrScannerController(repository: _FailingScannerRepository(), pulseRecorder: pulse);

    await controller.trackScanned('qrCode');

    expect(pulse.qrActions, 1);
  });
}

class _FailingScannerRepository implements QrScannerRepository {
  @override
  Future<void> trackScanned(String format) => Future<void>.error(Exception('offline'));
}

class _RecordingPulseActivity implements PulseActivityRecorder {
  int qrActions = 0;

  @override
  Future<void> recordCleanup({required int removedCount, required int bytesFreed, required int focusedCount}) async {}

  @override
  Future<void> recordQrAction() async => qrActions += 1;
}
