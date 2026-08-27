# Toolbox One App

Flutter iOS/Android app cho Media Cleaner và QR Studio. Media được xử lý cục bộ; package này gọi public API của `backend/` và không chứa server secret.

```bash
flutter pub get
flutter analyze
flutter test
flutter run --dart-define-from-file=config/development.json
```

Production:

```bash
flutter build appbundle --release --dart-define-from-file=config/production.json
```
