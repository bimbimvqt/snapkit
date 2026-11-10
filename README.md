<div align="center">
  <img src="packages/ui/favicon.svg" width="80" height="80" alt="Snapkit">
  <h1>Snapkit</h1>
  <p><strong>Thiết bị của bạn. Nhịp làm việc của bạn.</strong></p>
  <p>Không gian làm việc cho Flutter và React Native.<br>Quản lý thiết bị, debug nhiều màn hình và chuẩn bị bản build ngay trên máy.</p>
  <p>
    <a href="https://snapkit.vn/"><strong>Website</strong></a> ·
    <a href="https://github.com/bimbimvqt/snapkit/releases"><strong>Tải Snapkit</strong></a> ·
    <a href="docs/usage.md">Hướng dẫn</a> ·
    <a href="https://github.com/bimbimvqt/snapkit/issues">Báo lỗi</a>
  </p>
  <p>macOS 13+ · Windows x64 · English / Tiếng Việt · Beta miễn phí</p>
</div>

---

## Tập trung vào app đang xây dựng

Snapkit gom thiết bị, workspace và các công cụ thường dùng vào một ứng dụng desktop. Tạo máy ảo, mở bộ thiết bị theo dự án, xem log, chụp màn hình và chuyển sang IDE để debug theo cách quen thuộc.

| Công việc | Snapkit hỗ trợ |
| --- | --- |
| **Quản lý thiết bị** | Tạo, bật, dừng iOS Simulator và Android Emulator; xem thiết bị thật đang kết nối. |
| **Làm việc theo dự án** | Workspace Flutter, React Native và bộ thiết bị được lưu theo project. Backend hiện là Coming soon. |
| **Debug nhiều thiết bị** | Chọn thiết bị trên Snapkit, chạy từ IDE qua extension Snapkit Debug Sync. |
| **Xem log và lưu hình ảnh** | Log hệ thống, ảnh PNG và video MP4 không âm thanh trên Android và iOS Simulator. |
| **Chuẩn bị phát hành Flutter** | Build APK, AAB, IPA và upload TestFlight với SDK, tài khoản và cấu hình signing của bạn. |

Lệnh thiết bị, SDK và source code chạy trên máy của bạn. Đăng nhập Google và kiểm tra cập nhật cần internet. Log và ảnh/video không tự gửi lên máy chủ.

## Tải và bắt đầu

