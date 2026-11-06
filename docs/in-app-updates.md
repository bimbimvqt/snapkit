# Cập nhật Snapkit trong ứng dụng

Từ **0.2.0-beta.27**, mở mục **Updates / Cập nhật** được ghim ở đáy sidebar. App kiểm tra khi mở và mỗi **10 phút** trong tiến trình Electron chính, kể cả khi cửa sổ thu nhỏ. Khi máy thức dậy hoặc cửa sổ được focus, kiểm tra bù nếu lần thử gần nhất đã quá 10 phút. Không tạo lượt kiểm tra chồng nhau hoặc đổi bản đang tải, xác minh, chờ cài hay đang cài.

Khi tìm thấy bản mới, sidebar có badge và màn hình hiện thông báo **Xem cập nhật**. Có thể ẩn thông báo của phiên bản đó trong phiên app hiện tại; badge vẫn giữ. Bản mới hơn hoặc bản đã tải sẵn để cài sẽ có thông báo riêng. Không tự chuyển trang, tải file hoặc khởi động lại. Trang Cập nhật hiển thị version đang dùng, trạng thái/tiến độ, lần kiểm tra thành công gần nhất và link release notes.

Chỉ tải khi người dùng bấm **Tải bản cập nhật**. Có tiến độ tải và nút hủy. Sau khi xác minh xong, bấm **Khởi động lại và cài đặt** rồi xác nhận. Mất mạng vẫn giữ bản đã biết có thể tải, báo lỗi và thử lại ở chu kỳ tiếp theo. Đăng nhập, workspace, cấu hình, thiết bị, ảnh/video và lịch sử build được giữ nguyên. Bản trước beta.27 vẫn có mục cập nhật trong Tùy chọn và lịch kiểm tra cũ cho đến khi nâng cấp.

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


## Delta / cập nhật thông minh (beta.28)

Luồng kiểm tra/tải/xác minh/cài vẫn như trước. Điểm thay đổi là cách truyền gói cập nhật: release phát hành thêm `<ZIP-or-EXE>.blockmap.json` cho từng OS/CPU. Blockmap dùng content-defined chunks (gear32-v1, 16–256 KiB), kèm kích thước và SHA-256 của toàn gói cùng từng khối. Metadata phải có digest GitHub hợp lệ và đúng URL cố định của asset, tối đa 16 MiB; tổng khối phải khớp gói đích. Không lấy URL hay file tùy ý từ manifest.

App giữ **một gói nền** tại `<Electron userData>/updates/baseline/package.bin`, cùng metadata phiên bản/OS/CPU. Khi bản mới khởi động xong, trước khi báo ready cho helper, app sao chép và xác minh gói vừa cài để làm baseline. Có thể bootstrap từ journal chỉ chứa token của updater cũ bằng cách đối chiếu metadata GitHub của đúng phiên bản đang chạy. Không có file hoặc mất mạng khi bootstrap thì bỏ qua, không chặn app khởi động. Chỉ giữ một baseline thành công; đây là cache updater local, không phải source hay dữ liệu workspace. Xóa HTTP cache trong Preferences không xóa baseline.

Khi tải bản tiếp theo, app kiểm tra baseline đúng phiên bản/OS/CPU, đọc và xác minh toàn bộ baseline, so sánh khối, sao chép khối trùng từ local và tải phần thiếu qua các yêu cầu HTTP Range. Mỗi range tối đa 4 MiB và toàn kế hoạch tối đa 128 range. Dùng delta nếu tiết kiệm ít nhất 10%; nếu không thì tải đầy đủ. Tiến độ hiển thị **bytes truyền qua mạng của payload**, thay vì cộng phần tái sử dụng. Blockmap nhỏ được tải riêng để lập kế hoạch.

Response phải là 206, Content-Range chính xác và không nén HTTP. Response 200 bỏ qua range, dữ liệu sai, checksum không khớp, cache hỏng hay map lỗi sẽ bỏ gói ghép và tải đầy đủ một lần. Hủy tác vụ không kích hoạt fallback. Gói dựng lại phải có SHA-256 giống hệt full asset do GitHub công bố, sau đó vẫn qua kiểm tra bundle ID/version/CPU/codesign trên macOS và được xác minh lại trước cài. Không chỉnh trực tiếp ASAR/resources hay bundle đang chạy; dữ liệu tài khoản/workspace và cơ chế rollback giữ nguyên.

Người dùng updater trước beta.28 cần tải toàn bộ beta.28 một lần. Các lần sau có thể dùng delta nếu baseline còn hợp lệ và bản mới có đủ dữ liệu tái sử dụng. Cài thủ công, mất cache, đổi OS/CPU hoặc Electron/runtime thay đổi nhiều có thể cần full download. Updater dùng cùng thuật toán cho ZIP macOS và EXE Windows; dung lượng tiết kiệm phụ thuộc từng cặp phiên bản.

### GitHub API rate limits (beta.41+)

Desktop checks use `https://snapkit.vn/v1/releases/desktop`, a minimal catalog with the original GitHub asset URL, size and SHA-256 digest. The service shares a five-minute cache with website downloads and coalesces concurrent refreshes. Upstream failures return 503 with a one-minute cooldown rather than an empty catalog. Downloads and delta ranges still use the existing GitHub host allowlist and checksum validation. No GitHub credential is placed in the desktop app. Versions through beta.40 call GitHub directly and can hit an IP-based unauthenticated quota; those installations must retry after the quota reset or install beta.41 once from the official download.
