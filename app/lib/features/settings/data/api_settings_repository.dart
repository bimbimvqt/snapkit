import '../../../core/network/api_client.dart';
import '../domain/settings_repository.dart';

class ApiSettingsRepository implements SettingsRepository {
  const ApiSettingsRepository(this._apiClient);

  final ApiClient _apiClient;

  @override
  Future<void> trackPaywallViewed({String? planId}) => _apiClient.event('paywall_view', {'planId': ?planId});
}
