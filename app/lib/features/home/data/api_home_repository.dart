import '../../../core/network/api_client.dart';
import '../domain/home_repository.dart';

class ApiHomeRepository implements HomeRepository {
  ApiHomeRepository(this._apiClient);

  final ApiClient _apiClient;

  @override
  Future<void> trackAppOpened() => _apiClient.event('app_open');
}
