import { test, expect } from '@playwright/test';
import { choose } from './choices.js';
test('release screen applies workspace profiles, builds APK and AAB with downloadable saved artifacts', async ({page}) => {
  const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/?lang=en');await page.locator('[data-app-page="releases"]').click();
  await expect(page.locator('#release-profile')).toBeEnabled(); await expect(page.locator('#release-target')).toHaveValue('lib/main_dev.dart');
  await choose(page,'release-profile','1');await expect(page.locator('#release-target')).toHaveValue('lib/main_prod.dart');await expect(page.locator('#release-flavor')).toHaveValue('prod');
  await expect(page.locator('#release-command')).toContainText('--flavor prod');
  await page.locator('#release-submit').click();await expect(page.locator('#release-status')).toHaveText('Build complete');await expect(page.locator('#release-log')).toContainText('Demo build only');
  const download=page.waitForEvent('download');await page.locator('[data-release-download]').first().click();expect((await download).suggestedFilename()).toContain('.apk');
  await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'/tmp/snapkit-release-dark.png',fullPage:true,animations:'disabled'});
  await page.locator('[name="release-format"][value="aab"]').check();await page.locator('#release-submit').click();await expect(page.locator('#release-status')).toHaveText('Build complete');await expect(page.locator('#release-monitor-title')).toContainText('App Bundle');
  await expect(page.locator('#release-history-count')).toHaveText('2');await expect(page.locator('#release-submit')).toBeEnabled();
  await page.setViewportSize({width:900,height:680});await page.locator('#theme-toggle').click();await page.evaluate(()=>window.SnapkitI18n.setLanguage('vi'));
  await expect(page.locator('#panel-releases h1')).toHaveText('Build & phát hành');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.locator('#breadcrumb-page')).toHaveText('Build & phát hành');await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'/tmp/snapkit-release-light-vi.png',fullPage:true,animations:'disabled'});expect(errors).toEqual([]);
});
test('TestFlight builds IPA first and requires a separate configured and confirmed upload', async ({page})=>{
  await page.goto('/?lang=en');await page.locator('[data-app-page="releases"]').click();await expect(page.locator('#release-profile')).toBeEnabled();
  await page.locator('[name="release-format"][value="ipa"]').check();await page.locator('#release-submit').click();await expect(page.locator('#release-status')).toHaveText('Build complete');
  await page.locator('[data-release-upload]').click();await expect(page.locator('#release-credentials')).toHaveAttribute('open','');
  await page.locator('#release-key-id').fill('AB12CD34EF');await page.locator('#release-issuer').fill('12345678-1234-1234-1234-123456789012');await page.locator('#release-key-path').fill('/demo/AuthKey_AB12CD34EF.p8');
  await page.locator('#release-key-form button[type="submit"]').click();await expect(page.locator('#release-key-status')).toHaveText('Configured for this workspace');
  await page.locator('[data-release-upload]').click();await expect(page.locator('#release-upload-dialog')).toBeVisible();await expect(page.locator('#release-status')).toHaveText('Build complete');
  await page.locator('#release-upload-confirm').click();await expect(page.locator('#release-status')).toHaveText('Sent to Apple');await expect(page.locator('#release-monitor-detail')).toContainText('Demo only');
  await page.locator('#release-key-clear').click();await expect(page.locator('#release-key-status')).toHaveText('Not configured');
});
test('release job controls cancel active builds and keep project history after navigation',async({page})=>{
  await page.goto('/?lang=en');await page.locator('[data-app-page="releases"]').click();await expect(page.locator('#release-profile')).toBeEnabled();
  await page.locator('#release-submit').click();await page.locator('[data-release-cancel]').click();await expect(page.locator('#release-status')).toHaveText('Cancelled');
  await page.locator('[data-app-page="devices"]').click();await page.locator('[data-app-page="releases"]').click();await expect(page.locator('#release-history article')).not.toHaveCount(0);
});
