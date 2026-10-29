# Snapkit · Flutter Device Control Center

Dashboard chạy local để quản lý iOS Simulator, Android Emulator và thiết bị thật; chọn target VS Code; chạy nhiều phiên Flutter, Hot Reload All và chụp/so sánh UI. Backend Node.js + Express, frontend HTML/CSS/JavaScript thuần, icon Lucide được phục vụ local. Không cần build frontend hoặc CDN.

## Chạy nhanh

Website: **https://bimbimvqt.github.io/snapkit/** · [Xem trước Dashboard](https://bimbimvqt.github.io/snapkit/preview/)

GitHub Pages phục vụ trang hướng dẫn và Dashboard xem trước với dữ liệu mẫu. Bản xem trước không gửi request tới backend local và không thực thi thao tác thiết bị. Điều khiển thiết bị thật cần chạy server local theo hướng dẫn dưới đây.

Yêu cầu Node.js 20+ (khuyến nghị 22 LTS), npm, Flutter SDK và toolchain của nền tảng.

```sh
git clone https://github.com/bimbimvqt/snapkit.git
cd snapkit
npm ci
npm start
```

Mở **http://127.0.0.1:4310**. Vào **Workspace settings → Choose folder**, chọn dự án Flutter có `pubspec.yaml`, rồi **Refresh devices**.

Xem giao diện với dữ liệu mẫu:

```sh
npm run demo
```

Demo dùng cùng port, cần dừng server thường trước. Banner DEMO luôn hiển thị; mọi thao tác được mô phỏng, không chạy lệnh thiết bị và không tạo ảnh chụp giả.

### macOS

1. Cài Flutter, chạy `flutter doctor` và hoàn tất hướng dẫn toolchain.
2. Cài Android Studio, Android SDK Platform-Tools và Android Emulator. Tạo AVD trong Android Studio → Device Manager.
3. Cài Xcode đầy đủ, chọn Xcode bằng `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`, mở Xcode để cài iOS runtime và chấp nhận license.
4. Thêm CLI vào PATH, ví dụ trong `~/.zshrc`:

```sh
export PATH="$HOME/development/flutter/bin:$PATH"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
```

Khởi động terminal mới, kiểm tra `flutter doctor`, `flutter devices --machine`, `emulator -list-avds`, `xcrun simctl list devices available`.

### Windows (PowerShell)

Cài Flutter + Android Studio và tạo AVD. Thêm thư mục Flutter `bin`, Android SDK `platform-tools` và `emulator` vào User PATH trong Environment Variables. Ví dụ cho phiên PowerShell hiện tại:

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:Path = "C:\src\flutter\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:Path"
npm install
npm start
```

Workspace ví dụ: `C:\Projects\my_flutter_app`. Không thêm dấu ngoặc kép vào trường nhập. Android hoạt động trên Windows; iOS Simulator và `xcrun` chỉ có trên macOS. Windows chạy Flutter qua `cmd.exe` vì launcher là `flutter.bat`; đường dẫn có dấu cách được quote. Các ký tự điều khiển shell không được chấp nhận trong lệnh Windows.

### Thiết bị thật và network

- Android: bật USB debugging, chấp nhận khóa RSA. `adb devices` phải hiển thị `device`, không phải `unauthorized`/`offline`.
- Android wireless: pair bằng `adb pair HOST:PAIR_PORT`, sau đó `adb connect HOST:DEBUG_PORT`, rồi Refresh devices. Dashboard không lưu hoặc quản lý pairing code.
- iOS: Trust máy tính, bật Developer Mode và cấu hình signing cho dự án Flutter trong Xcode. Với kết nối network, pair từ Xcode trước. Thiết bị xuất hiện khi Flutter nhận diện được.
- Không tự bật/tắt nguồn, xóa dữ liệu hay điều khiển locale/theme trên iPhone thật. Screenshot sử dụng `flutter screenshot`, phụ thuộc hỗ trợ của toolchain/thiết bị.

## Workflow

1. **Start device** khởi động máy ảo. Chờ boot hoàn tất rồi Refresh cho đến khi Flutter nhận diện được thiết bị.
2. **Set target** ghi cấu hình `Snapkit: Active Device` vào `<workspace>/.vscode/launch.json` với `deviceId` thực tế, đồng thời lưu lựa chọn trong `<SnapkitData>/state/settings.json`.
3. **Run app** chạy `flutter run --machine -d <id>` với `cwd` là workspace. Mỗi thiết bị có một phiên riêng. Xem tiến trình, build lỗi và log ở **Running sessions** / **Activity console**.
4. Từ **Device tools → Run / Debug in VS Code**, Dashboard ghi cấu hình và mở workspace qua `vscode://file/...`. Trình duyệt có thể yêu cầu mở ứng dụng. Trong VS Code (đã cài extension Flutter/Dart), chọn **Snapkit: Active Device**, nhấn **F5**. Không tự động gửi F5 hoặc thay đổi lựa chọn thiết bị toàn cục của extension.
5. **Hot reload**, **Restart**, **Stop** điều khiển phiên khởi chạy tại Dashboard. **Hot reload all** gửi `app.restart` đồng thời, `fullRestart: false`, và báo kết quả từng phiên. Không điều khiển được phiên do VS Code hay terminal khác tạo; để dùng multicast hãy Run app từ Dashboard và chỉnh code bằng editor.
6. **Camera** lưu PNG trên SSD vào `<SnapkitData>/screenshots/<workspace>-<hash>/<device>-<timestamp>.png`. Trong **Screenshots**, chọn hai ảnh rồi **Compare selected**. Không dùng ảnh minh họa trên thẻ như ảnh thật.

