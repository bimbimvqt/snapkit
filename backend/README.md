# Toolbox One Backend

Next.js Route Handlers chạy tại port `3001`. Đây là package duy nhất sở hữu auth, Prisma, database schema, migrations và seed.

```bash
cp .env.example .env.local
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Kiểm tra độc lập:

```bash
pnpm test
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```
