import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './pages-tests', workers: 1,
  use: { baseURL: 'http://127.0.0.1:14321/snapkit/', headless: true },
  webServer: [
    { command: 'node scripts/build-pages.js && node scripts/serve-pages.js', url: 'http://127.0.0.1:14321/snapkit/', reuseExistingServer: false },
    { command: 'node server/index.js --demo', env: { PORT: '14323', SNAPKIT_WEB_ORIGIN: 'http://127.0.0.1:14321' }, url: 'http://127.0.0.1:14323/', reuseExistingServer: false }
  ]
});
