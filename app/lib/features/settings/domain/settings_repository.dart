abstract interface class SettingsRepository {
  Future<void> trackPaywallViewed({String? planId});
}
