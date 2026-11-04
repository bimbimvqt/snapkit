# Build & release từ workspace

Mở **Phát hành → Build & phát hành** trong Snapkit Desktop. Build chạy bằng Flutter SDK trên máy, dùng project đã chọn; không gửi source lên server Snapkit. Có trong Snapkit Desktop beta, hỗ trợ macOS cho iOS và macOS/Windows cho Android.

## Chọn đúng môi trường

1. Chọn project Flutter trong workspace.
2. Chọn **Cấu hình build**. Snapkit đọc profile Dart/Flutter từ `.vscode/launch.json`, shared Xcode schemes và các khai báo Android `productFlavors` dạng Groovy/Kotlin.
3. Chọn flavor. Nếu có profile khớp, entrypoint và defines được áp dụng cùng flavor. Nếu không có profile khớp, kiểm tra và sửa hai đường dẫn trong **Entrypoint & defines**; Snapkit không tự đoán `main_dev.dart` hay `main_prod.dart`.
4. Xem tóm tắt flavor, entrypoint và lệnh Flutter trước khi bấm build. Thay đổi ở màn hình này không thay cấu hình debug đã lưu trong workspace.

Project không có flavor dùng bản mặc định. Các cấu hình Gradle tạo động qua plugin hoặc nhiều flavor dimensions cần cấu hình variant hoàn chỉnh trong project; bộ dò tĩnh không chạy mã Gradle để suy ra các tổ hợp. Lỗi từ Flutter/Gradle/Xcode hiển thị trong log.

## APK và App Bundle

- **APK:** `flutter build apk --release`, phù hợp cài trực tiếp trên thiết bị Android.
- **App Bundle:** `flutter build appbundle --release`, tạo AAB để phân phối qua Google Play.
- Cả hai thêm `--flavor`, `--target`, `--dart-define-from-file` theo cấu hình đã xem lại. Phiên bản/số build để trống sẽ dùng `pubspec.yaml`; nhập giá trị để truyền `--build-name`/`--build-number`.
- Snapkit sử dụng cấu hình ký Android hiện có. Chữ ký release hợp lệ để publish cần được cấu hình trong project; tạo file thành công không có nghĩa Google Play đã chấp nhận bản build. Snapkit không tự tạo keystore.

## IPA dành cho TestFlight

Yêu cầu macOS, Flutter/Xcode cùng command-line tools, Apple Developer membership, distribution signing hợp lệ và ứng dụng có bundle ID tương ứng trên App Store Connect. Mỗi flavor dùng scheme/bundle ID/signing đã cấu hình trong project; tên `dev` không thay thế các điều kiện này.

Chọn **IPA TestFlight**, chọn profile/flavor dev hoặc prod rồi bấm **Build IPA TestFlight · flavor**. Chọn team và app tương ứng như hướng dẫn bên dưới. Snapkit chạy `flutter build ipa --release --export-options-plist <plist-riêng-cho-job>` cùng các đối số workspace. Mỗi job có xcconfig riêng chỉ đặt `DEVELOPMENT_TEAM`; không sửa project, bundle ID hoặc cấu hình Pod/extension. Trước build, Snapkit đọc effective build settings của scheme và yêu cầu bundle ID khớp app đã chọn. Project ký thủ công phải cung cấp ExportOptions.plist với provisioning profiles tương ứng. Có thể chọn ExportOptions.plist riêng; file phải dùng `app-store` hoặc `app-store-connect` và xuất local. Snapkit từ chối plist có `destination=upload` để build không tự upload.

Bản IPA đã ký được lưu lại trước khi hiện thao tác upload. Nếu Flutter chỉ tạo archive mà export IPA thất bại, tác vụ được báo thất bại; archive/file IPA cũ không được lấy làm kết quả mới.

## Upload riêng lên TestFlight

Trong **App Store Connect**, nhập tên team, Apple Team ID gồm 10 ký tự, Key ID, Issuer ID và chọn team API key `.p8` có quyền upload ứng dụng. File phải có tên `AuthKey_KEYID.p8` khớp Key ID. Snapkit lưu ID và đường dẫn trong dữ liệu local có quyền file 0600; không sao chép nội dung khoá, không đưa vào URL hay cloud. Chuyển/xoá file khoá thì cần cấu hình lại. Không hỗ trợ individual API key thiếu Issuer ID.

Kết nối key sẽ gọi API Apple với JWT ES256 có hạn 5 phút, tải danh sách app mà key được cấp quyền truy cập. Chọn **Team Apple → Ứng dụng trên App Store Connect**; lựa chọn được nhớ riêng theo workspace và flavor. Team ID là ID ký của Apple Developer, **khác Issuer ID**. Danh sách app xác nhận quyền của key; Team ID nhập tay được đối chiếu với build và IPA, không được suy ra từ Issuer ID.

Gợi ý team lấy từ project Xcode và chứng chỉ codesigning trong Keychain. Đây không phải danh sách tất cả team của một Apple account. Đăng nhập tại **Xcode → Settings → Accounts** để quản lý chứng chỉ/provisioning; không nhập mật khẩu Apple trong Snapkit. Email hoặc Sign in with Apple không cung cấp API công khai để đọc các developer team. API key cần là team key có quyền đọc app và upload; App Manager là lựa chọn thông dụng, cần được admin Apple cấp quyền phù hợp.

**Làm mới danh sách app** gọi lại Apple; lỗi mạng/quyền giữ nguyên dữ liệu trước đó và cho thử lại. **Cập nhật API key** thay key của đúng team; **Gỡ kết nối team** xóa ID/đường dẫn local và các lựa chọn của team đó, không xóa/revoke file key trên Apple. Không tự gán key workspace cũ cho team được dò thấy. IPA cũ vẫn dùng cấu hình legacy đã lưu; các build mới yêu cầu chọn team/app rõ ràng.