File `launch.json` hiện có được giữ các cấu hình khác và backup thành `launch.json.snapkit.bak` trước mỗi lần ghi. Hỗ trợ JSONC (comment và trailing comma), giữ comment/cấu hình khác và ghi file bằng atomic rename. File không hợp lệ sẽ báo lỗi và được giữ nguyên. Chọn target yêu cầu thiết bị đã online và Flutter nhận diện được ID. Khi emulator khởi động lại có thể nhận serial khác; hãy Refresh và Set target lại.

## Khả năng theo nền tảng

| Chức năng | Android emulator | iOS Simulator (macOS) | Thiết bị thật |
|---|---|---|---|
| Quét | Flutter + emulator CLI + adb | Flutter + simctl | Flutter |
| Boot / Shutdown | Có | Có | Không |
| Cold Boot | `-no-snapshot-load`, giữ data | Shutdown + boot, giữ data | Không |
| Erase data | `-wipe-data`, tự boot sau xóa | `simctl erase`, yêu cầu shutdown | Không |
| Screenshot | `adb exec-out screencap -p` | `simctl io screenshot` | Android: adb; iOS: Flutter khi được hỗ trợ |
| Light / Dark | `cmd uimode night` | `simctl ui appearance` | Android: có, tùy OS/OEM; iOS: đổi trực tiếp |
| Locale | Android 13+: `cmd locale set-app-locales`, cần application ID | Ghi AppleLanguages/AppleLocale, reboot simulator | Android 13+ per-app; iOS đổi trực tiếp |
| Resolution | `adb shell wm size`, có reset | Theo model, không đổi runtime | Không |
| Cửa sổ host | Preset resize trên macOS/Windows; hoặc native zoom controls | Preset resize trên macOS; hoặc native controls | Không áp dụng |
| RAM / CPU | Đọc AVD config hoặc `/proc/meminfo` và `getconf` | Hiển thị — vì runtime không cung cấp thông số phần cứng riêng đáng tin cậy | Android nếu đọc được; iOS hiển thị — |

Locale iOS phụ thuộc runtime và app có hỗ trợ ngôn ngữ. Android per-app locale cũng cần ứng dụng hỗ trợ và tuân theo locale hệ thống; một app tự ép locale hoặc theme sẽ không thay đổi theo các lệnh OS. Thay đổi locale/lifecycle yêu cầu dừng phiên Flutter đang quản lý trước. Preset **Desktop window** điều khiển cửa sổ theo tên thiết bị/AVD bằng AppleScript trên macOS hoặc Win32 MoveWindow trên Windows. macOS cần quyền Accessibility/Automation cho terminal chạy server; nếu chưa có quyền, UI báo lỗi và có thể dùng native controls. Một số phiên bản emulator ràng buộc tỷ lệ hoặc tên cửa sổ, nên kích thước cuối có thể khác preset. Windows host-resize chưa được kiểm thử trên máy Windows thực. Không có thao tác “xóa cache” dùng chung an toàn cho mọi app; **Cold Boot** và **Erase data** có ý nghĩa khác nhau, được tách rõ trong UI.

## Cấu trúc

