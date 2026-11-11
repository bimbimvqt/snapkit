import { test, expect } from './fixtures.js';
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
  await page.goto('/?lang=en'); await page.locator('[data-app-page="updates"]').click();
  await page.locator('#check-updates').click(); await expect(page.locator('#update-download')).toBeVisible(); await expect(page.locator('#update-install')).toBeHidden();
  await page.locator('#update-download').click(); await expect(page.locator('#update-progress')).toHaveAttribute('value', '50'); await expect(page.locator('#update-cancel')).toBeVisible();
  await page.locator('#update-cancel').click(); await expect(page.locator('#update-download')).toBeVisible();
  await page.evaluate(() => window.snapkitDesktop.testReady()); await expect(page.locator('#update-install')).toBeVisible();
  await page.locator('#update-install').click(); await expect(page.locator('#update-detail')).toContainText('Finish builds');
  await page.locator('[data-app-page="preferences"]').click();
  await page.locator('#clear-app-cache').click(); await expect(page.locator('#cache-result')).toHaveText('Temporary app cache cleared.');
  await page.locator('[data-app-page="updates"]').click();
  await page.evaluate(() => window.SnapkitI18n.setLanguage('vi')); await expect(page.locator('#update-install')).toHaveText('Khởi động lại và cài đặt');
  await expect(page.locator('#update-status')).toContainText('đã sẵn sàng để cài');
});

