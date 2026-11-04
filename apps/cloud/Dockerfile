FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY apps/cloud/src ./apps/cloud/src
COPY apps/website ./apps/website
COPY packages/ui ./packages/ui
USER node
ENV HOST=0.0.0.0 PORT=8080 SNAPKIT_CLOUD_DATA=/data
EXPOSE 8080
CMD ["node", "apps/cloud/src/index.js"]
