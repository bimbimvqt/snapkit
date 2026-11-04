# Snapkit Debug Sync · Tiếng Việt

<img src="icon.png" width="80" height="80" alt="Snapkit">

**Chọn thiết bị trong Snapkit. Tiếp tục debug trong IDE của bạn.**

[English](README.md) · [Lịch sử thay đổi](CHANGELOG.md) · [Hỗ trợ](SUPPORT.md)

Extension kết nối Snapkit Desktop với trình debug Flutter của IDE. Bạn chọn một hoặc nhiều thiết bị trên dashboard, rồi dùng F5 và profile Flutter bình thường để khởi chạy các phiên debug. Extension không ghi cấu hình Snapkit vào source dự án.

## Khi nào cần extension?

- Tạo, bật/tắt và quản lý simulator/emulator: dùng Snapkit Desktop, không bắt buộc cài extension.
- Chọn nhiều thiết bị trong dashboard rồi bấm F5 trong IDE: cần extension.
- Dừng debug từng thiết bị từ thẻ trên dashboard: cần Debug Sync 1.3+ và phiên debug mới có ID thiết bị.
- Nút Restart của IDE gửi Hot Restart đến các phiên Flutter khác đã sẵn sàng; có thể tắt đồng bộ trong Settings. Hot Restart khởi tạo lại trạng thái app; Hot Reload vẫn do Flutter/IDE quản lý.

## Yêu cầu

- Khuyến nghị Snapkit Desktop beta.7 trở lên; beta.6 bắt đầu hỗ trợ điều khiển phiên debug.
- VS Code 1.85+; Cursor và Antigravity đang ở mức tương thích beta.
- Cài và bật Dart, Flutter trong chính IDE đó; mở dự án Flutter đã được trust.
- Cài Flutter SDK, Android SDK riêng; iOS Simulator cần macOS và Xcode.
- Android Studio/IntelliJ dùng bộ điều khiển debug riêng, không cài VSIX này.

Windows quản lý Android. Chưa có gói desktop Linux/Windows ARM trong beta; chưa tích hợp React Native/Metro hoặc debug nhóm JetBrains. Remote SSH, WSL và Dev Containers chưa được xác minh: địa chỉ localhost có thể thuộc máy chạy extension host thay vì máy đang mở Snapkit Desktop.

## Cài đặt và cập nhật

1. Tải `snapkit-debug-sync.vsix` từ [GitHub Releases](https://github.com/bimbimvqt/snapkit/releases).
2. Vào **Extensions → … → Install from VSIX…**, chọn tệp vừa tải.
3. Lưu công việc, dừng debug đang chạy rồi dùng **Developer: Reload Window**.
4. Kiểm tra trang extension hiển thị phiên bản **1.3.1** trở lên. Bắt đầu phiên debug mới để phiên đó được extension mới quản lý.

Cài riêng trong từng IDE muốn kết nối. Bản cài VSIX không thiết lập tự cập nhật qua marketplace; muốn cập nhật thì cài VSIX mới. Người dùng gói desktop/extension không cần cài Node.js hay Python.

## Bắt đầu sử dụng

1. Mở Snapkit và dự án Flutter trong IDE.
2. Trong Snapkit, vào **Thiết lập debug trong IDE**, chọn đúng thư mục dự án đang mở. Chọn profile hoặc nhập flavor, Dart entrypoint và đường dẫn file defines nếu cần.
3. Bật thiết bị, rồi tick **Chọn cho IDE** trên các thiết bị muốn chạy.
4. Bật **Use Dashboard targets**.
5. Trong IDE, chọn profile debug Flutter bình thường và bấm **F5**. Các thiết bị được yêu cầu khởi chạy đồng thời; Flutter/Xcode có thể phải chờ khóa build.
6. Dùng IDE để đặt breakpoint, Hot Reload, xem log và DevTools. Thay đổi lựa chọn trên dashboard áp dụng cho lần chạy tiếp theo.

Khi đổi tên hoặc di chuyển thư mục source, hãy chọn lại vị trí trong Snapkit. Đường dẫn SDK độc lập với thư mục dự án; không cần đổi SDK chỉ vì source được di chuyển.

## Phân biệt các thao tác

| Thao tác | Kết quả |
| --- | --- |
| Dừng debug | Yêu cầu IDE dừng các phiên debug trên đúng thiết bị; máy ảo vẫn mở và thiết bị khác tiếp tục debug. |
| Tắt thiết bị | Tắt simulator/emulator, giữ app đã cài và dữ liệu thiết bị; phiên debug trên đó mất kết nối. |
| Xóa thiết bị và dữ liệu | Xóa vĩnh viễn dữ liệu riêng của thiết bị sau bước xác nhận; runtime dùng chung được giữ lại. |

Không thể tắt nguồn điện thoại thật từ Snapkit. Nút **Dừng debug** chỉ xuất hiện khi extension đang báo một phiên có ID thiết bị; editor không hỗ trợ hoặc extension cũ vẫn dùng nút Stop trong IDE. Nếu có nhiều phiên cùng nhắm một thiết bị, thao tác này yêu cầu dừng tất cả phiên trên thiết bị đó.

Báo cáo phiên hết hạn sau khoảng 10 giây mất kết nối. Tắt Snapkit không tự dừng các phiên IDE. Dừng một phiên đang chạy giữ các phiên khác tiếp tục; lỗi khởi chạy nhóm vẫn hủy các phiên cùng nhóm để tránh chạy dở dang.

## Tùy chọn

| Setting | Mặc định | Chức năng |
| --- | --- | --- |
| `snapkit.useDashboardTargets` | `true` | Dùng thiết bị đã chọn khi Snapkit có kết nối và thư mục dự án khớp. |
| `snapkit.agentUrl` | `http://127.0.0.1:4310` | Địa chỉ agent cục bộ, chỉ nhận HTTP loopback qua localhost hoặc 127.0.0.1. |
| `snapkit.syncFlutterRestart` | `true` | Đồng bộ Restart đến các phiên Flutter khác đã sẵn sàng trong IDE này. |

Command Palette có lệnh **Snapkit: Toggle Dashboard Targets** để bật/tắt tích hợp. Lệnh này không dừng phiên đang chạy.

Agent không kết nối được hoặc tích hợp bị tắt thì F5 dùng cấu hình IDE gốc. Attach, test, profile/release, Run Without Debugging, workspace chưa trust hoặc dự án khác giữ luồng debug gốc. Nếu lựa chọn đang hoạt động nhưng thiết bị bị offline, extension báo lỗi để bạn cập nhật lựa chọn.

## Dữ liệu và hỗ trợ

Extension không ghi `launch.json`, source hoặc ID thiết bị vào repo dự án. Cấu hình được lưu trên máy; đường dẫn file defines được lưu, nội dung file không được sao chép. Báo cáo phiên gồm ID phiên, tên phiên và ID thiết bị, gửi đến agent loopback; dữ liệu điều khiển phiên chỉ ở bộ nhớ và không gửi source lên cloud Snapkit. IDE và extension Flutter có chính sách dữ liệu riêng.

Nếu nút Dừng debug chưa hiện: kiểm tra bản extension, reload IDE rồi bắt đầu debug lại. Nếu F5 dùng thiết bị khác: kiểm tra thư mục dự án khớp, Dashboard targets đang bật và thiết bị online. Nếu đã di chuyển source, chọn lại đường dẫn mới.

Xem **View → Output → Snapkit Debug Sync** để đọc log. Hướng dẫn báo lỗi ở [SUPPORT.md](SUPPORT.md); lịch sử phiên bản ở [CHANGELOG.md](CHANGELOG.md).
