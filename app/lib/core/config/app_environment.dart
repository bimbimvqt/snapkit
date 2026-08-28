enum AppFlavor { development, production }

abstract final class AppEnvironment {
  static const _name = String.fromEnvironment('APP_ENV', defaultValue: 'development');
  static const flavor = _name == 'production' ? AppFlavor.production : AppFlavor.development;
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: _name == 'production' ? 'https://snapkit.45-119-214-94.sslip.io' : 'http://localhost:3001',
  );
  static const isProduction = flavor == AppFlavor.production;
}
