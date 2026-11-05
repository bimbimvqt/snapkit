# Snapkit changelog

## 0.2.0-beta.34 — 2026-11-05

- Chỉnh viền chọn/focus trong onboarding, bỏ vòng viền ngoài trùng lặp và giữ focus bàn phím rõ ràng.
- Thay ký hiệu Fl/Rn bằng SVG logo Flutter và React Native từ nguồn chính thức, đóng gói sẵn để hiển thị offline.

## 0.2.0-beta.33 — 2026-11-05

- Thêm thiết lập lần đầu: Frontend (Flutter/React Native) hoặc Backend với trạng thái sắp ra mắt; đổi lựa chọn trong Preferences.
- Hỗ trợ nhận diện dự án, công cụ và thiết bị React Native mà không cần Flutter.
- Snapkit Debug Sync 1.5.0 dùng CLI của project và debugger JavaScript trong IDE để F5 trên nhiều thiết bị Hermes, breakpoint/biến riêng, Fast Refresh giữ state, Restart nhóm và Stop từng thiết bị.
- Đã kiểm tra trực tiếp VS Code với React Native 0.88.1 trên Android Emulator và iOS Simulator; Expo Go và iPhone thật chưa được hỗ trợ trong luồng này.
- Sửa tải ảnh/video khi thư mục dữ liệu có thành phần ẩn; giữ cập nhật delta và dữ liệu người dùng.
- Bao gồm migration React + TypeScript + Vite của beta.32 chưa phát hành trước đó.

## 0.2.0-beta.32 — 2026-11-04

- Chuyển frontend sang nền tảng React + TypeScript + Vite; build production dùng chung cho desktop, dashboard local và web demo/controller.
- Migrate card thiết bị và trang Cập nhật sang React, typed models/store/API adapter; các màn còn lại chạy qua ES module controllers trong quá trình chuyển đổi.
- Chỉ bundle icon được dùng, chia module và minify; JavaScript tải trong kịch bản demo giảm 25,2% so với beta.31. Chưa có bằng chứng cải thiện thời gian khởi động hoặc RAM.
- Giữ DOM/focus khi refresh, phản hồi lựa chọn thiết bị ngay khi lưu, thêm màn chờ khởi tạo và giữ các menu tùy biến EN/VI.
- Desktop dev tự build/reload giao diện khi lưu; bổ sung tài liệu kiến trúc, lộ trình migration và benchmark có thể chạy lại.

## 0.2.0-beta.31 — 2026-11-04

- Rút gọn giao diện toàn app: ưu tiên trạng thái, thao tác và thông tin cần thiết; bỏ các đoạn giới thiệu dài và khẩu hiệu trên màn hình chính.
- Cập nhật chỉ hiện tiến độ và hành động tiếp theo; thống kê delta, dung lượng, lịch kiểm tra và ghi chú phát hành nằm trong Chi tiết cập nhật.
- Thu gọn hướng dẫn editor, công cụ, lưu trữ, lệnh build/run, metadata bản build và build output; giữ lỗi và cảnh báo cài đè/xóa dữ liệu ở vị trí thao tác.
- Giữ hướng dẫn bắt đầu và hướng dẫn TestFlight đầy đủ khi người dùng mở để tra cứu; hỗ trợ EN/VI, bàn phím và màn hình nhỏ.

## 0.2.0-beta.30 — 2026-11-04

- Chỉ hiển thị editor có tích hợp Snapkit Debug Sync: VS Code, Cursor và Antigravity; giữ nhãn beta cho hai editor tương thích.
- Bỏ Android Studio, IntelliJ IDEA và Editor khác khỏi lựa chọn; cấu hình cũ không được hỗ trợ trở về VS Code.
- Giải thích lựa chọn editor chỉ lưu để hướng dẫn thiết lập, không tự mở IDE hoặc cài extension; hướng dẫn thể hiện tên editor đang chọn bằng EN/VI.

## 0.2.0-beta.29 — 2026-11-04

- Tự tìm Flutter và Android SDK trong máy và các ổ đang gắn, gồm SSD, FVM và các thư mục cài SDK phổ biến.
- Hoạt động khi mở desktop từ Finder mà PATH không có Flutter/ADB; giữ ưu tiên đường dẫn người dùng đã chọn.
- Nút Kiểm tra lại làm mới nhận diện SDK và xác thực bằng công cụ thực tế, không quét đệ quy toàn bộ ổ.
- Đồng bộ Android SDK cho các lệnh chạy/build và giữ nguyên cập nhật delta, xác minh gói và xác nhận cài đặt.

## 0.2.0-beta.28 — 2026-11-04