Mỗi IPA giữ snapshot team/app/bundle ID khi bắt đầu. Sau export và trước upload, Snapkit đọc Info.plist cùng provisioning profile: kiểm tra TeamIdentifier, application-identifier, bundle ID, version/build và loại ký App Store; từ chối development/ad-hoc/enterprise. Đổi profile/dev/prod sau đó không chuyển IPA cũ sang app khác. Trước upload cũng xác thực lại quyền truy cập app bằng key của **team đã build IPA**. Gỡ team thì cần kết nối lại đúng team để upload bản cũ. Apple vẫn là bên kiểm tra quyền sở hữu/signing cuối cùng.

Sau khi build IPA thành công:

1. Bấm **Upload lên TestFlight**.
2. Kiểm tra lại team, app, bundle ID, flavor, version/build và tên file trong hộp xác nhận.
3. Xác nhận để upload chính file IPA đã lưu, không build lại. Agent gọi `xcrun altool --upload-app` với API key trong thư mục local qua `API_PRIVATE_KEYS_DIR`.
4. **Đã gửi đến Apple** nghĩa công cụ upload kết thúc thành công; Apple còn xử lý/kiểm tra. Quản lý export compliance, tester nội bộ/ngoài và Beta App Review trong App Store Connect. Thao tác này không publish lên App Store.

Nếu upload lỗi, bị huỷ, timeout hoặc app đóng giữa chừng, kiểm tra App Store Connect trước khi thử lại: dữ liệu có thể đã tới Apple. Snapkit không tự upload lại và không cho gửi lại tác vụ đã báo thành công. Để upload bản mới cần tăng số build đúng yêu cầu của Apple.

Cấu hình khoá và upload chỉ có trong local app/dashboard, không cho paired website gửi các thao tác này. Build từ Windows vẫn hỗ trợ Android; IPA và upload TestFlight cần macOS.

## Tiến trình, lịch sử và file kết quả

- Mỗi agent chỉ chạy một tác vụ build/upload tại một thời điểm, kể cả giữa các workspace. Lựa chọn thiết bị debug không ảnh hưởng đến release build.
- Có trạng thái chuẩn bị, đang build, lưu file, thành công/thất bại; log giữ tối đa khoảng 128 KiB. Không hiển thị phần trăm tiến trình ước lượng.
- Tác vụ giữ nguyên snapshot cấu hình khi bắt đầu. Đổi workspace không làm thay flavor/entrypoint của tác vụ đang chạy.
- Huỷ tác vụ dừng cây process do tác vụ tạo. App hỏi trước khi thoát nếu đang build/upload. Mở lại sau sự cố sẽ báo tác vụ bị gián đoạn.
- Sau khi Flutter hoàn tất, Snapkit chỉ nhận file mới hoặc file thực sự thay đổi ở đường dẫn output chuẩn. File được sao chép vào `<SnapkitData>/release-builds/<job-id>/`, tránh bị lần build sau ghi đè.
- Có lịch sử theo workspace, tải artifact và xoá bản lưu. Xoá chỉ xoá bản sao trong Snapkit; không xoá project hoặc `build/` của Flutter. Giới hạn 100 tác vụ đã lưu; chủ động dọn các bản không còn cần.
- Cần ít nhất 1 GB trống trên cả ổ workspace và ổ dữ liệu Snapkit để bắt đầu. Build thực tế có thể cần nhiều hơn.
- Không lấy file kết quả từ đường dẫn build tuỳ chỉnh hoặc symlink ngoài workspace. Cần dùng output Flutter chuẩn để Snapkit nhận diện và lưu file.

## Kiểm chứng

Test tự động dùng project tạm và adapter Flutter/Xcode giả lập, kiểm tra flavor/entrypoint/version, huỷ, artifact cũ, phân quyền, cách ly workspace và upload cần xác nhận. Demo tạo file minh hoạ không cài được và không gửi gì đến Apple. Cần kiểm tra thêm với signing/keystore/API key thực trước khi dùng phát hành sản phẩm.


## Version và cấu hình (beta.20)

Snapkit gộp cấu hình trùng theo flavor + đường dẫn entrypoint + đường dẫn defines sau khi chuẩn hóa; giữ các cấu hình khác defines/entrypoint dù cùng flavor. Cấu hình workspace chỉ xuất hiện riêng khi khác cấu hình IDE.

Phiên bản và số build được điền từ `version:` trong `pubspec.yaml` (ví dụ `1.2.118+190` thành `1.2.118` và `190`). Có thể sửa riêng cho lần build qua `--build-name`/`--build-number`, không ghi lại pubspec hay thay đổi cấu hình debug. Refresh giữ giá trị đã sửa; **Dùng phiên bản dự án** khôi phục metadata vừa đọc. Nếu bỏ trống, backend lấy giá trị project hiện tại khi bắt đầu và ghi vào snapshot của job. Không tự tăng build number hoặc truy vấn số build mới nhất của App Store Connect.

IPA TestFlight là bản release có ký distribution. Flavor dev/prod quyết định cấu hình app, không phải hai môi trường TestFlight riêng do Snapkit tạo. Nếu dev/prod dùng bundle ID khác nhau thì cần hai app tương ứng trên App Store Connect. Sau khi build IPA, upload là thao tác riêng bằng team API key. Apple xử lý/kiểm tra file trước khi chọn nhóm tester; external testing có thể cần Beta App Review, khai báo mã hóa có thể cần hoàn tất, và build hết hạn sau 90 ngày. Upload thành công không đồng nghĩa app đã được phát hành lên App Store. Apple Developer team/ký iOS app là cấu hình của workspace; độc lập với Developer ID/notarization của desktop Snapkit.
