# Snapkit · Device Manager

Tạo và bật iOS Simulators / Android Emulators, xem thiết bị thật và chọn thiết bị debug cho **Antigravity**. Dashboard không chạy app Flutter. Debug, Hot Reload, log và DevTools do IDE quản lý.

Xoá máy ảo: bấm biểu tượng thùng rác trên card → kiểm tra tên → **Delete device & data**. Snapkit dừng máy ảo nếu đang chạy rồi xoá bằng `simctl delete` hoặc `avdmanager delete avd`: app đã cài, dữ liệu, cài đặt và snapshot riêng của thiết bị bị xoá vĩnh viễn. Runtime iOS / Android system image dùng chung được giữ lại; thiết bị thật không hỗ trợ xoá. Thiết bị bị xoá cũng được bỏ khỏi lựa chọn debug. Phiên debug đang dùng thiết bị đó sẽ mất kết nối; compound có `stopAll: true` có thể dừng các phiên cùng nhóm.

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

### Đề xuất: cấu hình debug ngoài repo app

Hiện tại phần chọn thiết bị vẫn cập nhật `launch.json` như mô tả ở trên. Phương án chuyển đổi được đề xuất:

- Dashboard lưu project, flavor, entrypoint, đường dẫn defines và danh sách thiết bị trong `SnapkitData/state` trên SSD, theo từng workspace; không ghi file trong project Flutter.
- Mở rộng extension Snapkit với lệnh **Debug Selected Devices**, gán F5 khi workspace hiện tại đang được Dashboard quản lý. Extension lấy cấu hình từ agent loopback, xác minh project khớp cửa sổ IDE rồi gọi `vscode.debug.startDebugging` với cấu hình trong bộ nhớ cho từng thiết bị. IDE tiếp tục quản lý breakpoint, Hot Reload, Restart và Stop.
- Đọc các profile có sẵn trong `launch.json` để nhập cấu hình lên Dashboard nếu muốn; chỉ đọc. Giữ nguyên các profile dùng chung của nhóm. Không ghi UUID thiết bị, đường dẫn tuyệt đối hay file backup vào repo app.
- Người khác clone app, cài Snapkit/extension, chọn folder và profile trên Dashboard của họ. Không cần nhận file cấu hình của máy người khác. Có thể xuất/nhập preset flavor/entrypoint có đường dẫn tương đối; ID thiết bị và đường dẫn bí mật luôn là dữ liệu local.
- Khi triển khai, có bước dọn riêng các profile/compound `Snapkit:` cũ và backup do Snapkit tạo; bảo toàn cấu hình người dùng. Cơ chế hiện tại chỉ được bỏ sau khi kiểm chứng chạy Debug từ IDE bằng cấu hình trong bộ nhớ.

### Đồng bộ nút Restart của IDE

Cài extension local **Snapkit Debug Sync** để nút Restart màu xanh trên thanh Debug gửi Hot Restart tới tất cả phiên Flutter đang chạy. Không giới hạn số thiết bị; chỉ đồng bộ phiên Flutter đã khởi động xong, không tác động phiên Dart thường. Hot Restart khởi tạo lại trạng thái ứng dụng; Hot Reload vẫn dùng lệnh Flutter hoặc lưu file theo cấu hình IDE.

```sh
python3 scripts/package-ide-extension.py
antigravity-ide --install-extension ./snapkit-debug-sync.vsix
```

Hoặc dùng **Extensions: Install from VSIX…** trong IDE. Tải lại cửa sổ bằng **Developer: Reload Window**, rồi chạy lại `Snapkit: Selected Devices`. Xem kết quả ở **Output → Snapkit Debug Sync**. Có thể tắt bằng setting `snapkit.syncFlutterRestart: false` hoặc gỡ extension. Trên Windows dùng Python 3 (`py` nếu không có `python3`) và CLI của IDE tương ứng.

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
