import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', fullyParallel: false, workers: 1,
  use: { baseURL: 'http://127.0.0.1:14320', viewport: { width: 1440, height: 1000 }, headless: true },
  webServer: { command: 'node server/index.js --demo', env: { PORT: '14320' }, url: 'http://127.0.0.1:14320', reuseExistingServer: false },
});
