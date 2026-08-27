# Toolbox One Admin

Next.js admin portal chạy tại port `3000`. Package này chỉ chứa UI và không được import Prisma/database.

- Server Components gọi backend bằng `BACKEND_INTERNAL_URL`.
- Client requests dùng `/backend/*` qua rewrite cùng origin để cookie HttpOnly hoạt động ở local và production.
- UI dùng SeraUI source components trong `src/components/ui` và Toolbox One tokens trong `src/app/globals.css`.

```bash
cp .env.example .env.local
pnpm dev
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```
