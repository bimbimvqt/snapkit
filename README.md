# Snapkit · Device Manager

Tạo và bật iOS Simulators / Android Emulators, xem thiết bị thật và chọn thiết bị debug cho **Antigravity**. Dashboard không chạy app Flutter. Debug, Hot Reload, log và DevTools do IDE quản lý.

Xoá máy ảo: bấm biểu tượng thùng rác trên card → kiểm tra tên → **Delete device & data**. Snapkit dừng máy ảo nếu đang chạy rồi xoá bằng `simctl delete` hoặc `avdmanager delete avd`: app đã cài, dữ liệu, cài đặt và snapshot riêng của thiết bị bị xoá vĩnh viễn. Runtime iOS / Android system image dùng chung được giữ lại; thiết bị thật không hỗ trợ xoá. Thiết bị bị xoá cũng được bỏ khỏi lựa chọn debug. Phiên debug đang dùng thiết bị đó sẽ mất kết nối; extension cũng dừng các phiên thuộc cùng nhóm Snapkit.

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
5. Cài **Snapkit Debug Sync 1.1+**, **Dart** và **Flutter** trong IDE. Mở **Run and Debug**, chọn profile Flutter debug thông thường của bạn (ví dụ `dev`), bấm **F5** hoặc **Run/Debug**. Khi **Use Dashboard targets** được bật và folder khớp, extension dùng lựa chọn trên Dashboard để mở các phiên debug trong bộ nhớ. Không cần profile `Snapkit:` trong `launch.json`.

Dashboard không ghi `.vscode/launch.json`, `.vscode/settings.json`, file backup hay file nào trong repo app. Flavor, entrypoint, đường dẫn defines và ID thiết bị được lưu theo project tại `SnapkitData/state/settings.json` / `workspaces.json` trên SSD. Các profile dùng chung trong `launch.json` vẫn do bạn quản lý; Dashboard chỉ đọc chúng khi nhập cấu hình. Không lưu nội dung defines hoặc secret.

### Debug bình thường khi không dùng Snapkit

- **Backend tắt / không kết nối được:** Run/Debug và F5 tự dùng nguyên cấu hình IDE gốc. Không cần khởi động Snapkit để debug.
- **Backend đang chạy nhưng muốn debug thường:** tắt **Use Dashboard targets** trên Dashboard. Danh sách thiết bị được giữ để bật lại sau này. Hoặc chạy lệnh **Snapkit: Toggle Dashboard Targets** trong IDE để bật/tắt tích hợp ở cài đặt riêng của IDE.
- **Không chọn thiết bị hoặc project khác:** extension không can thiệp. Attach, chạy test, profile, release và Run Without Debugging cũng giữ luồng IDE gốc.
- **Không cài / đã tắt extension:** IDE hoạt động như trước với các profile gốc, không có phụ thuộc Snapkit trong code app.
- **Backend tắt giữa phiên debug:** các phiên đã chạy vẫn do IDE quản lý; Hot Reload, Restart và Stop tiếp tục hoạt động.

Backend online và mode bật nhưng thiết bị đã chọn bị ngắt kết nối: extension báo lỗi để cập nhật lựa chọn, tránh âm thầm chạy trên thiết bị khác. Agent mặc định `http://127.0.0.1:4310`, có thể đổi setting **Snapkit: Agent URL** trong IDE; chỉ chấp nhận HTTP loopback. Workspace chưa trust không dùng tích hợp.

Lựa chọn áp dụng ở lần Debug kế tiếp. Các thiết bị được build lần lượt để tránh xung đột Xcode cùng thư mục build; khi khởi động xong chúng cùng giữ phiên debug. Stop một phiên trong nhóm sẽ dừng các phiên còn lại và huỷ thiết bị chưa khởi động. Giữ nguyên điều khiển IDE cho breakpoint, Hot Reload, Restart, log và DevTools.

Người khác clone app vẫn dùng profile gốc như thường. Nếu muốn dùng Dashboard, họ cài extension, chọn folder, nhập profile và chọn thiết bị local của họ; không cần commit ID thiết bị hoặc đường dẫn máy cá nhân vào repo app.

### Chuyển từ bản cũ có profile Snapkit trong launch.json

Chạy một lần để xoá riêng profile `Snapkit: Device · …` / `Snapkit: Active Device` và compound `Snapkit: Selected Devices` do bản cũ tạo:

```sh
node scripts/cleanup-legacy-ide.js /absolute/path/to/flutter-project
```

Giữ nguyên profile/compound khác và comment JSONC. Bản trước cùng `launch.json.snapkit.bak` được chuyển sang `SnapkitData/state/legacy-ide`, không tạo backup mới trong app. Đây là thao tác migration chủ động; API Dashboard không tự ghi file project. Nếu workspace từng cấu hình Hot Reload on Save qua Snapkit, chuyển setting đó sang cài đặt **User** trong IDE để repo app giữ nguyên.

### Đồng bộ nút Restart của IDE

Cài extension local **Snapkit Debug Sync** để nút Restart màu xanh trên thanh Debug gửi Hot Restart tới tất cả phiên Flutter đang chạy. Không giới hạn số thiết bị; chỉ đồng bộ phiên Flutter đã khởi động xong, không tác động phiên Dart thường. Hot Restart khởi tạo lại trạng thái ứng dụng; Hot Reload vẫn dùng lệnh Flutter hoặc lưu file theo cấu hình IDE.

```sh
python3 scripts/package-ide-extension.py
antigravity-ide --install-extension ./snapkit-debug-sync.vsix
```

Hoặc dùng **Extensions: Install from VSIX…** trong IDE. Tải lại cửa sổ bằng **Developer: Reload Window**, rồi chọn profile Flutter debug thông thường và bấm F5. Xem kết quả ở **Output → Snapkit Debug Sync**. Có thể tắt bằng setting `snapkit.syncFlutterRestart: false` hoặc gỡ extension. Trên Windows dùng Python 3 (`py` nếu không có `python3`) và CLI của IDE tương ứng.

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
