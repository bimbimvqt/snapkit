import { test, expect } from '@playwright/test';
test('in-app update controls show progress, separate install action and cache feedback in EN/VI', async ({ page }) => {
  await page.addInitScript(() => {
    let state = { status: 'idle', current: '0.2.0-beta.19' };
    window.snapkitDesktop = { setLanguage: async () => {}, ready: () => {},
      updateState: async () => state,
      checkUpdates: async () => state = { status: 'available', version: '0.2.0-beta.20' },
      downloadUpdate: async () => state = { status: 'downloading', version: '0.2.0-beta.20', received: 50, size: 100, percent: 50 },
      cancelUpdate: async () => state = { status: 'available', version: '0.2.0-beta.20' },
      installUpdate: async () => { throw Error('Finish builds, uploads, recordings and debugging before installing the update.'); },
      clearCache: async () => {},
      testReady: () => state = { status: 'ready', version: '0.2.0-beta.20' }
    };
  });
  await page.goto('/?lang=en'); await page.locator('[data-app-page="preferences"]').click();
  await page.locator('#check-updates').click(); await expect(page.locator('#update-download')).toBeVisible(); await expect(page.locator('#update-install')).toBeHidden();
  await page.locator('#update-download').click(); await expect(page.locator('#update-progress')).toHaveAttribute('value', '50'); await expect(page.locator('#update-cancel')).toBeVisible();
  await page.locator('#update-cancel').click(); await expect(page.locator('#update-download')).toBeVisible();
  await page.evaluate(() => window.snapkitDesktop.testReady()); await expect(page.locator('#update-install')).toBeVisible();
  await page.locator('#update-install').click(); await expect(page.locator('#update-detail')).toContainText('Finish builds');
  await page.locator('#clear-app-cache').click(); await expect(page.locator('#cache-result')).toHaveText('Temporary app cache cleared.');
  await page.evaluate(() => window.SnapkitI18n.setLanguage('vi')); await expect(page.locator('#update-install')).toHaveText('Khởi động lại và cài đặt');
  await expect(page.locator('#update-status')).toContainText('đã sẵn sàng để cài');
});

test('restart/install paints a blocking loading screen, recovers on cancel/error and keeps waiting after installer handoff', async ({ page }) => {
  await page.addInitScript(() => {
    let state = { status: 'ready', current: '0.2.0-beta.24', version: '0.2.0-beta.25' }, finish;
    window.snapkitDesktop = {
      setLanguage: async () => {}, ready: () => {}, updateState: async () => state,
      installUpdate: () => {
        window.loadingPaintedAtInstall = document.querySelector('#update-loading').open;
        window.installCalls = (window.installCalls || 0) + 1;
        return new Promise((resolve, reject) => { finish = outcome => {
          if (outcome === 'error') return reject(Error('Could not check active tasks. Try again.'));
          if (outcome === 'success') state = { ...state, status: 'installing' };
          resolve(state);
        }; });
      },
      finishInstall: outcome => finish(outcome)
    };
  });
  await page.goto('/?lang=en');
  await page.locator('[data-app-page="preferences"]').click();
  const loading = page.locator('#update-loading');
  await expect(page.locator('#update-install')).toBeVisible();
  await page.locator('#update-install').click();
  await expect(loading).toBeVisible();
  await expect(loading).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.loadingPaintedAtInstall)).toBe(true);
  await expect(loading).toContainText('Preparing to restart');
  await expect(loading.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
  await page.keyboard.press('Escape'); await expect(loading).toBeVisible();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.querySelector('#check-updates').matches(':focus'))).toBe(false);
  await page.screenshot({ path: '/tmp/snapkit-update-loading-en.png', animations: 'disabled' });
  await page.evaluate(() => window.snapkitDesktop.finishInstall('cancel'));
  await expect(loading).toBeHidden(); await expect(page.locator('#update-install')).toBeFocused();
  await page.evaluate(() => window.SnapkitI18n.setLanguage('vi'));
  await page.locator('#update-install').click();
  await expect(loading).toContainText('Đang chuẩn bị khởi động lại');
  await expect(loading).toContainText('Dự án, thiết bị và tài khoản của bạn sẽ được giữ nguyên.');
  await expect.poll(() => page.evaluate(() => window.installCalls)).toBe(2);
  await page.evaluate(() => window.snapkitDesktop.finishInstall('error'));
  await expect(loading).toBeHidden(); await expect(page.locator('#update-detail')).not.toBeEmpty();
  await page.locator('#update-install').click();
  await expect.poll(() => page.evaluate(() => window.installCalls)).toBe(3);
  await page.evaluate(() => window.snapkitDesktop.finishInstall('success'));
  await expect(loading).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => document.documentElement.classList.add('light'));
  await page.setViewportSize({ width: 900, height: 680 });
  await expect(loading).toContainText('Vui lòng giữ máy tính bật');
  expect(await loading.locator('.update-loading-track span').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  await page.screenshot({ path: '/tmp/snapkit-update-loading-vi.png', animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