```text
snapkit/
├── package.json / package-lock.json
├── public/
│   ├── index.html           # Dashboard, sessions, gallery, device tools
│   ├── styles.css          # Responsive dark/light design tokens
│   ├── app.js              # API, SSE, interaction state
│   ├── fonts.css           # Local system font stack, không CDN
│   └── favicon.svg
├── server/
│   ├── index.js            # Express routes, loopback, SSE, persistence
│   ├── cli.js              # CLI resolution, argument arrays, timeout, binary output
│   ├── storage.js          # SSD paths, temp, workspace screenshot namespaces
│   ├── folders.js          # Native folder picker
│   ├── provision.js        # Compatible catalog, create, downloads, async jobs
│   ├── discovery.js        # Merge Flutter/simctl/AVD + metadata
│   ├── devices.js          # Boot, shutdown, erase, screenshot, theme, locale
│   ├── sessions.js         # Flutter machine protocol + multicast
│   ├── windows.js          # Native window resize macOS/Windows
│   ├── workspace.js        # Validate Flutter workspace + write launch config
│   └── demo.js             # Sample data, chỉ dùng --demo
├── e2e/dashboard.spec.js    # Browser flows + responsive checks
├── playwright.config.js
├── test/
│   ├── core.test.js         # Discovery, workspace, Flutter protocol
│   └── api.test.js          # Local API + demo integration
└── scripts/migrate-storage.js # Di chuyển dữ liệu thiết bị sang SSD
```

## Cấu hình

| Biến môi trường | Ý nghĩa |
|---|---|
| `PORT` | Port HTTP, mặc định 4310 |
| `FLUTTER_WORKSPACE` | Workspace ban đầu nếu chưa có cấu hình lưu |
| `ANDROID_HOME` / `ANDROID_SDK_ROOT` | SDK root để tìm adb, emulator |
| `SNAPKIT_DATA_ROOT` | Data root trên SSD; ANDROID_AVD_HOME được đặt theo root này |
| `SNAPKIT_FLUTTER` | Đường dẫn tuyệt đối Flutter launcher, ví dụ FVM |
| `SNAPKIT_ADB` / `SNAPKIT_EMULATOR` / `SNAPKIT_XCRUN` | Ghi đè đường dẫn executable |

Nếu đã lưu workspace, `<SnapkitData>/state/settings.json` được ưu tiên (đọc fallback `.snapkit/settings.json` của phiên bản đầu). Xóa file này hoặc đổi từ UI để reset. Sau khi đổi PATH hoặc CLI override cần khởi động lại server.

```sh
PORT=4311 FLUTTER_WORKSPACE=/absolute/path/to/flutter_app npm start
```

PowerShell:

```powershell
$env:PORT = '4311'
$env:FLUTTER_WORKSPACE = 'C:\Projects\my_app'
npm start
```

## API

`GET /api/state` trả về thiết bị, settings, sessions, logs, warnings và token của local session. Frontend gửi `X-Snapkit-Token` cho mọi POST. Không log hoặc chia sẻ token.

| Method | Route | Body / kết quả |
|---|---|---|
| GET | `/api/state` | Snapshot ban đầu |
| GET | `/api/events` | SSE: devices, sessions, settings, log |
| POST | `/api/scan` | `{}` → quét mới; gộp request đồng thời |
| POST | `/api/workspace` | `{ "path": "/absolute/flutter/project" }` |
| POST | `/api/target` | `{ "id": "device-id" }` → launch.json |
| POST | `/api/devices/:id/:action` | boot, shutdown, cold-boot, erase, screenshot, appearance, locale, resolution, window-size |
| POST | `/api/sessions` | `{ "id": "device-id" }` → flutter run |
| POST | `/api/sessions/:id/:action` | reload, restart, stop |
| POST | `/api/sessions/reload-all` | `{}` → kết quả từng phiên |
| GET | `/api/screenshots` | Tên và URL các file PNG |
| GET | `/api/screenshots/:file` | Nội dung ảnh |

Body window-size: `{ "preset": "compact" }`, `comfortable` hoặc `large`.

Body thiết bị: appearance `{ "mode": "dark" }`; locale `{ "locale": "vi-VN", "package": "com.example.app" }` (package chỉ cho Android); resolution `{ "size": "1080x2400" }` hoặc `reset`; erase `{ "confirm": "device-id" }`.

Server chỉ bind `127.0.0.1`, kiểm tra Host và Origin, giới hạn body, chặn truy cập chéo origin và bảo vệ mutation bằng token. CLI dùng executable + mảng tham số (Flutter .bat trên Windows đi qua wrapper có validation). Chỉ thao tác trên ID đã phát hiện; không có API thực thi shell tùy ý. Đây là công cụ local cho người dùng máy, không phải dịch vụ multi-user; không proxy public/LAN. Screenshot và log có thể chứa thông tin dự án.

