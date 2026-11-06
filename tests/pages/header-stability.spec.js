import { test, expect } from '@playwright/test';

// Match the production policy: inline executable scripts must not be required.
test.beforeEach(async ({ page }) => {
  await page.route('**/*', async route => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://api.github.com; base-uri 'self'" } });
  });
});

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

const guideSlugs = ['flutter-multi-device-debugging', 'react-native-multi-device-debugging', 'android-emulator-ios-simulator', 'install-snapkit-macos-windows'];
for (const route of ['huong-dan/', 'en/guides/', ...guideSlugs.flatMap(slug => [`huong-dan/${slug}/`, `en/guides/${slug}/`])]) {
  test(`guide reload resets scroll while fresh deep links still work (${route})`, async ({ page }) => {
    for (const width of [375, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(route + '?source=reload-test');
      await page.evaluate(() => window.scrollTo({ top: 1200, behavior: 'instant' }));
      expect(await page.evaluate(() => scrollY)).toBeGreaterThan(300);
      await page.reload();
      expect(await page.evaluate(() => scrollY)).toBe(0);
      await expect(page.locator('.header')).toBeInViewport();
      expect(new URL(page.url()).search).toBe('?source=reload-test');
      if (route.split('/').filter(Boolean).length > (route.startsWith('en/') ? 2 : 1)) {
        await page.goto(route + '?source=reload-test#step-2');
        await expect(page.locator('#step-2')).toBeInViewport();
        await page.reload();
        expect(await page.evaluate(() => scrollY)).toBe(0);
        expect(new URL(page.url()).hash).toBe('');
      }
    }
  });
}
