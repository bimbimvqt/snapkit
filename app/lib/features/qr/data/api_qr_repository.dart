import '../../../core/network/api_client.dart';
import '../domain/qr_repository.dart';

class ApiQrRepository implements QrRepository {
  const ApiQrRepository(this._apiClient);

  final ApiClient _apiClient;

  @override
  Future<bool> save({required String kind, required String content, required Map<String, Object> style}) =>
      _apiClient.saveQr(kind: kind, content: content, style: style);

  @override
  Future<void> trackCreated({required String kind, required String frameStyle, required String icon}) =>
      _apiClient.event('qr_created', {'kind': kind, 'frameStyle': frameStyle, 'icon': icon});
}