## Kiểm tra và phát triển

```sh
npm run dev       # Node watch mode
npm run check     # Kiểm tra cú pháp
npm test          # Unit + API integration; không chạy lệnh lên thiết bị thật
```

Kiểm thử trình duyệt: `npx playwright install chromium`, sau đó `npm run test:ui`. Bộ kiểm thử tự khởi động demo server ở port 14320, kiểm tra bộ lọc, chọn target, vòng đời phiên Flutter, tools, theme và layout ở 375–1440px. Không điều khiển thiết bị thật.

### Kiểm thử với thiết bị thật của bạn

1. Quét và so sánh danh sách với `flutter devices`, `emulator -list-avds`, `xcrun simctl list`.
2. Boot một AVD, chờ online, chọn workspace và Set target; kiểm tra `.vscode/launch.json`.
3. Run app trên hai thiết bị. Sửa Dart, Hot reload all, xác nhận UI thay đổi trên cả hai. Build ban đầu có thể lâu do Gradle/CocoaPods/signing.
4. Chụp hai ảnh, kiểm tra file PNG trên SSD và so sánh ở Screenshots.
5. Thử theme/locale/resolution trên máy ảo; reset resolution sau khi thử.
6. Stop phiên, Shutdown máy ảo. Chỉ thử Erase data với máy ảo có thể bỏ dữ liệu.

Không có giả định static test hoặc browser demo chứng minh build, signing, locale hay reload hoạt động trên mọi thiết bị. Các thao tác thực tế phụ thuộc Flutter SDK, Android API, runtime Xcode và cấu hình dự án.

## Chọn folder, thêm thiết bị và lưu trên SSD

**Workspace settings → Choose folder** mở hộp thoại chọn thư mục gốc của macOS/Windows ngay trên máy chạy server. Chọn folder dự án rồi **Save workspace**. Có thể nhập đường dẫn thủ công nếu môi trường không cho mở hộp thoại. Không upload dự án qua trình duyệt. Linux cần `zenity` cho hộp thoại native.

**Add device** trên thanh công cụ:

1. Chọn iOS Simulator hoặc Android Emulator.
2. Tìm model, chọn model và OS version. iOS kiểm tra `minRuntimeVersion`, `maxRuntimeVersion`, danh sách `supportedDeviceTypes` và CPU architecture của runtime; server kiểm tra lại cặp lựa chọn trước khi tạo. Android lọc ABI theo CPU máy host và tag của hardware profile.
3. Đặt tên máy, bấm **Create device**. Máy mới xuất hiện trong danh sách ở trạng thái tắt; dùng Start device để boot. Android không dùng `--force`, tránh ghi đè AVD trùng tên.
4. Android: mở **Need a different OS version? → Load downloadable versions**, chọn image có nhãn Download required, bấm **Install image**, đợi hoàn tất rồi tạo máy. Cần Android SDK Command-line Tools (`cmdline-tools/latest/bin/sdkmanager`, `avdmanager`), SDK licenses đã được chấp nhận. Không tự chấp nhận licenses. Chỉ hiển thị image cho CPU host; không giả định image Intel cũ chạy trên Apple Silicon.
5. iOS: nhập phiên bản trong **Need a different OS version?**, bấm **Download to SSD** để Xcode tải DMG. Sau đó chọn DMG và **Import runtime**, rồi Refresh installed versions. Phiên bản phải còn được Apple cung cấp và tương thích Xcode/macOS đang dùng. Download/import có thể lâu; tiến trình và lỗi hiện trong Setup output trên Dashboard. Chỉ một provisioning job được chạy tại một thời điểm.

**iPhone 5** là model 32-bit, cần tooling/runtime iOS 6–10 cũ. Xcode hiện tại trên máy này không có profile tương thích và Flutter hiện tại không hỗ trợ iOS 32-bit. UI hiển thị giải thích và chặn tạo máy; không ghép iPhone 5 với iOS 18/26 hay giả lập model bằng cách đổi tên. Để test layout nhỏ với Flutter hiện tại, dùng một model 64-bit có runtime tương thích, chẳng hạn iPhone SE được Xcode cung cấp. Hardware profile Android mô tả phần cứng/màn hình, không áp đặt lịch sử firmware của điện thoại thật.

### Đường dẫn SSD trên máy này