- Cập nhật delta theo khối dữ liệu: tái sử dụng gói nền trên máy và chỉ tải các phần thay đổi qua HTTP Range khi tiết kiệm ít nhất 10%.
- Phát hành blockmap gắn SHA-256 với đúng ZIP macOS/EXE Windows; dựng lại gói đầy đủ và xác minh trước khi dùng bộ cài hiện tại.
- Tự chuyển sang gói đầy đủ khi thiếu/sai cache, map lỗi, server không hỗ trợ Range hoặc dữ liệu ghép không khớp. Hủy tải không kích hoạt fallback.
- Giữ một gói nền của phiên bản đã khởi động; hỗ trợ lấy baseline từ lần nâng cấp bằng updater cũ trước khi helper dọn download.
- Hiển thị chuẩn bị delta, số MB thực tải/tái sử dụng và dung lượng tiết kiệm EN/VI; không vá trực tiếp bundle đang chạy.
- Giữ nguyên kiểm tra nền 10 phút, xác nhận cài, chữ ký bundle macOS và rollback.

## 0.2.0-beta.27 — 2026-11-04

- Tách Cập nhật khỏi Tùy chọn, ghim thành mục riêng ở đáy sidebar với badge bản mới/đã sẵn sàng/tiến độ tải.
- Thay lịch kiểm tra 6 giờ bằng kiểm tra khi mở và mỗi 10 phút trong tiến trình desktop; kiểm tra bù khi focus hoặc thức dậy sau sleep nếu đã tới hạn.
- Thông báo gọn ở các màn hình có nút Xem cập nhật và ẩn theo phiên bản; không tự chuyển trang, tải hoặc khởi động lại.
- Trang cập nhật có phiên bản đang dùng, lần kiểm tra gần nhất, link release notes và giữ luồng tải/xác minh/cài có xác nhận.
- Giữ bản cập nhật đã tìm thấy khi kiểm tra lại mất mạng, tránh kiểm tra chồng hoặc thay bản đang tải/chờ cài.
- Hỗ trợ EN/VI, theme sáng/tối và cửa sổ nhỏ; sửa trùng ID badge cập nhật trong phần trợ giúp.

## 0.2.0-beta.26 — 2026-11-04

- Chạy Release trực tiếp trên điện thoại Android/iPhone thật kết nối USB hoặc Wi-Fi, từ card thiết bị hoặc trang Build & phát hành.
- Chọn thiết bị bằng dropdown tùy biến; dùng flavor, entrypoint và defines của cấu hình đang chọn, lấy version từ pubspec.yaml.
- Thực thi Flutter local ở chế độ release không giữ debugger; có log, lịch sử, hủy và chặn tác vụ đồng thời.
- Chỉ nhận thiết bị thật đang online; iPhone cần macOS/Xcode và cấu hình ký của project, không yêu cầu key TestFlight.
- Không tạo bản sao artifact hay gửi app lên server Snapkit/TestFlight trong luồng chạy; giữ nguyên luồng build file và upload riêng.
- Giao diện EN/VI, trạng thái chưa kết nối/host không hỗ trợ và giải thích app có thể thay thế bản cùng bundle ID.

## 0.2.0-beta.25 — 2026-11-04

- Thêm màn hình chờ toàn cửa sổ với logo Snapkit và thanh loading khi khởi động lại để cài bản cập nhật.
- Hiển thị trước khi mở xác nhận native; che trạng thái mất kết nối của agent trong lúc thoát app.
- Bỏ vô hiệu hóa cửa sổ gây tối UI; khôi phục thao tác và focus khi hủy xác nhận hoặc cài đặt lỗi.
- Hỗ trợ EN/VI, theme sáng/tối, bàn phím và giảm chuyển động; giữ nguyên xác nhận cài đặt và kiểm tra tác vụ đang chạy.

## 0.2.0-beta.24 — 2026-11-04

- Thiết kế hướng dẫn TestFlight thành hai luồng: upload trong Snapkit bằng Team API key hoặc build/upload qua tài khoản Xcode.
- Bốn bước lấy key, trợ giúp từng trường Team ID/Key ID/Issuer ID, link Apple chính thức và hướng dẫn cho thành viên được mời.
- FAQ cho trường hợp không thấy Issuer ID, mất file .p8 hoặc dùng Individual key chưa được hỗ trợ.
- Hướng dẫn Xcode Accounts → scheme/flavor → Archive → Organizer → Upload và nút Mở Xcode trên desktop macOS.
- Nội dung EN/VI, hỗ trợ bàn phím, hai theme và bố cục nhỏ; giữ nguyên luồng build/upload cần xác nhận.

## 0.2.0-beta.23 — 2026-11-04

- Tách nút Tạo file IPA và Build cho TestFlight; không yêu cầu API key để build bằng Xcode signing.
- Tự đọc Team ID/bundle ID từ cấu hình thực của scheme; lựa chọn team kết nối trở thành tùy chọn.
- Chỉ yêu cầu kết nối App Store Connect khi upload; đối chiếu team/app với IPA đã lưu trước khi gắn đích upload.
- Tự điền Key ID từ tên file AuthKey_KEYID.p8, gợi ý/điền Team ID từ project và IPA; Issuer ID vẫn lấy từ App Store Connect.

