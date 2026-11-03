# Snapkit changelog

## 0.2.0-beta.15 — 2026-11-03

- Thay toàn bộ dropdown hệ điều hành trong app bằng menu đồng bộ sáng/tối: chọn thiết bị, mức log, profile debug, model và runtime.
- Flavor dùng gợi ý tùy chỉnh, vẫn cho nhập tên riêng. Danh sách dài có tìm kiếm; hỗ trợ bàn phím, trạng thái disabled/required, EN/VN và menu không bị cắt trong dialog/cửa sổ nhỏ.
- Giữ focus khi bộ thiết bị đồng bộ, thêm trạng thái chỉnh sửa và nút hủy.
- Sửa ảnh xem trước khi quay lại tab, nút dừng log sau khi dừng; vô hiệu hóa thao tác khi chưa có dự án/thiết bị phù hợp.
- Menu theo vị trí trường khi nội dung cuộn và không bị đóng bởi log tự cuộn.

## 0.2.0-beta.14 — 2026-11-03

- Hướng dẫn bắt đầu thành trang đầy đủ gồm 8 bước, mục lục, xử lý sự cố và nút đi tới chức năng; hỗ trợ EN/VN.
- Bộ thiết bị riêng cho từng dự án: tạo/sửa/xóa, khởi động tối đa hai máy cùng lúc, báo kết quả từng thiết bị và chọn máy sẵn sàng cho IDE.
- Log hệ thống theo thiết bị Android/iOS Simulator: tìm kiếm, lọc cảnh báo/lỗi, tạm dừng theo dõi và xuất log đã lọc. Bộ đệm giới hạn 1.000 dòng / 1 MB, tự dừng khi không có người xem.
- Chụp PNG, quay MP4 và thư viện theo dự án: xem trước, tải về, xóa tệp; lối tắt trên card thiết bị. Quay tối đa 3 phút, không âm thanh, tối đa hai phiên.
- Chỉ dừng tiến trình quay do Snapkit tạo; không dùng killall/pkill. iPhone thật dùng Xcode/QuickTime cho log và chụp/quay.
- Kiểm tra dung lượng trước khi chụp/quay, cảnh báo trước khi thoát lúc đang quay và báo tệp bị gián đoạn khi mở lại.

## 0.2.0-beta.13 — 2026-11-03

- Không tạo banner khi thông báo admin ở ngôn ngữ hiện tại trống hoặc chỉ có khoảng trắng.
- Bỏ thẻ quảng bá ở sidebar; chia menu thành Không gian làm việc, Thiết lập, Tài khoản và Trợ giúp.
- Giữ hướng dẫn bắt đầu ở mục Trợ giúp và cho phép cuộn menu khi cửa sổ thấp.

## 0.2.0-beta.12 — 2026-11-03

- Thêm icon Google nhiều màu và làm gọn màn đăng nhập desktop.
- Nút kiểm tra kết nối chỉ hiện khi có lỗi, kiểm tra lại phiên với phản hồi đang tải và chặn bấm lặp.

## 0.2.0-beta.11 — 2026-11-03

- Splash khi khởi động desktop, dùng logo Snapkit hiện tại, animation nhẹ và nội dung EN/VN.
- Chuyển sang app khi giao diện đăng nhập sẵn sàng; tôn trọng tùy chọn giảm chuyển động.
- Thiết kế lại trang đăng nhập quản trị và hỗ trợ đổi tài khoản Google.

## 0.2.0-beta.10 — 2026-11-02

- Đăng nhập Google qua trình duyệt hệ thống; phiên desktop được mã hóa bằng kho bảo mật hệ điều hành.
- Kiểm tra tài khoản phía server, phân quyền admin, khóa tài khoản và thu hồi phiên đăng nhập.
- Trang `/admin/` quản lý người dùng, nội dung landing EN/VN, thông báo app, đăng ký mới và phiên bản đề xuất.
- Ẩn phần thông số iOS khi không lấy được dữ liệu.
- Beta tiếp tục miễn phí; RevenueCat checkout vẫn tắt. Cần internet để xác thực tài khoản.

## 0.2.0-beta.9

- Đồng bộ thương hiệu Snapkit, thông số phần cứng thực tế và thao tác thiết bị thật.
- Quản lý thiết bị, lựa chọn nhiều thiết bị Flutter debug, dừng debug từng thiết bị qua extension.
- Landing và app hỗ trợ English / Tiếng Việt; bộ cài macOS Apple Silicon, Intel và Windows x64.

Chi tiết các bản trước: https://github.com/bimbimvqt/snapkit/releases
