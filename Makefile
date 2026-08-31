.PHONY: setup local-up local-down local-logs dev-db dev-admin dev-backend dev-app-ios dev-app-ios-device dev-app-ios-device-local dev-app-android test test-admin test-backend test-app test-device-config build-admin build-backend app-signing-init build-app-prod build-app-ios-prod prod-init prod-check prod-deploy prod-backup prod-restore prod-down prod-logs smoke

setup:
	pnpm setup

local-up:
	pnpm local:up

local-down:
	pnpm local:down

local-logs:
	pnpm local:logs

dev-db:
	docker compose -f docker-compose.dev.yml up -d postgres

dev-admin:
	pnpm --dir admin dev

dev-backend:
	pnpm --dir backend dev

dev-app-ios:
	cd app && flutter run --dart-define-from-file=config/development.json

dev-app-ios-device:
	cd app && flutter run --dart-define-from-file=config/production.json

dev-app-ios-device-local:
	node scripts/device-config.mjs --check-backend
	cd app && flutter run --dart-define-from-file=config/development.device.json

dev-app-android:
	cd app && flutter run --dart-define-from-file=config/development.json --dart-define=API_BASE_URL=http://10.0.2.2:3001

test:
	pnpm --dir backend test
	pnpm --dir admin test
	cd app && flutter test

test-admin:
	pnpm --dir admin test

test-backend:
	pnpm --dir backend test

test-app:
	cd app && flutter test

test-device-config:
	node --test scripts/device-config.test.mjs

build-admin:
	pnpm --dir admin build

build-backend:
	pnpm --dir backend build

app-signing-init:
	pnpm app:signing:init

build-app-prod: app-signing-init
	set -a; . ./.android-signing.env; set +a; cd app && flutter build appbundle --release --dart-define-from-file=config/production.json

build-app-ios-prod:
	cd app && flutter build ios --release --no-codesign --dart-define-from-file=config/production.json

prod-init:
	pnpm env:init:prod

prod-check:
	pnpm env:check:prod

prod-deploy:
	pnpm prod:deploy

prod-backup:
	pnpm prod:backup

prod-restore:
	@test -n "$(BACKUP)" || (echo "Usage: make prod-restore BACKUP=backups/file.sql.gz" && exit 1)
	RESTORE_CONFIRM=snapkit pnpm prod:restore -- "$(BACKUP)"

prod-down:
	pnpm prod:down

prod-logs:
	pnpm prod:logs

smoke:
	pnpm smoke
