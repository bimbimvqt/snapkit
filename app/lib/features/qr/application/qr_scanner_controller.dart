import 'package:get/get.dart';

import '../../pulse/domain/pulse_repository.dart';
import '../domain/qr_scanner_repository.dart';

class QrScannerController extends GetxController {
  QrScannerController({required QrScannerRepository repository, required PulseActivityRecorder pulseRecorder})
    : _repository = repository,
      _pulseRecorder = pulseRecorder;

  final QrScannerRepository _repository;
  final PulseActivityRecorder _pulseRecorder;
  bool _isHandling = false;

  bool beginScan() {
    if (_isHandling) return false;
    _isHandling = true;
    return true;
  }

  Future<void> trackScanned(String format) async {
    try {
      await _pulseRecorder.recordQrAction();
    } catch (_) {
      // A local progress failure must not prevent showing the decoded content.
    }
    try {
      await _repository.trackScanned(format);
    } catch (_) {
      // Scanning succeeds locally even when analytics is unavailable.
    }
  }

  void finishScan() {
    _isHandling = false;
  }
}
