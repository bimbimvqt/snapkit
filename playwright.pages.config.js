import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/pages', workers: 1,
  use: { baseURL: 'http://127.0.0.1:14321/snapkit/', headless: true },
  webServer: [
    { command: 'node scripts/build-pages.js && node scripts/serve-pages.js', env: { SNAPKIT_PAGES_BASE: '/snapkit/' }, url: 'http://127.0.0.1:14321/snapkit/', reuseExistingServer: false },
    { command: 'node apps/agent/src/main.js --demo', env: { PORT: '14323', SNAPKIT_WEB_ORIGIN: 'http://127.0.0.1:14321' }, url: 'http://127.0.0.1:14323/', reuseExistingServer: false }
  ]
});
