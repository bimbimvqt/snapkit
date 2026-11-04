# Phát triển UI trực tiếp trên Snapkit

Không cần tạo bản beta để chỉnh HTML/CSS/JavaScript. Chạy từ thư mục source với Node.js 20+ và `npm ci` lần đầu:

```sh
npm run desktop:dev
```

Cửa sổ **Snapkit Dev** mở cùng DevTools, sử dụng thiết bị mẫu và không cần đăng nhập. Bản beta có thể tiếp tục chạy song song.

- Lưu CSS trong `apps/dashboard/` hoặc `packages/ui/`: stylesheet được thay tại chỗ, giữ tab, dữ liệu form và popup đang mở.
- Lưu HTML/JS hoặc asset trong `apps/dashboard/` hoặc `packages/ui/`: tải lại giao diện, khôi phục tab và nội dung ô tìm thiết bị. Form chưa lưu, popup và vị trí cuộn có thể mất sau reload.
- DevTools: inspect phần tử, xem Console/Network, thử CSS. Thay đổi trực tiếp trong DevTools chỉ là tạm thời; sửa file source để lưu lâu dài.
- Sửa `apps/agent/`, `apps/desktop/`, package hoặc dependency: thoát cửa sổ Dev rồi chạy lại lệnh. Không tự restart backend trong khi có thao tác thiết bị.
- Đóng cửa sổ Dev để dừng agent và watcher của phiên đó.

## Kiểm tra với thiết bị thật

```sh
npm run desktop:dev:local
```

Chế độ này yêu cầu đăng nhập Google riêng và chọn lại thư mục Flutter/SDK. Các thao tác bật/tắt/xóa thiết bị tác động đến simulator/emulator thật trên máy, dù cấu hình Snapkit được tách riêng. Thiết bị thật vẫn dùng chung với bản beta; tránh gửi lệnh mâu thuẫn từ hai cửa sổ.

## Dữ liệu và cổng

- Cổng Dev mặc định: `http://127.0.0.1:4311`; beta dùng `4310`.
- Profile Electron, tài khoản và cấu hình Dev: `.snapkit-dev/demo/` hoặc `.snapkit-dev/local/` trong source, đã được gitignore. Không sao chép tài khoản hoặc dữ liệu beta vào Dev.
- Có thể chọn cổng khác bằng biến môi trường `SNAPKIT_DEV_PORT` (khác 4310); chọn nơi lưu Dev riêng bằng `SNAPKIT_DEV_DATA_ROOT`.
- Hot reload và tự mở DevTools chỉ hoạt động khi chạy source với `SNAPKIT_DEV=1`; bản app đóng gói không bật chế độ này.
- Extension IDE mặc định kết nối agent beta ở 4310. Chế độ Dev 4311 phục vụ phát triển app; không tự chuyển kết nối IDE đang dùng.

Sau khi kiểm tra UI xong mới đóng gói/phát hành beta theo luồng hiện có. Không cần bump version hay deploy cho từng chỉnh sửa UI.
