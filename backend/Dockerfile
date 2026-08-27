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
