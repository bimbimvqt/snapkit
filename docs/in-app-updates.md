# Cập nhật Snapkit trong ứng dụng

Từ **0.2.0-beta.19**, vào **Preferences / Tùy chọn → Cập nhật ứng dụng**. App kiểm tra sau khi mở và mỗi 6 giờ; chỉ tải khi người dùng bấm **Tải bản cập nhật**. Có tiến độ tải và nút hủy. Sau khi xác minh xong, bấm **Khởi động lại và cài đặt** rồi xác nhận. Đăng nhập, workspace, cấu hình, thiết bị, ảnh/video và lịch sử build được giữ nguyên.

Đây là bản desktop production (agent thật, Google login và dữ liệu thật); sản phẩm vẫn thuộc kênh beta miễn phí. Bản cài trước beta.19 cần được thay một lần để có bộ cập nhật mới. Không nạp JavaScript từ xa vào app đang chạy.

## Bản cập nhật đến từ đâu?

Nguồn cố định là GitHub Releases `bimbimvqt/snapkit`. Metadata dùng HTTPS từ API GitHub; file chỉ tải từ repository này và các host lưu release của GitHub. App chọn phiên bản lớn hơn phiên bản đang chạy, đúng OS/CPU, không chọn draft và yêu cầu GitHub cung cấp `digest: sha256:...`. Không chấp nhận checksum/URL do renderer gửi lên. Bản stable không nhận bản beta; bản beta nhận beta hoặc stable mới hơn. Chưa có metadata/digest hợp lệ hoặc mất mạng thì giữ bản hiện tại và cho thử lại.

Mỗi thay đổi muốn đến tay người dùng vẫn cần **build và phát hành một version mới**. Người dùng thực hiện tải/cài ngay trong app; không cần tìm DMG/EXE hay kéo app thủ công. Sửa source local chưa phát hành không tự thay đổi app trên máy người dùng. Dev UI tiếp tục hỗ trợ reload ngay khi lưu source.

## Phát hành

1. Chạy các kiểm tra trong README, cập nhật CHANGELOG và notes.
2. Tăng version trong `package.json` và lockfile (`npm version … --no-git-tag-version`).
3. Commit source đã kiểm tra, push tag `v<version>`.
4. Workflow `Build Desktop Release` build macOS arm64/x64 và Windows x64, chạy desktop smoke, xác minh chữ ký ad-hoc macOS, tạo SHA256SUMS và chỉ công bố release khi mọi job thành công. Beta/RC có dấu `-` được công bố dưới dạng prerelease.
5. Kiểm tra các file ZIP macOS và EXE Windows đã có digest do GitHub cấp; app sẽ thấy version mới trong lần kiểm tra tiếp theo. Chạy thử nâng cấp thực tế trên từng OS trước khi quảng bá hỗ trợ đầy đủ.

Không ghi đè asset của một version đã phát hành. Dùng version mới cho mọi sửa đổi. Endpoint cloud và landing page tiếp tục cung cấp link tải mới cho lần cài đầu; cập nhật desktop không phụ thuộc cache của endpoint này.

## macOS

File ZIP được kiểm tra kích thước và SHA-256, danh sách archive, mã bundle, version, CPU và `codesign --verify --deep --strict`. App mới được chuẩn bị trong thư mục bên cạnh app hiện tại. Cần quyền ghi ở thư mục chứa app, đủ dung lượng và app không chạy trực tiếp từ DMG/App Translocation. Không yêu cầu sudo và không tắt Gatekeeper.

Sau khi xác nhận, bộ cài chờ Snapkit thoát, đổi tên bản cũ thành backup rồi đặt bản mới vào đúng đường dẫn cũ. App mới báo thành công khi agent và renderer khởi động xong. Nếu khởi động thất bại, bộ cài khôi phục bản trước và mở lại. Backup chỉ được xóa sau khi bản mới xác nhận khởi động. Nếu OS không cho dừng bản lỗi, backup được giữ để khôi phục thủ công; không xóa app đang chạy.

Bản này vẫn **ad-hoc signed, chưa có Developer ID/notarization**. SHA-256 từ HTTPS/GitHub giúp kiểm tra tính toàn vẹn trong luồng phân phối này; không thay thế xác minh nhà phát hành của Apple. Do đó máy/MDM bắt buộc Developer ID có thể chặn. Cần Developer ID và notarization cho phát hành công khai đáp ứng yêu cầu đó.

## Windows

EXE NSIS được tải và xác minh SHA-256 trước khi chạy silent installer ở tài khoản người dùng hiện tại. App thoát để bộ cài cập nhật, NSIS mở lại app sau khi hoàn tất. Không xóa user data. Windows publisher signing/SmartScreen vẫn phụ thuộc chứng chỉ phát hành; phiên bản hiện tại chưa có chứng chỉ. Việc chạy được unit/browser tests trên Mac không xác nhận nâng cấp trên máy Windows thật.

## Tác vụ và cache

Cài cập nhật bị chặn nếu đang build, upload TestFlight, quay màn hình, debug hoặc có tác vụ cài thiết bị. Có thể tải cập nhật trong lúc làm việc; chỉ cài khi sẵn sàng khởi động lại.

Khi mở một version mới, Snapkit tự xóa HTTP cache cũ một lần. **Xóa cache** trong Preferences chỉ xóa HTTP cache của Electron, không xóa session/cookies/local storage, cấu hình hoặc file người dùng. Download bị hủy/thất bại được dọn; bản tải đã chuẩn bị được dọn khi thoát mà chưa cài. Sau crash, journal giúp dọn đúng staging/download do Snapkit tạo ở lần mở kế tiếp. Backup chưa khôi phục không bị tự dọn.

`npm run clean` dọn các output có thể tạo lại trong repository: `release`, `dist`, `test-results`, `playwright-report`. Dùng `npm run clean -- --keep-release` để giữ bộ cài mới. Lệnh không xóa dependencies, SDK, workspace hoặc dữ liệu app.

## Sửa lỗi chuẩn bị cập nhật (beta.21)

Updater dùng `original-fs` để sao chép/xóa bundle tải về, tránh Electron coi `app.asar` là thư mục ảo. Script helper bên trong bundle vẫn được đọc qua filesystem hỗ trợ ASAR. Mọi lỗi chuẩn bị/dọn file chuyển sang trạng thái lỗi có thể thử lại. Bản beta.19/beta.20 có thể kẹt trước khi hiện nút cài đặt; cần phục hồi/cài bản beta.21 một lần để có bộ cập nhật đã sửa. File dự án và dữ liệu tài khoản không bị xóa.
