FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY cloud ./cloud
COPY site ./site
COPY public/i18n.js ./public/i18n.js
COPY public/language.css ./public/language.css
COPY public/favicon.svg ./site/favicon.svg
USER node
ENV HOST=0.0.0.0 PORT=8080 SNAPKIT_CLOUD_DATA=/data
EXPOSE 8080
CMD ["node", "cloud/index.js"]
