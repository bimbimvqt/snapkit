# Snapkit · Desktop Beta

**Snapkit Desktop Beta** là ứng dụng desktop cho macOS 13+ (Apple Silicon/Intel) và Windows x64. Tải bộ cài tại [GitHub Releases](https://github.com/bimbimvqt/snapkit/releases). Bản beta yêu cầu đăng nhập Google, không yêu cầu thẻ thanh toán; mở app → đăng nhập Google → **Setup & tools** → chọn project → bật thiết bị. Không cần cài Node.js để mở ứng dụng đã đóng gói.

Bản macOS ký ad-hoc, chưa có Apple Developer ID/notarization; không tự cài cập nhật. Flutter, Android SDK và Xcode là công cụ cài riêng. Windows quản lý Android; iOS Simulator cần macOS + Xcode. Device management dùng cùng mọi editor; group Flutter debug dùng VSIX cho editor tương thích VS Code. Cursor/Antigravity còn beta; chưa có plugin group debug JetBrains hoặc tích hợp React Native/Metro.

- [Luồng desktop, tình huống người dùng và lộ trình thương mại](docs/desktop-beta.md)
- [Phạm vi và giới hạn beta](docs/beta-release.md)
- [Hướng dẫn extension EN](apps/ide-extension/README.md) · [Tiếng Việt](apps/ide-extension/README.vi.md)
- [Changelog extension](apps/ide-extension/CHANGELOG.md) · [Hỗ trợ](apps/ide-extension/SUPPORT.md)
- Website: [bimbimvqt.github.io/snapkit](https://bimbimvqt.github.io/snapkit/) · dịch vụ phiên bản: [snapkit.45.119.214.94.sslip.io](https://snapkit.45.119.214.94.sslip.io/health)

Gói Free/Pro được giải thích trong app; các tính năng Pro hiện có được dùng miễn phí trong beta. RevenueCat backend đã có adapter xác minh entitlement/webhook. **Checkout luôn tắt trong beta**; account identity, luồng mua/khôi phục, giá thực từ provider và kiểm thử thanh toán là các bước bắt buộc trước khi mở bán. Không có subscription tự phát sinh khi beta kết thúc.

## Cấu trúc source

`apps/` chứa 6 ứng dụng, `packages/ui/` chứa phần giao diện dùng chung, `tests/` gom kiểm thử và `scripts/` chứa công cụ. Xem [bản đồ kiến trúc và quy tắc phụ thuộc](docs/architecture.md) để biết nơi đặt từng tính năng.

Các hướng dẫn bên dưới dành cho người chạy từ source.

**Chỉnh UI trực tiếp:** chạy `npm run desktop:dev` để mở Snapkit Dev với tự cập nhật CSS/HTML/JS và DevTools. Dùng `npm run desktop:dev:local` khi cần thiết bị thật. Xem [hướng dẫn phát triển desktop](docs/desktop-development.md).

Tạo và bật iOS Simulators / Android Emulators, xem thiết bị thật và chọn thiết bị debug cho **Antigravity**. Dashboard không chạy app Flutter. Debug, Hot Reload, đầu ra Dart và DevTools do IDE quản lý. Snapkit có log hệ thống, bộ thiết bị theo dự án và chụp/quay màn hình.

Xoá máy ảo: bấm biểu tượng thùng rác trên card → kiểm tra tên → **Delete device & data**. Snapkit dừng máy ảo nếu đang chạy rồi xoá bằng `simctl delete` hoặc `avdmanager delete avd`: app đã cài, dữ liệu, cài đặt và snapshot riêng của thiết bị bị xoá vĩnh viễn. Runtime iOS / Android system image dùng chung được giữ lại; thiết bị thật không hỗ trợ xoá. Thiết bị bị xoá cũng được bỏ khỏi lựa chọn debug. Phiên debug đang dùng thiết bị đó sẽ mất kết nối; Debug Sync 1.3+ giữ các phiên trên thiết bị khác tiếp tục chạy.

Website: [bimbimvqt.github.io/snapkit](https://bimbimvqt.github.io/snapkit/) · [Device Manager](https://bimbimvqt.github.io/snapkit/preview/)

## Build & phát hành

Build APK, AAB hoặc IPA TestFlight từ workspace với profile/flavor, entrypoint và defines tương ứng. Chọn team Apple/app được nhớ theo workspace/flavor, kiểm tra bundle ID và signing IPA. Có log, huỷ tác vụ, lịch sử và tải file; upload TestFlight là thao tác xác nhận riêng sau build IPA. Xem [hướng dẫn và điều kiện signing/upload](docs/release-builds.md).

## Bộ thiết bị, log và ảnh/video

Mở **Trợ giúp → Hướng dẫn bắt đầu** để xem 8 bước đầy đủ trong app, bằng EN hoặc VN.

- **Bộ thiết bị:** chọn dự án, đặt tên, chọn các máy rồi lưu. Có thể sửa hoặc xóa bộ mà không xóa thiết bị. Bấm khởi động để xem trạng thái từng máy; sau đó chọn các máy sẵn sàng cho lần debug tiếp theo trong IDE. Bộ thiết bị gắn với đường dẫn dự án; khi chuyển thư mục, chọn lại folder và tạo bộ tại vị trí mới.
- **Log thiết bị:** chọn Android hoặc iOS Simulator đang bật → bắt đầu → tìm theo package/nội dung hoặc lọc cảnh báo/lỗi → xuất các dòng đã lọc. Đây là log hệ thống; Dart print/Flutter Debug Console vẫn xem trong IDE. Xóa nội dung hiển thị không xóa log trên điện thoại. Tối đa 1.000 dòng / 1 MB mỗi luồng; tự dừng sau 60 giây không có người xem.
- **Ảnh & video:** chụp PNG hoặc quay MP4, bấm dừng để hoàn tất video rồi xem/tải/xóa trong thư viện dự án. Quay không âm thanh, tối đa 3 phút và hai phiên đồng thời. Có lối tắt trên card thiết bị đang bật. Android hỗ trợ máy ảo và điện thoại thật; iOS chỉ hỗ trợ Simulator trên macOS. Với iPhone thật, dùng Xcode/QuickTime.

Dữ liệu lưu trong `device-tools/` thuộc thư mục dữ liệu Snapkit, không nằm trong mã nguồn. Snapkit kiểm tra còn ít nhất 256 MB trước khi chụp/quay; video vẫn cần thêm dung lượng tùy màn hình. Không tự xóa ảnh/video đã lưu. Khi thoát giữa phiên quay, Snapkit yêu cầu xác nhận và dừng phiên do mình tạo; nếu app bị buộc thoát, lần mở sau sẽ báo bản quay bị gián đoạn. Không gửi log hoặc ảnh/video lên server.

## Chạy agent từ source

Cần Node.js 22.12+, Flutter SDK trên PATH, Android SDK; iOS cần macOS + Xcode.

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
5. Cài **Snapkit Debug Sync 1.3+**, **Dart** và **Flutter** trong IDE. Mở **Run and Debug**, chọn profile Flutter debug thông thường của bạn (ví dụ `dev`), bấm **F5** hoặc **Run/Debug**. Khi **Use Dashboard targets** được bật và folder khớp, extension dùng lựa chọn trên Dashboard để mở các phiên debug trong bộ nhớ. Không cần profile `Snapkit:` trong `launch.json`.

Dashboard không ghi `.vscode/launch.json`, `.vscode/settings.json`, file backup hay file nào trong repo app. Flavor, entrypoint, đường dẫn defines và ID thiết bị được lưu theo project tại thư mục dữ liệu Snapkit trên máy (`state/settings.json` và `state/workspaces.json`). Các profile dùng chung trong `launch.json` vẫn do bạn quản lý; Dashboard chỉ đọc chúng khi nhập cấu hình. Không lưu nội dung defines hoặc secret.

### Debug bình thường khi không dùng Snapkit

- **Backend tắt / không kết nối được:** Run/Debug và F5 tự dùng nguyên cấu hình IDE gốc. Không cần khởi động Snapkit để debug.
- **Backend đang chạy nhưng muốn debug thường:** tắt **Use Dashboard targets** trên Dashboard. Danh sách thiết bị được giữ để bật lại sau này. Hoặc chạy lệnh **Snapkit: Toggle Dashboard Targets** trong IDE để bật/tắt tích hợp ở cài đặt riêng của IDE.
- **Không chọn thiết bị hoặc project khác:** extension không can thiệp. Attach, chạy test, profile, release và Run Without Debugging cũng giữ luồng IDE gốc.
- **Không cài / đã tắt extension:** IDE hoạt động như trước với các profile gốc, không có phụ thuộc Snapkit trong code app.
- **Backend tắt giữa phiên debug:** các phiên đã chạy vẫn do IDE quản lý; Hot Reload, Restart và Stop tiếp tục hoạt động.

Backend online và mode bật nhưng thiết bị đã chọn bị ngắt kết nối: extension báo lỗi để cập nhật lựa chọn, tránh âm thầm chạy trên thiết bị khác. Agent mặc định `http://127.0.0.1:4310`, có thể đổi setting **Snapkit: Agent URL** trong IDE; chỉ chấp nhận HTTP loopback. Workspace chưa trust không dùng tích hợp.

Lựa chọn áp dụng ở lần Debug kế tiếp. Một lần bấm Debug khởi chạy đồng thời tất cả thiết bị đã chọn và đang online, không chờ app trên thiết bị trước sẵn sàng. Mỗi thiết bị có một phiên debug riêng; thời gian build và mở app có thể khác nhau. Flutter/Xcode có thể tự chờ khoá build khi nhiều phiên dùng chung thư mục build. Dừng một phiên đang chạy giữ các phiên đang chạy khác tiếp tục; lỗi khởi chạy nhóm vẫn hủy các phiên cùng nhóm. Giữ nguyên điều khiển IDE cho breakpoint, Hot Reload, Restart, log và DevTools.

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

## Android máy gập trong cửa sổ emulator

Máy **Snapkit Pixel Fold** dùng Android Emulator thật, dữ liệu ở SSD như các AVD khác. Bấm Start device trên Dashboard để mở cửa sổ emulator; chọn Select for IDE rồi debug trong IDE để chạy app. Trong cửa sổ Android Emulator, dùng điều khiển Fold/Unfold, Rotate và **Extended controls → Virtual sensors → Device Pose** để đổi góc bản lề. Tên/vị trí nút phụ thuộc phiên bản emulator. Dashboard không nhúng preview hay điều khiển app; source app giữ nguyên.

## Dùng trên domain GitHub

GitHub Pages chỉ phục vụ giao diện; agent local phải tiếp tục chạy trên cùng máy:

1. Mở Dashboard local → **Connect website**.
2. Bấm **Open website & connect** hoặc nhập mã ở website. Cho phép **Local network access** khi trình duyệt hỏi.
3. `/preview/` và `/control/` đều là Device Manager; `/demo/` chỉ có dữ liệu mẫu.

Mã ghép đôi dùng một lần, hết hạn sau 5 phút; phiên hết hạn sau 8 giờ hoặc khi agent restart. Token ở sessionStorage, không trong query URL. Backend chỉ bind `127.0.0.1`, kiểm tra Host/Origin, mọi request website cần token. Đổi domain bằng `SNAPKIT_WEB_ORIGIN=https://your-domain`. Không tắt bảo mật trình duyệt.

## Frontend

Dashboard dùng React + TypeScript + Vite. `npm start` và các lệnh đóng gói tự build frontend trước khi chạy. Dùng `npm run dev:dashboard` với local agent để sửa React qua Vite, hoặc `npm run desktop:dev` để rebuild và xem trực tiếp trong desktop. Xem [kiến trúc frontend](docs/frontend-architecture.md) để biết các React features đã chuyển và các controller đang giữ qua adapter.

## Dữ liệu và SDK

Cài đặt mới dùng thư mục dữ liệu chuẩn: macOS `~/Library/Application Support/Snapkit`, Windows `%APPDATA%/Snapkit`, Linux `$XDG_DATA_HOME/snapkit` hoặc `~/.local/share/snapkit`. Có thể override `SNAPKIT_DATA_ROOT`. Bản cài SSD cũ được giữ khi tìm thấy settings hiện hữu; không tự chọn một ổ ngoài chỉ vì trùng tên.

Snapkit tự tìm Flutter và Android SDK theo Preferences, environment/PATH, vị trí cài chuẩn, FVM và các thư mục SDK phổ biến trên ổ đang gắn (kể cả SSD). Không quét đệ quy toàn bộ ổ. Nút **Kiểm tra lại** làm mới kết quả tìm kiếm và chạy công cụ để xác thực; nếu SDK ở thư mục tùy biến chưa tìm được, chọn thủ công trong Preferences. AVD home hiện có được giữ; cài đặt mới dùng Android AVD home chuẩn. iOS dùng device set native/symlink hiện hữu, không tự chuyển dữ liệu sang SSD. Runtime iOS do Xcode quản lý.

SDK folder trong Preferences phải tồn tại và chứa executable tương ứng. Restart app để áp dụng đường dẫn Android SDK mới. Thay đổi cấu hình không ghi file vào project ứng dụng.

## Kiểm tra và deploy

```sh
npm run check
npm test
npm run test:ui
npm run test:pages
npm run build:pages
```

Push `main` kích hoạt GitHub Actions để kiểm tra và deploy Pages. Backend dùng Express, frontend HTML/CSS/JavaScript và Lucide local; không cần CDN.

## Build desktop

```sh
npm ci
npm run desktop:smoke
npm run desktop
# Build trên đúng OS; CI tag v*-beta.* tạo cả ba bộ cài.
CSC_IDENTITY_AUTO_DISCOVERY=false npm run desktop:dist -- --mac --arm64
```

Workflow `Build Desktop Beta` tạo DMG/ZIP cho macOS arm64/x64 và NSIS cho Windows x64, chỉ publish prerelease sau khi mọi job thành công. Không commit certificate, provider key hoặc `.env`. Bộ cài unsigned yêu cầu QA và ký số trước khi phát hành bản thương mại.

## Cloud và RevenueCat

Cloud chạy độc lập với device agent; không có API điều khiển thiết bị từ server. Cấu hình ở `apps/cloud/.env.example`; triển khai bằng `apps/cloud/compose.yaml`. Secret RevenueCat chỉ ở server. `/v1/billing/config` trả beta catalog, `/v1/releases/latest` trả bản tải theo OS/CPU, webhook xác thực qua Authorization và reconcile RevenueCat; `/v1/me/subscription` xác thực subject bằng OIDC JWT. Xem điều kiện mở bán trong `docs/desktop-beta.md`.

### Google login và quản trị

Đăng nhập qua trình duyệt hệ thống; source code và lệnh thiết bị vẫn ở máy người dùng. App cần internet để xác thực tài khoản; phiên desktop được mã hóa bằng kho bảo mật hệ điều hành, tối đa 30 ngày. Khi không thể xác thực, mở IDE để debug trực tiếp; phiên debug đang chạy không bị dừng tự động.

Trang quản trị: https://snapkit.45.119.214.94.sslip.io/admin/ (website tĩnh chuyển về địa chỉ này). Admin được cấp theo `SNAPKIT_ADMIN_EMAILS`, chỉ nhận email Google đã xác minh. Quản trị hỗ trợ khóa/mở tài khoản, mở/đóng đăng ký, nội dung landing EN/VN, thông báo trong app, phiên bản đề xuất và lịch sử thao tác. Khóa tài khoản thu hồi các phiên đăng nhập.

Cấu hình server theo `apps/cloud/.env.example`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SNAPKIT_PUBLIC_URL`, `SNAPKIT_ADMIN_EMAILS`. Redirect URI: `https://snapkit.45.119.214.94.sslip.io/auth/google/callback`. Không đưa client secret vào Git hoặc bộ cài. Dữ liệu tài khoản lưu trong `apps/cloud/data/accounts.json` trên server; cần sao lưu volume cùng dữ liệu billing. RevenueCat vẫn ở giai đoạn chuẩn bị, checkout tắt.

Cập nhật ngay trong desktop app và quy trình phát hành: [In-app updates](docs/in-app-updates.md). Dọn output có thể tạo lại: `npm run clean` (xóa cả `release/`), hoặc `npm run clean -- --keep-release`.
