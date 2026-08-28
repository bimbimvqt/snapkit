# Snapkit App

Flutter iOS/Android app cho Media Cleaner và QR Studio. Media được xử lý cục bộ; package này gọi public API của `backend/` và không chứa server secret.

## Kiến trúc UI

- GetX quản lý dependency injection, controller state và named routes.
- `flutter_screenutil` dùng design size `390 × 844`; font resolver được giới hạn an toàn để không phóng đại chữ ở landscape.
- Design tokens nằm trong `lib/core/styles/`: `AppColors`, `AppTextStyles`, `AppDimensions` và `AppAssets`.
- Luồng feature tuân theo `UI → Controller → Abstract Repository → Repository implementation → API/device data source`.
- Mỗi thay đổi Dart phải format bằng `dart format --page-width 120` theo `AGENTS.md`.

## Chạy local

```bash
flutter pub get
dart format --page-width 120 --output=none --set-exit-if-changed lib test
flutter analyze
flutter test
flutter run --dart-define-from-file=config/development.json
```

App yêu cầu đăng nhập Google. Trước khi chạy, điền OAuth client IDs vào file config và cấu hình callback scheme iOS theo [docs/google-sign-in.md](../docs/google-sign-in.md).

Production:

```bash
flutter build appbundle --release --dart-define-from-file=config/production.json
```
