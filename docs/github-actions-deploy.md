# GitHub Actions build và deploy

Pipeline được thiết kế cho repository `bimbimvqt/snapkit`:

1. Pull request hoặc chạy CI thủ công: chạy typecheck, lint, test, Next.js build, Flutter analyze/test và debug APK compile.
2. Push vào `main`: chạy lại quality gate, build ba image bất biến trên GitHub (`admin`, `backend`, `migrate`) và push lên GHCR theo commit SHA.
3. Job `production` kết nối VPS bằng SSH, upload source vận hành cùng `.env.prod`, pull đúng image SHA, backup PostgreSQL, migrate, healthcheck và authenticated smoke test.
4. Nếu healthcheck hoặc smoke test lỗi, container được đưa về image SHA thành công trước đó. Database backup được giữ tại `backups/`; rollback schema database không chạy tự động.

## 1. Chuẩn bị VPS Ubuntu

Docker Engine, Docker Compose plugin, `curl` và `rsync` phải có sẵn. Trên VPS, chạy bằng tài khoản có quyền `sudo`:

```bash
sudo apt-get update
sudo apt-get install -y curl rsync
sudo adduser --disabled-password --gecos "" snapkit
sudo usermod -aG docker snapkit
sudo install -d -o snapkit -g snapkit -m 0750 /opt/snapkit
sudo install -d -o snapkit -g snapkit -m 0700 /home/snapkit/.ssh
sudo touch /home/snapkit/.ssh/authorized_keys
sudo chown snapkit:snapkit /home/snapkit/.ssh/authorized_keys
sudo chmod 0600 /home/snapkit/.ssh/authorized_keys
```

Đăng xuất/đăng nhập lại sau khi thêm group `docker`, rồi kiểm tra:

```bash
sudo -iu snapkit docker info
```

Không thêm user `snapkit` vào group `sudo`; pipeline chỉ cần Docker và quyền ghi `/opt/snapkit`.

## 2. Tạo SSH deploy key riêng

Chạy trên máy quản trị, không tạo passphrase vì key chỉ dành cho GitHub Actions:

```bash
ssh-keygen -t ed25519 -C "snapkit-github-production" -f ./snapkit-github-production
```

Thêm nội dung `snapkit-github-production.pub` vào:

```text
/home/snapkit/.ssh/authorized_keys
```

Kiểm tra trước khi cấu hình GitHub:

```bash
ssh -i ./snapkit-github-production snapkit@45.119.214.94 "docker info >/dev/null && echo ready"
```

Lấy host key từ kết nối đã được xác minh:

```bash
ssh-keyscan -H 45.119.214.94 > ./snapkit-known-hosts
```

Nên đối chiếu fingerprint với VPS trước khi dùng:

```bash
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
ssh-keyscan -t ed25519 45.119.214.94 2>/dev/null | ssh-keygen -lf -
```

Hai fingerprint phải giống nhau.

## 3. Tạo GitHub Environment

Vào `Settings → Environments → New environment`, tạo environment tên `production`. Có thể bật `Required reviewers` để mỗi lần deploy cần phê duyệt.

Environment variables:

| Variable | Giá trị hiện tại |
| --- | --- |
| `PROD_HOST` | `45.119.214.94` |
| `PROD_PORT` | `22` |
| `PROD_USER` | `snapkit` |
| `PROD_PATH` | `/opt/snapkit` |
| `PROD_PUBLIC_URL` | `https://snapkit.45-119-214-94.sslip.io` |

Environment secrets:

| Secret | Nội dung |
| --- | --- |
| `PROD_SSH_PRIVATE_KEY` | Toàn bộ file `snapkit-github-production` |
| `PROD_SSH_KNOWN_HOSTS` | Toàn bộ file `snapkit-known-hosts` |
| `PROD_ENV_FILE` | Toàn bộ file `.env.prod` đã validate |

`.env.prod` phải có `GOOGLE_OAUTH_CLIENT_IDS` trùng với Web OAuth client ID được truyền vào Flutter bằng `GOOGLE_SERVER_CLIENT_ID`. Xem [cấu hình Google Sign-In](google-sign-in.md).

Có thể cấu hình bằng GitHub CLI:

```bash
gh api --method PUT repos/bimbimvqt/snapkit/environments/production

gh variable set PROD_HOST --env production --body "45.119.214.94"
gh variable set PROD_PORT --env production --body "22"
gh variable set PROD_USER --env production --body "snapkit"
gh variable set PROD_PATH --env production --body "/opt/snapkit"
gh variable set PROD_PUBLIC_URL --env production --body "https://snapkit.45-119-214-94.sslip.io"

gh secret set PROD_SSH_PRIVATE_KEY --env production < ./snapkit-github-production
gh secret set PROD_SSH_KNOWN_HOSTS --env production < ./snapkit-known-hosts
gh secret set PROD_ENV_FILE --env production < ./.env.prod
```

Không tạo secret tên `GITHUB_TOKEN`. GitHub cấp token ngắn hạn tự động để push/pull image GHCR.

## 4. Build và deploy

Deploy tự động khi code được merge/push vào `main`:

```bash
git add .
git commit -m "feat: release snapkit"
git push origin main
```

Deploy thủ công: vào `Actions → Build and deploy production → Run workflow`, chọn branch `main`, hoặc chạy:

```bash
gh workflow run production.yml --ref main
```

Theo dõi bằng CLI:

```bash
gh run list --workflow production.yml --limit 5
RUN_ID="$(gh run list --workflow production.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
gh run watch "$RUN_ID"
```

Trên server:

```bash
cd /opt/snapkit
docker compose -f docker-compose.prod.yml -f docker-compose.github.yml ps
docker compose -f docker-compose.prod.yml -f docker-compose.github.yml logs -f --tail=150
```

## 5. HTTPS hiện tại và domain riêng sau này

VPS dùng Caddy hiện hữu và hostname miễn phí `snapkit.45-119-214-94.sslip.io`, vì vậy pipeline đã chạy HTTPS và `COOKIE_SECURE=true` dù chưa mua domain. Compose GitHub không chiếm cổng `80/443`; service `snapkit-web` được nối vào external network `mam_edge` của Caddy.

Khi có domain riêng:

1. Đổi `PROD_PUBLIC_URL` thành `https://domain-cua-ban.com`.
2. Thêm hostname mới vào Caddyfile và reload Caddy.
3. Đổi API production của Flutter sang domain HTTPS mới.
4. Loại bỏ ATS/cleartext exceptions trước khi phát hành store.
