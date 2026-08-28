# Cấu hình Firebase Google Sign-In cho Snapkit

Snapkit dùng Firebase project `pregnancy-tracking-3f350` (project name `snapkit`, public-facing name `Snapkit`) theo mô hình mobile → Firebase Authentication → backend. Flutter đăng nhập Google vào Firebase, gửi Google ID token cho backend kiểm tra chữ ký/issuer/audience/email đã xác minh, sau đó backend mới phát access token và refresh token của Snapkit. Không lưu Google access token và không đặt client secret trong app.

## 1. Tạo OAuth credentials trên Google Cloud

Trong cùng một Google Cloud project, cấu hình OAuth consent screen rồi tạo ba credential:

1. **Web application**: `657923282345-dbrjtqdr5aicnhlscjlfmlt31d004oro.apps.googleusercontent.com`. Đây là `GOOGLE_SERVER_CLIENT_ID`, cũng là audience backend cho phép.
2. **Android**:
   - Package name: `com.snapkit.app`
   - Thêm SHA-1 và SHA-256 của debug key lẫn upload/release key.
3. **iOS**:
   - Bundle ID: `com.snapkit.app`
   - `CLIENT_ID`: `657923282345-8cf9gakhsove0gan5nnor5bovoeae9fa.apps.googleusercontent.com`
   - `REVERSED_CLIENT_ID`: `com.googleusercontent.apps.657923282345-8cf9gakhsove0gan5nnor5bovoeae9fa`

Hai Firebase app đang hoạt động là `Snapkit Android` và `Snapkit iOS`, cùng namespace `com.snapkit.app`. Không tạo lại app bằng package/bundle ID cũ.

Lấy fingerprint Android debug:

```bash
cd app/android
./gradlew signingReport
```

Lấy fingerprint upload key của production:

```bash
keytool -list -v -keystore app/android/keystore/snapkit-upload.jks -alias snapkit-upload
```

Client ID không phải secret. Tuy nhiên tuyệt đối không đưa OAuth client secret, service-account key hoặc file keystore vào Git.

## 2. Cấu hình backend

Backend nhận danh sách audience phân tách bằng dấu phẩy. Tối thiểu phải có Web OAuth client ID dùng làm `GOOGLE_SERVER_CLIENT_ID` của Flutter:

```dotenv
GOOGLE_OAUTH_CLIENT_IDS=657923282345-dbrjtqdr5aicnhlscjlfmlt31d004oro.apps.googleusercontent.com
```

- Docker local: đặt trong `.env` ở thư mục gốc.
- Backend hot reload: đặt trong `backend/.env`.
- Production: đặt trong `.env.prod`, sau đó cập nhật lại toàn bộ GitHub Environment secret:

```bash
pnpm env:check:prod
gh secret set PROD_ENV_FILE --env production < ./.env.prod
```

Nếu có nhiều audience hợp lệ trong giai đoạn chuyển đổi, dùng:

```dotenv
GOOGLE_OAUTH_CLIENT_IDS=web-client-current.apps.googleusercontent.com,web-client-next.apps.googleusercontent.com
```

## 3. Cấu hình Flutter Android/iOS

Client ID đã được điền vào `app/config/development.json` và `app/config/production.json`:

```json
{
  "APP_ENV": "development",
  "API_BASE_URL": "http://localhost:3001",
  "GOOGLE_SERVER_CLIENT_ID": "657923282345-dbrjtqdr5aicnhlscjlfmlt31d004oro.apps.googleusercontent.com",
  "GOOGLE_IOS_CLIENT_ID": "657923282345-8cf9gakhsove0gan5nnor5bovoeae9fa.apps.googleusercontent.com"
}
```

Android dùng `app/android/app/google-services.json` và `GOOGLE_SERVER_CLIENT_ID`; credential Android được Google đối chiếu bằng package name và signing fingerprint. iOS dùng `app/ios/Runner/GoogleService-Info.plist` cùng cả hai client ID. `firebase_core` khởi tạo Firebase trước khi UI chạy và `firebase_auth` tạo phiên Firebase từ Google credential.

Với iOS, tạo file local callback scheme từ template:

```bash
cp app/ios/Flutter/GoogleSignIn.xcconfig.example app/ios/Flutter/GoogleSignIn.xcconfig
```

Template đã chứa public callback scheme đúng của Snapkit. File thật bị bỏ qua khỏi Git và được tạo bằng lệnh trên:

```xcconfig
GOOGLE_IOS_REVERSED_CLIENT_ID=com.googleusercontent.apps.657923282345-8cf9gakhsove0gan5nnor5bovoeae9fa
```

File thật đã được `.gitignore`; CI hoặc máy build iOS cần tạo file này trước khi build.

## 4. Chạy và build

Backend hot reload và app iOS simulator:

```bash
pnpm --dir backend dev
make dev-app-ios
```

Android emulator:

```bash
make dev-app-android
```

Build production:

```bash
make build-app-prod
make build-app-ios-prod
```

Deploy backend sau khi đã cập nhật `PROD_ENV_FILE`:

```bash
git push origin main
gh workflow run production.yml --ref main
```

Pipeline production sẽ dừng sớm nếu thiếu `GOOGLE_OAUTH_CLIENT_IDS`, tránh deploy một backend mà app không thể đăng nhập.

## 5. Checklist khi gặp lỗi đăng nhập

- Backend: `GOOGLE_OAUTH_CLIENT_IDS` phải trùng chính xác `GOOGLE_SERVER_CLIENT_ID` trong bản app.
- Android: kiểm tra package `com.snapkit.app`, SHA-1/SHA-256 của đúng debug hoặc release key và Web client ID.
- iOS: kiểm tra bundle `com.snapkit.app`, iOS client ID và `REVERSED_CLIENT_ID` trong `GoogleSignIn.xcconfig`.
- Nếu Google trả về cancel ngay sau khi chọn account trên Android, nguyên nhân thường là SHA/package/server client ID sai.
- Production API phải là HTTPS và truy cập được từ thiết bị.

Lưu ý App Store: khi một app cho phép đăng nhập bằng Google, Apple có thể yêu cầu thêm Sign in with Apple theo App Review Guidelines. Cần hoàn thiện lựa chọn này trước khi phát hành iOS công khai nếu trường hợp miễn trừ không áp dụng.