test('restart/install paints a blocking loading screen, recovers on cancel/error and keeps waiting after installer handoff', async ({ page }) => {
  await page.addInitScript(() => {
    let state = { status: 'ready', current: '0.2.0-beta.24', version: '0.2.0-beta.25' }, finish;
    window.snapkitDesktop = {
      setLanguage: async () => {}, ready: () => {}, updateState: async () => { window.updatePolls = (window.updatePolls || 0) + 1; return state; },
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
  await page.locator('[data-app-page="updates"]').click();
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
  const polls = await page.evaluate(() => window.updatePolls);
  await expect.poll(() => page.evaluate(() => window.updatePolls)).toBeGreaterThan(polls + 1);
  await expect(page.locator('#update-detail')).not.toBeEmpty();
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

test('dedicated Updates page shows background availability everywhere without forced downloads and dismisses only that version', async ({page}) => {
  await page.addInitScript(()=>{
    let state={status:'available',current:'0.2.0-beta.26',version:'0.2.0-beta.27',lastCheckedAt:1793764800000};
    window.snapkitDesktop={ready:()=>{},setLanguage:async()=>{},updateState:async()=>state,
      testUpdate:next=>state={...state,...next}, downloadUpdate:async()=>{window.downloaded=true;return state;},installUpdate:async()=>{window.installed=true;return state;}};
  });
  await page.goto('/?lang=en');
  await expect(page.locator('#update-banner')).toBeVisible();await expect(page.locator('#update-banner')).toContainText('0.2.0 (27)');
  await expect(page.locator('#update-indicator')).toHaveCount(1);await expect(page.locator('#update-indicator')).toBeVisible();
  await expect(page.locator('#panel-preferences #check-updates')).toHaveCount(0);
  await page.locator('#update-dismiss').click();await expect(page.locator('#update-banner')).toBeHidden();await expect(page.locator('#update-indicator')).toBeVisible();
  await page.evaluate(()=>window.snapkitDesktop.testUpdate({version:'0.2.0-beta.28'}));
  await expect(page.locator('#update-banner')).toBeVisible();
  await page.locator('#update-view').click();await expect(page.locator('#panel-updates')).toBeVisible();await expect(page.locator('#update-banner')).toBeHidden();
  await expect(page.locator('#breadcrumb-page')).toHaveText('Updates');await expect(page.locator('#update-last-checked')).toContainText('Last checked:');
  await expect(page.locator('#product-version')).toHaveText('0.2.0 (26)');
  await expect(page.locator('#update-download')).toBeVisible();
  await page.screenshot({path:'/tmp/snapkit-updates-page-en.png',animations:'disabled'});
  await page.evaluate(()=>window.snapkitDesktop.testUpdate({status:'ready'}));await expect(page.locator('#update-install')).toBeVisible();await expect(page.locator('#update-indicator')).toHaveText('Ready');
  await page.locator('[data-app-page="devices"]').click();await expect(page.locator('#update-banner')).toContainText('ready to install');
  await page.evaluate(()=>window.SnapkitI18n.setLanguage('vi'));
  await page.locator('#update-view').click();await expect(page.locator('#updates-title')).toHaveText('Cập nhật');await expect(page.locator('#breadcrumb-page')).toHaveText('Cập nhật');
  await expect(page.locator('#panel-updates')).toContainText('Tự động kiểm tra mỗi 10 phút');
  await page.locator('#theme-toggle').click();await page.getByRole('radio', {name:'Sáng',exact:true}).check();await page.locator('[data-app-page="updates"]').click();await page.setViewportSize({width:900,height:680});
  await page.screenshot({path:'/tmp/snapkit-updates-page-vi.png',fullPage:true,animations:'disabled'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const pinned = await page.locator('.sidebar-bottom [data-app-page="updates"]').boundingBox();
  expect(pinned.y + pinned.height).toBeLessThanOrEqual(680);
  expect(await page.evaluate(()=>!!window.downloaded||!!window.installed)).toBe(false);
});

test('updates show concise progress and keep transfer diagnostics behind a disclosure in EN/VI',async({page})=>{
  await page.addInitScript(()=>{
    let state={status:'downloading',current:'0.2.0-beta.27',version:'0.2.0-beta.28',transfer:'planning',received:0,size:120*1024**2,percent:0};
    window.snapkitDesktop={ready:()=>{},setLanguage:async()=>{},updateState:async()=>state,testUpdate:next=>state={...state,...next}};
  });
  await page.goto('/?lang=en');await page.locator('[data-app-page="updates"]').click();
  await expect(page.locator('#update-detail')).toHaveText('Preparing the update…');await expect(page.locator('#update-progress')).not.toHaveAttribute('value');
  await page.evaluate(()=>window.snapkitDesktop.testUpdate({transfer:'delta',size:2*1024**2,received:1024**2,percent:50,reused:118*1024**2}));
  await expect(page.locator('#update-detail')).toHaveText('50% downloaded');
  await expect(page.locator('#update-transfer-detail')).toBeHidden();
  await page.locator('#update-details > summary').click();
  await expect(page.locator('#update-transfer-detail')).toContainText('1.0 / 2.0 MB');await expect(page.locator('#update-transfer-detail')).toContainText('Reusing 118.0 MB');
  await page.evaluate(()=>window.snapkitDesktop.testUpdate({status:'ready',downloadSize:2*1024**2,fullSize:120*1024**2}));
  await expect(page.locator('#update-transfer-detail')).toHaveText('Smart update ready. Downloaded 2.0 MB instead of 120.0 MB.');
  await page.locator('#update-details > summary').click();
  await expect(page.locator('#update-transfer-detail')).toBeHidden();
  await expect(page.locator('#update-detail')).toBeHidden();
  await expect(page.locator('#check-updates')).toBeHidden();
  await expect(page.locator('#update-install')).toBeVisible();
  await page.evaluate(()=>window.SnapkitI18n.setLanguage('vi'));await expect(page.locator('#update-transfer-detail')).toContainText('Đã tải 2.0 MB thay vì 120.0 MB');
  await page.evaluate(()=>window.snapkitDesktop.testUpdate({status:'downloading',transfer:'full',fallback:true,size:120*1024**2,received:1024**2,percent:1}));
  await expect(page.locator('#update-transfer-detail')).toContainText('Đang dùng gói đầy đủ');await expect(page.locator('#update-cancel')).toBeVisible();
});
