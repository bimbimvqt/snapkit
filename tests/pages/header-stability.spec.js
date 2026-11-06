import { test, expect } from '@playwright/test';

for (const width of [375, 1440]) {
  for (const language of ['vi', 'en']) {
    test(`landing header stays stable through localization and reload (${language}, ${width}px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.route('**/v1/public/content', route => route.fulfill({ json: { landing: {} } }));
      await page.route('https://api.github.com/**', route => route.fulfill({ json: [] }));
      let release;
      let gate;
      await page.route('**/i18n.js*', async route => { await gate; await route.continue(); });
      const url = language === 'vi' ? './' : 'en/';
      const snapshot = () => page.locator('.header').evaluate(header => {
        const box = node => {
          const { x, y, width, height } = node.getBoundingClientRect();
          return { x, y, width, height };
        };
        return {
          text: header.textContent,
          current: header.querySelector('[data-language-select]').dataset.languageCurrent,
          checked: [...header.querySelectorAll('[data-language]')].map(node => node.getAttribute('aria-checked')),
          boxes: [header, ...header.querySelectorAll('.brand,.nav-links,.language-picker,.nav-download')].map(box)
        };
      });
      for (const reload of [false, true]) {
        gate = new Promise(resolve => { release = resolve; });
        if (reload) await page.reload({ waitUntil: 'commit' });
        else await page.goto(url, { waitUntil: 'commit' });
        // Deliberately hold localization: the initial, painted HTML must already
        // match the final header, including its label and selected menu option.
        await expect(page.locator('.header')).toBeVisible();
        await expect(page.locator('[data-language-label]')).toHaveText(language === 'vi' ? 'VN' : 'EN');
        const before = await snapshot();
        release();
        await page.waitForFunction(() => Boolean(window.SnapkitI18n));
        expect(await snapshot()).toEqual(before);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      await page.locator('.header').screenshot({ path: `/tmp/snapkit-header-${language}-${width}.png` });
    });
  }
}

for (const width of [375, 1440]) {
  for (const route of ['./', 'en/']) {
    test(`reload starts at the top after scrolling or following a section link (${route}, ${width}px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.route('**/v1/public/content', route => route.fulfill({ json: { landing: {} } }));
      await page.route('https://api.github.com/**', route => route.fulfill({ json: [] }));
      await page.goto(route + '?source=reload-test');
      await page.evaluate(() => window.scrollTo({ top: 1500, behavior: 'instant' }));
      expect(await page.evaluate(() => scrollY)).toBeGreaterThan(1000);
      await page.reload();
      expect(await page.evaluate(() => scrollY)).toBe(0);
      await expect(page.locator('.header')).toBeInViewport();
      expect(new URL(page.url()).search).toBe('?source=reload-test');
      // A fresh section link should still work; reloading it returns to the top.
      await page.goto(route + '?source=reload-test#downloads');
      await expect(page.locator('#downloads')).toBeInViewport();
      expect(await page.evaluate(() => scrollY)).toBeGreaterThan(1000);
      await page.reload();
      expect(await page.evaluate(() => scrollY)).toBe(0);
      await expect(page.locator('.header')).toBeInViewport();
      expect(new URL(page.url()).hash).toBe('');
      expect(new URL(page.url()).search).toBe('?source=reload-test');
    });
  }
}
