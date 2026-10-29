# Snapkit · Device Manager

Tạo và bật iOS Simulators / Android Emulators, xem thiết bị thật và chọn thiết bị debug cho **Antigravity**. Dashboard không chạy app Flutter. Debug, Hot Reload, log và DevTools do IDE quản lý.

Website: [bimbimvqt.github.io/snapkit](https://bimbimvqt.github.io/snapkit/) · [Device Manager](https://bimbimvqt.github.io/snapkit/preview/)

## Cài đặt local

Cần Node.js 20+ (khuyến nghị 22), Flutter SDK trên PATH, Android SDK; iOS cần macOS + Xcode.

```sh
git clone https://github.com/bimbimvqt/snapkit.git
cd snapkit
npm ci
npm start
```

Mở **http://127.0.0.1:4310/**. Với dữ liệu mẫu: `npm run demo` (dừng server thường trước).

## Dùng với Antigravity

1. Bấm **Add device**, chọn model và OS tương thích. Có thể cài Android image hoặc tải/import iOS runtime qua Xcode nếu thiếu. iPhone 5 không tương thích Xcode/Flutter hiện tại.
2. Bấm **Start device**, chờ thiết bị online và được Flutter nhận diện.
3. Mở **IDE debug setup**, chọn folder Flutter đang mở trong Antigravity. Nhập cấu hình debug từ `.vscode/launch.json` có sẵn hoặc điền flavor, entrypoint và đường dẫn file defines.
4. Tick **Select for IDE** trên một hoặc nhiều thiết bị đang bật.
5. Trong Antigravity, mở **Run and Debug**, chọn **Snapkit: Selected Devices**, bấm **F5**. IDE mở phiên debug cho tất cả thiết bị đã chọn. Dùng điều khiển debug của IDE để Hot Reload/Restart/Stop.

Cài extensions **Dart** và **Flutter** trong Antigravity. Cấu hình dùng chuẩn `.vscode/launch.json`: mỗi thiết bị có một cấu hình Dart riêng và một compound `Snapkit: Selected Devices`, `stopAll: true`. Dashboard chỉ cập nhật các mục do Snapkit tạo, giữ các profile/compound khác và comment JSONC; bản trước được lưu trong `launch.json.snapkit.bak`.

Lựa chọn có hiệu lực ở lần Debug kế tiếp, không tự thêm/bớt thiết bị trong phiên IDE đang chạy. Thiết bị bật mới cần được tick để tham gia. Không tick thiết bị đã tắt/ngắt kết nối. iPhone thật cần trust, Developer Mode và signing đúng trong Xcode. Chạy Android + iOS hoặc hai Simulator tránh yêu cầu signing của iPhone thật.

## Dùng trên domain GitHub

GitHub Pages chỉ phục vụ giao diện; agent local phải tiếp tục chạy trên cùng máy:

1. Mở Dashboard local → **Connect website**.
2. Bấm **Open website & connect** hoặc nhập mã ở website. Cho phép **Local network access** khi trình duyệt hỏi.
3. `/preview/` và `/control/` đều là Device Manager; `/demo/` chỉ có dữ liệu mẫu.

Mã ghép đôi dùng một lần, hết hạn sau 5 phút; phiên hết hạn sau 8 giờ hoặc khi agent restart. Token ở sessionStorage, không trong query URL. Backend chỉ bind `127.0.0.1`, kiểm tra Host/Origin, mọi request website cần token. Đổi domain bằng `SNAPKIT_WEB_ORIGIN=https://your-domain`. Không tắt bảo mật trình duyệt.

## Dữ liệu trên SSD

macOS tự dùng `/Volumes/SanDiskSSDData/SnapkitData` nếu ổ có sẵn. Có thể đặt `SNAPKIT_DATA_ROOT` trước khi chạy. Android AVD, runtime tải về, file tạm và trạng thái ở thư mục này. Android SDK dùng SDK đã cấu hình qua `ANDROID_SDK_ROOT`/`ANDROID_HOME`, hoặc SDK có sẵn trên SSD.

Dữ liệu iOS hiện dùng thư mục CoreSimulator mặc định khi macOS chặn quyền truy cập ổ ngoài. Runtime đã cài do Xcode quản lý trong `/Library/Developer/CoreSimulator`. Vị trí thực tế được hiển thị khi tạo thiết bị; bản sao SSD không phải dữ liệu đang hoạt động. Không tự chuyển lại iOS sang SSD khi hệ thống chặn. Các file/ảnh cũ vẫn được giữ trên ổ.

Trên Windows, cài Flutter và Android SDK; chỉ có Android Emulator. Đặt `SNAPKIT_DATA_ROOT` tới ổ SSD của bạn, ví dụ `D:\SnapkitData`.

## Kiểm tra và deploy

```sh
npm run check
npm test
npm run test:ui
npm run test:pages
npm run build:pages
```

Push `main` kích hoạt GitHub Actions để kiểm tra và deploy Pages. Backend dùng Express, frontend HTML/CSS/JavaScript và Lucide local; không cần CDN.