```text
/Volumes/SanDiskSSDData/SnapkitData/
├── Android/avd/          # AVD data, config, snapshots
├── iOS/Devices/          # iOS simulator device data
├── downloads/iOS/       # Runtime DMGs được tải qua Dashboard
├── screenshots/         # Ảnh theo tên + hash của workspace
├── state/               # Settings và lịch sử provisioning jobs
└── tmp/                 # TMPDIR/TEMP cho CLI con của server

/Volumes/SanDiskSSDData/Android/sdk/  # Android SDK/system images hiện có
```

Ảnh chụp mới được lưu trong `SnapkitData/screenshots/<workspace>-<hash>/` trên SSD, thay cho `<workspace>/screenshots` của phiên bản đầu; UI hiển thị đường dẫn thật. Hai project trùng tên có namespace riêng. Các ảnh cũ trong project không bị xóa.

Biến `SNAPKIT_DATA_ROOT` cho phép đổi nơi lưu toàn bộ dữ liệu Snapkit; trên Windows ví dụ `E:\SnapkitData`. Default của máy macOS này là `/Volumes/SanDiskSSDData/SnapkitData`, các máy khác mặc định `.snapkit/data` bên trong repo. Android SDK có thể đặt riêng trên SSD qua `ANDROID_HOME` / `ANDROID_SDK_ROOT`. Server đặt `ANDROID_AVD_HOME` theo data root và tìm sdkmanager/avdmanager trong `cmdline-tools/latest/bin`; ghi đè bằng `SNAPKIT_SDKMANAGER`, `SNAPKIT_AVDMANAGER` nếu cần. Server sẽ báo lỗi nếu volume đã cấu hình không được mount.

**iOS runtime đã import** vẫn nằm trong `/Library/Developer/CoreSimulator` do Apple/Xcode quản lý; `-exportPath` chỉ đổi nơi lưu DMG tải về, không đổi vị trí cài hệ thống. Ứng dụng không di chuyển/mount/symlink thư mục hệ thống có quyền root. Flutter build outputs, Gradle/Pub caches và file của các dự án khác vẫn theo cấu hình của chính dự án/toolchain; thiết lập này chỉ quản lý dữ liệu thiết bị và dữ liệu tạo qua Snapkit.

### Di chuyển dữ liệu máy ảo cũ (macOS)

Đã cung cấp `scripts/migrate-storage.js` để chuyển `~/.android/avd` và `~/Library/Developer/CoreSimulator/Devices` sang SSD, giữ đường dẫn mặc định bằng symlink để Flutter, VS Code, Simulator và Android Studio vẫn nhận ra thiết bị. Script kiểm tra các máy ảo đã tắt, sao chép với `rsync -aS` giữ sparse files, sau đó helper Python 3 dùng Darwin filesystem API để sao chép và xác minh extended attributes (tránh giới hạn tên file AppleDouble của rsync), kiểm tra nội dung bằng checksum, rồi mới thay đường dẫn gốc bằng symlink và xóa bản trùng trên ổ trong. Cập nhật absolute path trong AVD `.ini` tương ứng. Nếu copy/verify lỗi, dữ liệu gốc vẫn được giữ nguyên. Destination có dữ liệu không được tự merge/ghi đè; cần kiểm tra trước khi retry.

```sh
# Dừng server và tắt toàn bộ Android Emulator/iOS Simulator trước.
node scripts/migrate-storage.js
npm start
```

Không tháo SSD khi đang sử dụng máy ảo. Script dành cho macOS; trên Windows có thể đặt `SNAPKIT_DATA_ROOT` và tạo AVD mới tại SSD, dữ liệu AVD cũ cần di chuyển riêng khi emulator đã tắt.

API bổ sung: `POST /api/folders/pick`, `GET /api/provision/catalog` (thêm `?remote=1` để đọc catalog Android online), `POST /api/provision/create`, `POST /api/provision/android/install`, `POST /api/provision/ios/download`, `POST /api/provision/ios/import`. `/api/state` có `storage`, `screenshotDirectory`, `jobs`; SSE có event `jobs`. Catalog và job logs hiện tại không chứng minh một runtime tải được từ server Apple/Google; lỗi mạng, license hoặc runtime không được hỗ trợ sẽ hiện trong job.

### Khi model thiếu iOS runtime