**[Tải bộ cài tại GitHub Releases →](https://github.com/bimbimvqt/snapkit/releases)**

| Máy tính | Chọn bộ cài | Thiết bị hỗ trợ |
| --- | --- | --- |
| macOS 13+ · Apple Silicon | `mac-arm64.dmg` hoặc `mac-arm64.zip` | Android và iOS Simulator |
| macOS 13+ · Intel | `mac-x64.dmg` hoặc `mac-x64.zip` | Android và iOS Simulator |
| Windows · x64 | `win-x64.exe` | Android |

1. Cài Snapkit và đăng nhập bằng Google trong trình duyệt hệ thống.
2. Mở **Setup & tools** để kiểm tra Flutter, Android SDK hoặc Xcode cần cho dự án.
3. Chọn workspace và project, thêm thiết bị hoặc mở bộ thiết bị đã lưu.
4. Bật thiết bị, cài **Snapkit Debug Sync** nếu cần debug nhiều máy, rồi chạy từ IDE.

Bộ cài đã kèm Node.js; bạn không cần cài Node.js để mở app. Flutter, Android SDK và Xcode cài riêng. Trên macOS, app hiện ký ad-hoc và chưa có Apple notarization; xem [hướng dẫn cài beta](docs/beta-release.md) nếu hệ điều hành chặn lần mở đầu tiên.

## Chọn workflow phù hợp

### Personal và Teams

Chuyển **Personal / Teams** ngay trong sidebar. Personal giữ project và thiết bị local hiện tại; Teams dùng workspace chung với thành viên, quyền theo project/môi trường/lớp dịch vụ, blueprint có phiên bản, lịch đặt thiết bị và bàn giao QA. Dữ liệu hai khu vực được lưu riêng. Teams cần account service đã cập nhật; xem [hướng dẫn và phạm vi Teams](docs/teams.md).

### Flutter

Dùng profile Flutter hiện có trong IDE, chọn thiết bị trên Snapkit và bấm **F5**. Snapkit Debug Sync mở các phiên debug cho những thiết bị đã chọn; breakpoint, Hot Reload, Hot Restart và Debug Console tiếp tục dùng trong IDE.

Tích hợp nhóm thiết bị dành cho editor tương thích VS Code; Cursor và Antigravity còn beta. Các editor khác vẫn dùng Snapkit để quản lý thiết bị và chọn máy qua editor của mình.

### React Native

Với project native dùng Hermes và community CLI, chọn profile **Snapkit React Native** trong IDE. Extension build/mở app, khởi động hoặc dùng lại Metro và gắn JavaScript debugger cho từng thiết bị. React Native/Metro xử lý Fast Refresh.

Expo cần prebuild. Expo Go, khởi chạy IDE trên iPhone thật và build release React Native trong Snapkit chưa được hỗ trợ.

**[Xem hướng dẫn setup IDE, bộ thiết bị, log và build →](docs/usage.md)**

## Beta hiện tại

- **Miễn phí, đăng nhập Google.** Checkout đang tắt; beta không tự chuyển thành subscription trả phí.
- **Personal lưu theo máy.** Workspace cá nhân, cấu hình và ảnh/video lưu trong thư mục dữ liệu Snapkit. Teams lưu metadata cộng tác riêng trên account service; không tự chia sẻ source hay thiết bị cá nhân. Xóa máy ảo sẽ xóa dữ liệu riêng của máy ảo đó và cần xác nhận.
- **Cập nhật do bạn chọn.** App hỗ trợ kiểm tra và tải cập nhật; cài đặt cần thao tác xác nhận. Xem [cơ chế cập nhật](docs/in-app-updates.md).
- **Phạm vi nền tảng rõ ràng.** iOS Simulator cần macOS + Xcode. Linux và Windows ARM64 chưa có bộ cài được công bố hỗ trợ. Kiểm thử tự động không thay thế QA trên máy và thiết bị thật.

## Chạy từ source

Cần **Node.js 22.12+**. Cài thêm SDK tương ứng nếu dùng thiết bị thật hoặc máy ảo.

```sh
git clone https://github.com/bimbimvqt/snapkit.git
cd snapkit
npm ci
npm run desktop:dev
```

Lệnh trên mở Snapkit Dev với thiết bị mẫu và tự build lại giao diện khi lưu file. Dùng `npm run desktop:dev:local` để làm việc với thiết bị thật. Nếu chỉ cần agent trong trình duyệt, chạy `npm start` rồi mở `http://127.0.0.1:4310/`.

```sh
npm run check
npm test
npm run test:ui
npm run test:pages
```

## Tài liệu

| Bạn cần | Đọc tại đây |
| --- | --- |
| Setup, debug nhiều máy, bộ thiết bị, log, ảnh/video | [Hướng dẫn sử dụng](docs/usage.md) |
| Chỉnh UI và chạy môi trường desktop dev | [Desktop development](docs/desktop-development.md) |
| Cấu trúc repository và frontend | [Architecture](docs/architecture.md) · [React + TypeScript](docs/frontend-architecture.md) |
| Build APK, AAB, IPA và TestFlight | [Release builds](docs/release-builds.md) |
| Cài đặt, giới hạn và cập nhật beta | [Beta release](docs/beta-release.md) · [In-app updates](docs/in-app-updates.md) |
| Extension IDE | [English](apps/ide-extension/README.md) · [Tiếng Việt](apps/ide-extension/README.vi.md) · [Hỗ trợ](apps/ide-extension/SUPPORT.md) |
| Thay đổi qua các phiên bản | [Changelog](CHANGELOG.md) |

---

Website chính: **[snapkit.vn](https://snapkit.vn/)** · Bộ cài: **[GitHub Releases](https://github.com/bimbimvqt/snapkit/releases)**
