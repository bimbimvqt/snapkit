import { test as base, expect } from '@playwright/test';
// Existing feature scenarios begin after first-run setup. Onboarding has its own
// spec using the unmodified Playwright fixture, including the first-run dialog.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('**/api/product', async route => {
      const response = await route.fetch(), result = await response.json();
      result.preferences.developerProfile = { role: 'frontend', framework: 'flutter' };
      await route.fulfill({ json: result });
    });
    try { await use(page); }
    finally { await page.unrouteAll({ behavior: 'wait' }); }
  },
});
export { expect };
