# Snapkit Backend

Next.js Route Handlers chạy tại port `3001`. Đây là package duy nhất sở hữu auth, Prisma, database schema, migrations và seed.

```bash
cp .env.example .env
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Để bật endpoint `POST /api/v1/auth/google`, đặt `GOOGLE_OAUTH_CLIENT_IDS` trong `.env` theo [hướng dẫn Google Sign-In](../docs/google-sign-in.md).

Kiểm tra độc lập:

```bash
pnpm test
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```
