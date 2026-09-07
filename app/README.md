# Snapkit App

Flutter iOS/Android app cho Media Cleaner và QR Studio. Media được xử lý cục bộ; khi cấu hình quản trị bật đồng bộ, app chỉ gửi thumbnail JPEG nén cùng metadata giới hạn, không gửi file gốc hoặc tên file. Package này gọi public API của `backend/` và không chứa server secret.

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

AdMob App ID production đã được cấu hình cho cả Android và iOS. Ad unit ID vẫn được quản lý từ
Admin → Cấu hình ứng dụng để có thể bật/tắt hoặc thay đổi mà không cần phát hành app mới:

- Android App ID: `ca-app-pub-5682981484728700~9055607754`.
- iOS App ID: `ca-app-pub-5682981484728700~7415223020`.
- Android banner/interstitial: `ca-app-pub-5682981484728700/2193696256` và
  `ca-app-pub-5682981484728700/6623895850`.
- iOS banner/interstitial: `ca-app-pub-5682981484728700/6627765287` và
  `ca-app-pub-5682981484728700/1072186276`.

Giữ Admin ở `test` trong lúc QA; chỉ chuyển sang `live` sau khi cả bốn ad unit ID đã được nhập và xác minh.
Tài khoản Pro không request quảng cáo. Có thể override Android App ID theo từng môi trường bằng biến
`ADMOB_ANDROID_APP_ID`; iOS có thể override bằng `ios/Flutter/AdMob.xcconfig`.

## Chính sách Free và Pro

- Free: 100 MB cloud, preview 7 ngày, video tối đa 50 MB, không giữ video gốc; banner ở Home và interstitial
  sau mỗi 3 lần dọn thành công với cooldown 180 giây.
- Pro tháng: 79.000đ/tháng, 10 GB cloud, preview 90 ngày, giữ video gốc 30 ngày và không quảng cáo.
- Pro năm: 599.000đ/năm, dùng thử 7 ngày, 25 GB cloud, preview 365 ngày, giữ video gốc 90 ngày và
  không quảng cáo.
- App mặc định chỉ đồng bộ thống kê tổng hợp của lượt quét. Upload thumbnail, ảnh hoặc video lên Admin là
  cấu hình riêng và mặc định tắt.

Khi debug trên iPhone thật và cần dữ liệu xuất hiện trong Admin production, vẫn chạy Flutter ở debug mode nhưng dùng
`config/production.json`. Cấu hình `development.device.json` chỉ gửi dữ liệu về backend local trên máy phát triển.
