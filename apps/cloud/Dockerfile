FROM node:24-alpine AS website
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts
RUN npm run build:pages

FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY apps/cloud/src ./apps/cloud/src
COPY --from=website /build/dist ./apps/website
COPY packages/ui ./packages/ui
USER node
ENV HOST=0.0.0.0 PORT=8080 SNAPKIT_CLOUD_DATA=/data
EXPOSE 8080
CMD ["node", "apps/cloud/src/index.js"]
