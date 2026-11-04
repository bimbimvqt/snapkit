# Kiến trúc source Snapkit

Snapkit là một monorepo với sáu ứng dụng. Một `package.json` và lockfile ở root giữ các lệnh phát triển, CI và phiên bản desktop đồng bộ; không cần cài dependency riêng từng thư mục.

```text
snapkit/
├── apps/
│   ├── desktop/                 # Electron shell, native bridge, splash, icon
│   │   ├── src/
│   │   │   ├── main.cjs          # Composition root và vòng đời Electron
│   │   │   ├── preload.cjs       # IPC bridge cho renderer
│   │   │   ├── development/      # Live reload, chỉ chạy từ source
│   │   │   ├── i18n/             # Thông báo native EN/VI
│   │   │   └── splash/
│   │   └── assets/
│   ├── dashboard/               # UI dùng trong Electron và web controller
│   │   ├── index.html           # Shell và điểm vào Vite
│   │   ├── src/
│   │   │   ├── main.tsx          # Bootstrap module và React roots
│   │   │   ├── legacy/           # Controller thiết bị đang chuyển đổi
│   │   │   ├── features/
│   │   │   │   ├── devices/      # React DeviceCard, model và adapter
│   │   │   │   ├── updates/      # React UpdatePage, typed store, model
│   │   │   │   ├── account/      # Login, account UI
│   │   │   │   ├── releases/     # Build configuration, progress, artifacts, TestFlight UI
│   │   │   │   ├── device-tools/ # Device sets, logs, captures
│   │   │   │   └── workspace/    # Điều hướng, setup, preferences, plans
│   │   │   └── shared/
│   │   │       ├── api/          # HTTP client, lỗi và session context có kiểu
│   │   │       ├── types/        # Hợp đồng renderer/native
│   │   │       ├── ui/           # React hooks và icon chọn lọc
│   │   │       ├── controls/     # Dropdown tuỳ chỉnh
│   │   │       └── i18n/         # Nội dung EN/VI của dashboard
│   │   └── styles/              # Reset, tokens, layout chung, fonts
│   ├── agent/                   # Backend local, lệnh thiết bị ở máy người dùng
│   │   └── src/
│   │       ├── main.js          # Composition root, HTTP/SSE, lifecycle
│   │       ├── domain/          # Quy tắc chọn thiết bị và catalog thuần
│   │       ├── application/     # Use case, nhận các dependency qua tham số
│   │       ├── modules/         # Các dịch vụ theo tính năng
│   │       │   ├── accounts/
│   │       │   ├── devices/
│   │       │   ├── device-tools/
│   │       │   ├── diagnostics/
│   │       │   ├── ide/
│   │       │   ├── pairing/
│   │       │   ├── releases/      # Local build jobs, artifact snapshots, TestFlight
│   │       │   ├── provisioning/
│   │       │   └── workspace/
│   │       ├── infrastructure/  # Process/CLI, filesystem, storage, SDK paths
│   │       └── fixtures/        # Dữ liệu demo, không phải dữ liệu người dùng
│   ├── cloud/                   # Identity, admin, billing và release service
│   │   ├── src/
│   │   │   ├── index.js         # HTTP composition root
│   │   │   ├── accounts.js      # Google auth, sessions, admin và nội dung
│   │   │   ├── domain/          # Quy tắc entitlement/subscription thuần
│   │   │   └── infrastructure/  # RevenueCat HTTP và so sánh secret
│   │   ├── Dockerfile
│   │   ├── compose.yaml
│   │   └── .env.example
│   ├── website/                 # Landing page, admin UI, OAuth completion
│   └── ide-extension/           # VS Code-compatible extension và tài liệu đi kèm
├── packages/
│   └── ui/                      # i18n runtime, language picker CSS và logo SVG chung
├── tests/
│   ├── unit/                    # Domain, use case, adapters, API và VSIX
│   ├── e2e/                     # Dashboard trong browser
│   ├── pages/                   # Landing, demo và paired controller trên Pages
│   └── desktop/                 # Electron và live reload smoke tests
├── scripts/                     # Build, dev runner, migrations và kiểm tra kiến trúc
├── docs/
├── package.json
└── electron-builder.yml
```

## Ranh giới phụ thuộc

