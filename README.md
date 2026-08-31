# Snapkit

Monorepo privacy-first được tách để phát triển, kiểm thử và deploy độc lập.

```text
app/            Flutter iOS/Android
admin/          Next.js admin portal, SeraUI source components
backend/        Next.js REST API, auth, Prisma và migrations
infra/          Nginx reverse proxy
scripts/        Bootstrap, deploy, smoke test và database backup/restore
design-system/  Visual language dùng chung
```

## Kiến trúc

- `app/` xử lý media trên thiết bị; khi Admin bật đồng bộ preview, app gửi thumbnail, ảnh preview chất lượng cao và video trong giới hạn cấu hình. Tên file không được gửi.
- `admin/` không truy cập database trực tiếp. Server Components gọi `BACKEND_INTERNAL_URL`; request trình duyệt đi qua `/backend/*` để giữ cookie HttpOnly cùng origin.
- `backend/` là chủ sở hữu duy nhất của API, JWT, refresh-token rotation/revocation, RBAC, Prisma schema, migrations và seed.
- Production dùng Postgres, migrate job, backend, admin và Nginx trong các container riêng.

```text
Flutter ─────────────── /api/* ─┐
Browser admin ───── /backend/* ─┼─ Nginx ─ backend:3001 ─ PostgreSQL
Browser admin ───────────── / ──┘         admin:3000
```

## Chạy local bằng một lệnh

Yêu cầu: Node 22+, pnpm 11+, Docker Desktop/OrbStack đang chạy.

### Cài pnpm khi terminal báo `command not found`

Project dùng pnpm `11.19.0`. Ưu tiên kích hoạt qua Corepack đi kèm Node.js:

```bash
corepack enable
corepack prepare pnpm@11.19.0 --activate
pnpm --version
```

Nếu máy không có lệnh `corepack`, cài bằng npm:

```bash
npm install --global pnpm@11.19.0
pnpm --version
```

Chạy các lệnh dưới đây từ thư mục gốc của project:

```bash
cd /Volumes/SanDiskSSDData/flutter_projects/tools-app
```

```bash
pnpm local:up
```

Lệnh này tự động:

1. Tạo/cập nhật env development mà không ghi đè secret đã có.
2. Cài dependencies theo lockfile.
3. Build và chạy Postgres, migration, seed, backend và admin.
4. Chạy smoke test cho health, remote config, login, cookie, RBAC dashboard và logout.

Sau khi hoàn tất:

- Admin: `http://localhost:3000/login`
- Backend: `http://localhost:3001`
- Health: `http://localhost:3001/api/health`
- Tài khoản local mặc định mới: `admin@snapkit.local` / `admin@123`.

Nếu workspace đã có `backend/.env`, tài khoản được lấy theo đúng giá trị `ADMIN_EMAIL` trong file đó.

```bash
pnpm local:logs
pnpm local:down
```

## Development có hot reload

```bash
pnpm setup
make dev-db
pnpm --dir backend db:migrate
pnpm --dir backend db:seed
pnpm dev
```

`pnpm dev` chạy admin tại port `3000` và backend tại port `3001`. Các file runtime nằm tại `admin/.env.local` và `backend/.env`; chúng không được commit.

### Đổi tài khoản hoặc mật khẩu admin local

Không sửa mật khẩu trong README hoặc form đăng nhập. Hãy sửa đúng file env theo cách đang chạy project. Development yêu
cầu tối thiểu 8 ký tự; production vẫn yêu cầu tối thiểu 12 ký tự và bước kiểm tra deploy yêu cầu tối thiểu 16 ký tự.

Nếu chạy toàn bộ stack bằng Docker (`pnpm local:up`), sửa file `.env` ở thư mục gốc:

```dotenv
ADMIN_EMAIL=admin@snapkit.local
ADMIN_PASSWORD=admin@123
```

Sau đó cập nhật password hash trong database và đăng nhập lại:

```bash
docker compose -f docker-compose.dev.yml run --rm migrate pnpm -C backend db:seed
```

Nếu chạy backend bằng hot reload trên máy, sửa `backend/.env`, sau đó chạy:

```bash
pnpm --dir backend db:seed
```

Nếu chỉ có npm và dependencies đã được cài, cú pháp tương đương là:

```bash
npm --prefix backend run db:seed
```

Lưu ý: pnpm dùng `pnpm --dir backend db:seed`; npm phải dùng `npm --prefix backend run db:seed`. Không dùng
`npm --dir backend db:seed`.

### Cổng `3000` đã được sử dụng

Nếu container admin đang chiếm cổng `3000` và bạn muốn chạy Next.js hot reload:

```bash
docker compose -f docker-compose.dev.yml stop admin
pnpm --dir admin dev
```

Hoặc giữ container hiện tại và chạy admin source trên cổng khác:

```bash
pnpm --dir admin exec next dev --port 3002
```

### Flutter

```bash
make dev-app-ios
make dev-app-ios-device
make dev-app-android
```

- iOS simulator dùng `http://localhost:3001`.
- Android emulator dùng `http://10.0.2.2:3001`.
- `make dev-app-ios-device` tự tìm IP LAN đang hoạt động, kiểm tra backend rồi tạo
  `app/config/development.device.json` cục bộ trước khi chạy trên iPhone thật.
- Trong VS Code/Antigravity, chọn `Snapkit · iPhone thật`; pre-launch task thực hiện cùng bước tự động nên không cần
  hard-code hoặc cập nhật IP khi đổi Wi-Fi.
