import 'package:get/get.dart';

import '../../features/qr/application/qr_scanner_controller.dart';
import '../../features/qr/data/api_qr_scanner_repository.dart';
import '../../features/qr/domain/qr_scanner_repository.dart';
import '../../features/pulse/application/pulse_controller.dart';
import '../network/api_client.dart';

class QrScannerBinding extends Bindings {
  @override
  void dependencies() {
    Get.lazyPut<QrScannerRepository>(() => ApiQrScannerRepository(ApiClient.instance));
    Get.lazyPut(
      () =>
          QrScannerController(repository: Get.find<QrScannerRepository>(), pulseRecorder: Get.find<PulseController>()),
    );
  }
}
