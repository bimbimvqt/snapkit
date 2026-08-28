import 'package:get/get.dart';

import '../domain/qr_scanner_repository.dart';

class QrScannerController extends GetxController {
  QrScannerController(this._repository);

  final QrScannerRepository _repository;
  bool _isHandling = false;

  bool beginScan() {
    if (_isHandling) return false;
    _isHandling = true;
    return true;
  }

  Future<void> trackScanned(String format) => _repository.trackScanned(format);

  void finishScan() {
    _isHandling = false;
  }
}