## 0.2.0-beta.22 — 2026-11-04

- Kết nối nhiều team Apple qua team API key local, tải danh sách app từ Apple và nhớ team/app riêng theo workspace/flavor.
- Gợi ý Team ID từ project/chứng chỉ trên Mac, hướng dẫn đăng nhập Xcode và cấu hình key EN/VI.
- Đối chiếu bundle ID trước build, tạo cấu hình team/export riêng cho job; không sửa source project.
- IPA giữ nguyên team/app; kiểm tra team, bundle ID, loại ký, version/build trước upload để tránh chọn nhầm môi trường.
- Giữ tương thích IPA/cấu hình key cũ, không tự gán key cũ cho team được dò thấy.
- Kiểm tra API/JWT, signing, IPA, phân quyền local và UI bằng adapter giả lập; chưa upload thực lên Apple.

## 0.2.0-beta.21 — 2026-11-04

- Sửa cập nhật macOS bị kẹt ở bước xác minh do Electron coi app.asar là thư mục ảo khi dọn bundle giải nén.
- Dùng filesystem thật cho bundle/update cache, đọc script được đóng gói qua ASAR-aware fs, giữ khả năng rollback.
- Lỗi chuẩn bị/dọn file luôn trả về trạng thái có thể thử lại, không để giao diện chờ vô hạn.
- Thêm regression smoke chạy trong Electron thật vào kiểm tra phát hành trên macOS/Windows.


## 0.2.0-beta.20 — 2026-11-04

- Gộp cấu hình build workspace/IDE trùng flavor, entrypoint và defines, kể cả đường dẫn tương đương qua symlink. Giữ cấu hình khác nhau dù cùng flavor.
- Tự điền version và build number từ pubspec.yaml; cho sửa riêng từng build và khôi phục giá trị dự án.
- Làm mới cấu hình giữ giá trị đang sửa; xác nhận upload hiển thị version/build của IPA đã lưu.
- Hướng dẫn IPA/TestFlight EN/VI ngay trong app và thông báo rõ workspace thiếu platform.

## 0.2.0-beta.19 — 2026-11-03

- Cập nhật desktop ngay trong app: kiểm tra, tải có tiến độ/hủy, xác minh checksum và xác nhận cài riêng.
- macOS staging, xác nhận khởi động và rollback; Windows chuyển giao cho NSIS. Chặn cài khi đang build, upload, debug hoặc quay màn hình.
- Xóa HTTP cache theo version và qua nút riêng, giữ dữ liệu app. Thêm script dọn output có thể tạo lại.
- Tổ chức source theo apps/packages/domain/application/infrastructure, tách UI theo tính năng.


- Thêm Build & phát hành: APK, AAB và IPA TestFlight theo cấu hình workspace, flavor, entrypoint và defines.
- Tiến trình, log có giới hạn, huỷ cây process, lịch sử theo workspace và artifact lưu riêng từng build.
- Cấu hình App Store Connect local và xác nhận upload riêng sau IPA; upload gián đoạn yêu cầu kiểm tra Apple trước khi thử lại.
- EN/VI, dropdown tuỳ chỉnh, giao diện sáng/tối và bố cục thích ứng.

## 0.2.0-beta.18 — 2026-11-03

- Đưa viền focus bàn phím vào trong mục sidebar, tránh bị vùng cuộn cắt hai cạnh và chồng lên mục bên cạnh. Giữ phân biệt trạng thái focus và trang đang chọn trong giao diện sáng/tối.

## 0.2.0-beta.17 — 2026-11-03

- Bộ thiết bị đang chọn cho IDE có viền, nhãn và số thiết bị đã chọn/đang online; lưu theo project và giữ khi mở lại app.
- Chọn thủ công, sửa hoặc xoá bộ sẽ xoá trạng thái bộ đang chọn; bộ mới sẵn sàng có nút cập nhật lựa chọn.
- Thêm khoảng cách giữa tên thiết bị, thao tác và kết quả khởi động; hỗ trợ EN/VN và trạng thái đồng bộ IDE tạm dừng.

## 0.2.0-beta.16 — 2026-11-03

- Ảnh và video đã lưu tự hiện thumbnail trong thư viện, không cần bấm nút Xem trước để tải từng ảnh.
- Bấm thumbnail mở khung xem lớn: ảnh đúng tỷ lệ, video có phát/tạm dừng, tua và toàn màn hình; tải về ngay trong khung xem.
- Thumbnail video là ảnh tĩnh kèm biểu tượng Play. Chỉ tải các mục gần vùng hiển thị, giới hạn hai tác vụ tạo thumbnail đồng thời và giải phóng video gốc sau khi tạo ảnh đại diện.
- Có trạng thái tải, thử lại khi lỗi, đóng bằng Escape và trả focus về thumbnail; hỗ trợ EN/VN, sáng/tối và cửa sổ nhỏ.

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
