FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY admin/package.json ./admin/package.json
COPY backend/package.json ./backend/package.json
COPY backend/prisma ./backend/prisma
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/admin/node_modules ./admin/node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY . .
RUN pnpm --dir backend exec prisma generate && pnpm --dir backend build

# Keep database operations independent from the large Next.js builder image.
# This stage contains only a dedicated migration workspace and Prisma files
# required by `prisma migrate deploy` and the idempotent production seed.
FROM node:22-alpine AS migrator
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY admin/package.json ./admin/package.json
COPY backend/package.json ./backend/package.json
COPY backend/migrator/package.json ./backend/migrator/package.json
COPY backend/prisma ./backend/migrator/prisma
RUN pnpm install --frozen-lockfile --prod --filter @toolbox/migrator... \
    && pnpm --dir backend/migrator exec prisma generate \
    && rm -rf /root/.local/share/pnpm/store /root/.cache /tmp/*

FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/backend/public ./backend/public
COPY --from=builder --chown=nextjs:nodejs /app/backend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/backend/.next/static ./backend/.next/static
USER nextjs
EXPOSE 3001
CMD ["node", "backend/server.js"]