- Có thể đặt `SNAPKIT_DEVICE_HOST=<hostname-or-ip>` khi cần override lựa chọn interface tự động.
- App bắt buộc đăng nhập Google trước khi mở các công cụ. Cần cấu hình Web/Android/iOS OAuth credentials theo [hướng dẫn Google Sign-In](docs/google-sign-in.md).

### Theme từ admin và QR Studio

Trong `Admin → Cấu hình app`, quản trị viên có thể phát hành từ xa:

- 6 preset: Midnight Lime, Ocean Cyan, Violet Pulse, Sunset Coral, Mint Light và Threads Mono.
- Chế độ `dark`, `light` hoặc theo hệ thống.
- Bottom navigation `floating`, `glass` hoặc `solid`.

Flutter đồng bộ cấu hình khi mở app và khi quay lại foreground. Nếu API tạm thời không truy cập được, app giữ theme mặc định an toàn và các công cụ local vẫn hoạt động.

QR Studio hỗ trợ color picker toàn dải, HEX tùy chọn, mắt và module vuông/tròn, 5 kiểu khung gồm viền hoa/cầu vồng, logo ảnh riêng và xuất PNG vào thư viện. Khi có icon, QR tự dùng error-correction mức `H`; UI cũng chặn lưu khi foreground/background không đủ tương phản.

## Production trên `45.119.214.94`

Server cần Docker Engine + Compose plugin, Git và curl. Mở firewall TCP `22` và `80`.

Khởi tạo production secret một lần:

```bash
pnpm env:init:prod
pnpm env:check:prod
```

`env:init:prod` sinh password database, JWT secret và admin password bằng random an toàn, đặt permission `600`, và không ghi đè file đang có nếu không dùng `--force`. Hãy lưu `ADMIN_PASSWORD` vào password manager.

Sau khi đưa source code và `.env.prod` lên server:

```bash
PUBLIC_URL=http://45.119.214.94 pnpm prod:deploy
```

Deploy script sẽ validate secret, validate Compose, build image, chạy migration/seed, đợi healthcheck và thực hiện smoke test có xác thực. Các service có restart policy, log rotation, healthcheck và Nginx rate limit/security headers.

### Build trực tiếp trên GitHub

Repository có GitHub Actions để build admin/backend thành Docker image trên GitHub Container Registry và deploy qua SSH. VPS chỉ pull image theo commit SHA, chạy migration, healthcheck và smoke test; không build source lại.

Hướng dẫn thiết lập VPS, SSH deploy key, GitHub Environment, Variables và Secrets nằm tại [docs/github-actions-deploy.md](docs/github-actions-deploy.md).

- `.github/workflows/ci.yml`: CI cho pull request hoặc khi chạy thủ công.
- `.github/workflows/production.yml`: quality gate → GHCR images → production deploy.
- `scripts/github-deploy.sh`: backup, migrate, healthcheck, smoke test và rollback container.
- `docker-compose.github.yml`: dùng image bất biến từ GHCR.

Các lệnh vận hành:

```bash
pnpm prod:logs
pnpm prod:backup
make prod-restore BACKUP=backups/snapkit-YYYYMMDDTHHMMSSZ.sql.gz
pnpm prod:down
docker compose -f docker-compose.prod.yml ps
```

Restore là thao tác thay thế dữ liệu và bắt buộc xác nhận tường minh. Nên chạy `pnpm prod:backup` trước mỗi deploy quan trọng và lên lịch backup ngoài server.

## Android/iOS release build

Android upload key được tạo một lần và giữ ngoài Git:

```bash
make app-signing-init
make build-app-prod
```

Phải backup cả hai file sau ở nơi an toàn:

- `app/android/keystore/snapkit-upload.jks`
- `.android-signing.env`

iOS release compile không ký:

```bash
make build-app-ios-prod
```

Để ký và upload iOS cần Apple Developer Team/certificate/provisioning profile của chủ tài khoản.

## Domain và HTTPS

GitHub production dùng Caddy hiện hữu với URL HTTPS `https://snapkit.45-119-214-94.sslip.io`; pipeline không chiếm cổng `80/443` đang dùng bởi các dịch vụ khác. Luồng deploy Docker thủ công ở trên vẫn giữ chế độ IP-only độc lập cho môi trường chưa có reverse proxy.

Trước khi phát hành App Store/Play Store với domain riêng:

1. Trỏ domain về `45.119.214.94` và bật TLS.
2. Đổi `app/config/production.json` sang URL HTTPS.
3. Đặt `COOKIE_SECURE=true` trong `.env.prod`.
4. Bỏ Android cleartext và iOS ATS exception.
5. Thay AdMob test IDs và cấu hình IAP/server-to-server verification bằng tài khoản Apple/Google thực.
6. Cấu hình OAuth production và cân nhắc Sign in with Apple để đáp ứng App Review Guidelines.

Những giá trị này phụ thuộc tài khoản/domain bên ngoài nên không thể sinh hợp lệ từ source code.

## API chính

- `POST /api/v1/auth/anonymous|register|login|google|refresh|logout`, `GET /api/v1/auth/me`
- `GET /api/v1/config`, `GET|POST /api/v1/qr`
- `POST /api/v1/events`, `POST /api/v1/media-cleanups|media-scans`, `PUT /api/v1/media-scans/assets/:id/preview`
- `GET /api/admin/overview|users|qr|media-scans|config|audit|flags`, `GET /api/admin/media-scans/assets/:id/preview`, `PATCH /api/admin/config|flags`
- `GET /api/health`

Response thống nhất: `{ "data": ... }` hoặc `{ "error": { "code", "message" } }`.

## Kiểm tra thủ công

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
docker compose -f docker-compose.dev.yml config --quiet
docker compose -f docker-compose.prod.yml config --quiet

cd app
flutter analyze
flutter test
```
