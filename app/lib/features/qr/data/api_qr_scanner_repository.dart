import '../../../core/network/api_client.dart';
import '../domain/qr_scanner_repository.dart';

class ApiQrScannerRepository implements QrScannerRepository {
  const ApiQrScannerRepository(this._apiClient);

  final ApiClient _apiClient;

  @override
  Future<void> trackScanned(String format) => _apiClient.event('qr_scanned', {'format': format});
}
