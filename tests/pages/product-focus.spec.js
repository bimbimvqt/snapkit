import { test, expect } from '@playwright/test';
for (const language of ['vi', 'en']) test(`landing explains the workflow and brings the real app capture into the first screen (${language})`, async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(new URL(language === 'en' ? 'en/' : './', baseURL).href);
  await expect(page.locator('h1')).toContainText(language === 'en' ? 'Debug multiple devices.' : 'Debug nhiều thiết bị.');
  const demo = await page.locator('.hero-screen').boundingBox();
  expect(demo.y).toBeLessThan(650);
  await expect(page.locator('.hero .secondary')).toHaveAttribute('href', language === 'en' ? 'en/#preview-title' : '#preview-title');
  await expect(page.locator('.preview-demo-link')).toHaveAttribute('href', 'demo/');
  expect(await page.locator('.hero').innerText()).not.toMatch(/\bbeta\b/i);
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('[data-visual-image]').evaluateAll(images => images.forEach(image => image.loading = 'eager'));
    await page.waitForFunction(() => [...document.querySelectorAll('[data-visual-image]')].every(image => image.complete && image.naturalWidth > 0));
    await page.screenshot({ path: `/tmp/snapkit-focus-landing-${language}-${width}.png`, fullPage: true });
  }
  await context.close();
});
