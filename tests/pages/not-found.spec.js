import { test, expect } from '@playwright/test';

for (const width of [375, 768, 1440]) {
  for (const language of ['vi', 'en']) {
    test(`404 recovery is usable without JavaScript (${language}, ${width}px)`, async ({ browser }) => {
      const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width, height: 980 } });
      const page = await context.newPage();
      const response = await page.goto(`http://127.0.0.1:14321/snapkit/${language === 'en' ? 'en/' : ''}nested/missing-page/`);
      expect(response.status()).toBe(404);
      await expect(page.locator('h1')).toHaveText(language === 'en' ? 'We couldn’t find this page.' : 'Không tìm thấy trang này.');
      await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', 'noindex,follow');
      expect(await page.locator('body').evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.locator('.brand img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
      expect(await page.locator('.error-zero').evaluate(node => getComputedStyle(node).backgroundColor)).toBe('rgb(25, 28, 31)');
      await page.keyboard.press('Tab');
      await expect(page.locator('.skip-link')).toBeFocused();
      await page.keyboard.press('Enter');
      expect(page.url()).toContain('/nested/missing-page/#main');
      for (const link of await page.locator('.error-actions a,.error-links a').evaluateAll(nodes => nodes.map(node => node.href))) {
        expect((await context.request.get(link)).status(), link).toBe(200);
      }
      await page.screenshot({ path: `/tmp/snapkit-404-${language}-${width}.png`, fullPage: true });
      await page.locator('.error-actions a').first().click();
      await expect(page.locator('h1')).toBeVisible();
      expect(new URL(page.url()).pathname).toBe(`/snapkit/${language === 'en' ? 'en/' : ''}`);
      await context.close();
    });
  }
}