Luồng chọn thiết bị IDE: HTTP trong `apps/agent/src/main.js` → use case `application/select-ide-targets.js` → quy tắc `domain/device-selection.js`. Composition root cung cấp danh sách thiết bị, kiểm tra project, lưu cấu hình và phát SSE. Domain và use case không tự đọc file, gọi SDK hay dùng Express.

- `domain/` chỉ chứa logic thuần; không import framework, Node I/O hay các tầng bên ngoài. Kiến trúc CPU và thời điểm kiểm tra được truyền từ bên ngoài khi cần.
- `application/` nhận dependency qua tham số; không import `infrastructure/` hoặc `modules/`.
- `modules/` gom orchestration và các adapter theo tính năng, tái sử dụng domain và hạ tầng. Các dịch vụ hiện có vẫn ở cạnh nhau theo tính năng; chỉ tách thêm use case khi có trách nhiệm rõ ràng, không tạo tầng rỗng hoặc class chỉ để chuyển tiếp.
- `infrastructure/` chứa process, filesystem, persistence và tích hợp bên ngoài. Không import ngược application hay feature modules.
- `packages/` không import ứng dụng. Chỉ đưa code vào đây khi thực sự có nhiều ứng dụng sử dụng.
- Các ứng dụng giao tiếp qua HTTP/IPC và hợp đồng dữ liệu; không import source trực tiếp của nhau. Desktop khởi chạy agent như process, dashboard gọi API local, local account gọi cloud qua HTTPS.
- Dashboard dùng React 19 + TypeScript strict + Vite. Thiết bị và Cập nhật là React features; các màn còn lại tạm giữ controller ES module với import/export rõ ràng. `legacy/device-controller.js` giữ điều phối thiết bị và SSE qua adapter; không ghi DOM vào vùng React quản lý. Đây là migration từng phần, chưa phải toàn bộ màn hình đã viết lại bằng React. Quy ước và lộ trình: [Frontend architecture](frontend-architecture.md).

`npm run check` tự tìm file JavaScript mới, kiểm tra syntax, đường dẫn import, các ranh giới trên và chạy TypeScript cho frontend mới. Không cần thêm từng file vào một chuỗi lệnh dài trong `package.json`.

## Đặt thay đổi mới ở đâu?

| Thay đổi | Nơi sửa |
| --- | --- |
| Padding/màu/layout chung | `apps/dashboard/styles/` |
| UI bộ thiết bị, log, preview ảnh/video | `apps/dashboard/src/features/device-tools/` |
| Quy tắc chọn thiết bị | `apps/agent/src/domain/` |
| Luồng thao tác nhiều dependency | `apps/agent/src/application/` |
| Chạy adb, simctl, Flutter CLI | Module tính năng và `apps/agent/src/infrastructure/process/` |
| Splash, native dialog, Electron IPC | `apps/desktop/src/` |
| Entitlement Free/Pro | `apps/cloud/src/domain/` |
| Gọi RevenueCat | `apps/cloud/src/infrastructure/` |
| Landing/admin UI | `apps/website/` |
| Text EN/VI của app | `apps/dashboard/src/shared/i18n/messages.js` |
| Logo SVG dùng chung | `packages/ui/favicon.svg` |

## Lệnh và đầu ra

Các lệnh `npm start`, `npm run demo`, `npm run desktop:dev`, `npm run desktop:dev:local`, `npm test`, `npm run test:ui`, `npm run test:pages`, `npm run desktop:pack` giữ nguyên. Xem [hướng dẫn Dev](desktop-development.md).

`dist/`, `release/`, `node_modules/`, `.snapkit-dev/` và báo cáo test là đầu ra hoặc dữ liệu local, được gitignore. Không đặt source trong các thư mục này. Di chuyển source không di chuyển SnapkitData, project Flutter, máy ảo hoặc captures của người dùng.

Cloud Docker dùng build context ở root repository. Với checkout mới: `docker compose -f apps/cloud/compose.yaml config --quiet`, sau đó triển khai theo cấu hình môi trường. Trên server đang dùng cấu trúc cũ, cần chuyển `.env` và volume `data/` có kiểm soát trước khi đổi đường dẫn Compose; không chạy một volume rỗng thay cho tài khoản đang có. Việc tổ chức source không tự thay đổi deployment đang chạy.
