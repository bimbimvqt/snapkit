# Toolbox One

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

- `app/` xử lý media trên thiết bị, chỉ gửi telemetry tổng hợp.
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
- Tài khoản local: `admin@toolbox.one` / `ChangeMe123!`

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

`pnpm dev` chạy admin tại port `3000` và backend tại port `3001`. Các file runtime nằm tại `admin/.env.local` và `backend/.env.local`; chúng không được commit.

### Flutter

```bash
make dev-app-ios
make dev-app-android
```

- iOS simulator dùng `http://localhost:3001`.
- Android emulator dùng `http://10.0.2.2:3001`.
- Thiết bị thật cần truyền IP LAN của máy phát triển bằng `--dart-define=API_BASE_URL=http://<LAN-IP>:3001`.

### Theme từ admin và QR Studio

Trong `Admin → Cấu hình app`, quản trị viên có thể phát hành từ xa:

- 5 preset: Midnight Lime, Ocean Cyan, Violet Pulse, Sunset Coral và Mint Light.
- Chế độ `dark`, `light` hoặc theo hệ thống.
- Bottom navigation `floating`, `glass` hoặc `solid`.

Flutter đồng bộ cấu hình khi mở app và khi quay lại foreground. Nếu API tạm thời không truy cập được, app giữ theme mặc định an toàn và các công cụ local vẫn hoạt động.

QR Studio hỗ trợ màu foreground/background/frame/icon, HEX tùy chọn, mắt và module vuông/tròn, 4 kiểu khung, border/bo góc và icon trung tâm. Khi có icon, QR tự dùng error-correction mức `H`; UI cũng chặn lưu khi foreground/background không đủ tương phản.

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
make prod-restore BACKUP=backups/toolbox-one-YYYYMMDDTHHMMSSZ.sql.gz
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

- `app/android/keystore/toolbox-upload.jks`
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

Những giá trị này phụ thuộc tài khoản/domain bên ngoài nên không thể sinh hợp lệ từ source code.

## API chính

- `POST /api/v1/auth/anonymous|register|login|refresh|logout`, `GET /api/v1/auth/me`
- `GET /api/v1/config`, `GET|POST /api/v1/qr`
- `POST /api/v1/events`, `POST /api/v1/media-cleanups`
- `GET /api/admin/overview|users|qr|config|audit|flags`, `PATCH /api/admin/config|flags`
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