Add device tự mở phần tải runtime nếu model chưa có phiên bản iOS tương thích đã cài. **Load Apple iOS versions** đọc danh mục từ Apple, lọc theo khoảng iOS của model cùng các yêu cầu CPU/macOS/Xcode được Apple công bố. Chọn phiên bản trong danh sách hoặc nhập tay trong khoảng hợp lệ, rồi **Download to SSD**. Sau khi tải xong, chọn DMG → **Import runtime** → **Refresh installed versions** → **Create device**. Nút **Open Xcode** mở Xcode; vào **Xcode → Settings → Components** (Platforms trên Xcode cũ) để cài theo giao diện của Apple.

Danh mục là các ứng viên để tải, không bảo đảm mọi runtime đều cài được: Xcode kiểm tra cuối cùng, một số bản cần Apple account hoặc phiên bản Xcode/macOS khác. API kiểm tra model và khoảng phiên bản trước khi bắt đầu tải. Model legacy như iPhone 5 bị chặn tải nhầm runtime hiện đại; iOS 6–10/32-bit không được toolchain hiện tại hỗ trợ. Có nút chọn lại model được hỗ trợ.

DMG tải bằng Snapkit nằm trên SSD trong `SnapkitData/downloads/iOS`. Runtime sau import vẫn ở nơi Apple quản lý; dữ liệu simulator đang chạy dùng đường dẫn hiện trong Add device. Trên máy này dữ liệu iOS dùng ổ trong sau khi phục hồi lỗi System Policy. Không có cam kết mọi thành phần iOS đều chạy hoàn toàn từ SSD.

API mới: `GET /api/provision/ios/runtimes` và `POST /api/provision/ios/xcode`; `POST /api/provision/ios/download` nhận thêm `model` để kiểm tra tương thích. Bản GitHub Pages chỉ xem được các lựa chọn mẫu, không mở Xcode hay tải runtime thật.

### macOS chặn CoreSimulator truy cập SSD

Nếu CoreSimulator báo `Operation not permitted`, `Device was allocated but was stuck in creation state`, hoặc không liệt kê được thiết bị dù dữ liệu có trên SSD, hãy kiểm tra CoreSimulator.log. macOS có thể chặn service nền truy cập ổ ngoài dù terminal đọc/ghi được. Chmod/chown không giải quyết chặn System Policy này.

Mở **System Settings → Privacy & Security → Full Disk Access**, nhấn **+**, dùng **⌘⇧G** và thêm:

```text
/Library/Developer/PrivateFrameworks/CoreSimulator.framework/Versions/A/XPCServices/com.apple.CoreSimulator.CoreSimulatorService.xpc/Contents/MacOS/com.apple.CoreSimulator.CoreSimulatorService
```

Bật quyền, thoát Simulator, khởi động lại CoreSimulatorService (hoặc đăng xuất/đăng nhập lại), rồi Refresh devices. Đây là quyền macOS cần người dùng cấp trong UI; Snapkit không sửa TCC database, vô hiệu hóa SIP hoặc tự cấp quyền. API và Add device sẽ báo hướng dẫn nếu dữ liệu SSD không thể được CoreSimulator liệt kê. Thư mục dữ liệu đã chuyển vẫn được giữ; không xóa hay Erase thiết bị để xử lý lỗi quyền.

Full Disk Access không bảo đảm CoreSimulator sẽ truy cập được ổ ngoài trên mọi phiên bản macOS. Trên máy này, chặn System Policy vẫn tồn tại sau khi cấp quyền và khởi động lại. Dữ liệu iOS được khôi phục về `~/Library/Developer/CoreSimulator/Devices` trên ổ trong để Simulator hoạt động; bản dữ liệu SSD được giữ nguyên tại `/Volumes/SanDiskSSDData/SnapkitData/iOS/Devices`. Bản SSD là bản sao tại thời điểm khôi phục, **không tự đồng bộ** với máy ảo đang chạy trên ổ trong. Android, runtime DMG tải về, screenshots và state vẫn nằm trên SSD.

Snapkit nhận diện thư mục Devices mặc định khi nó là thư mục thật, và hiển thị đúng vị trí dữ liệu iOS trong Add device. `/api/state.storage.iosOnSSD` cho biết iOS có đang dùng cấu hình SSD hay không. Không chạy lại migration chỉ để bỏ cảnh báo: script hiện kiểm tra CoreSimulator có liệt kê được các UUID cũ sau khi đổi sang symlink; nếu không, nó khôi phục thư mục gốc trước khi xóa bất kỳ bản gốc nào. Không dùng chmod 777 hay cấp quyền toàn ổ để xử lý chặn này.
