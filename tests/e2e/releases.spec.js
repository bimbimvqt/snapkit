import { test, expect } from '@playwright/test';
import { choose } from './choices.js';
test('release screen applies workspace profiles, builds APK and AAB with downloadable saved artifacts', async ({page}) => {
  const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/?lang=en');await page.locator('[data-app-page="releases"]').click();
  await expect(page.locator('#release-profile')).toBeEnabled(); await expect(page.locator('#release-target')).toHaveValue('lib/main_dev.dart');
  await expect(page.locator('#release-version')).toHaveValue('1.0.0'); await expect(page.locator('#release-number')).toHaveValue('1');
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
  await page.locator('[name="release-format"][value="ipa"]').check();await expect(page.locator('#release-submit')).toBeEnabled();await page.locator('#release-use-apple').check();await expect(page.locator('#release-testflight-build')).toBeDisabled();
  await choose(page,'release-apple-team','ABCDE12345');await choose(page,'release-apple-app','1234567890');
  await expect(page.locator('#release-apple-binding')).toContainText('Saved for dev · com.snapkit.demo.dev');
  await page.locator('#release-testflight-build').click();await expect(page.locator('#release-status')).toHaveText('Build complete');
  await choose(page,'release-profile','1');await expect(page.locator('#release-apple-team')).toHaveValue('');await expect(page.locator('#release-testflight-build')).toBeDisabled();await expect(page.locator('#release-submit')).toBeEnabled();
  await choose(page,'release-apple-team','ABCDE12345');await choose(page,'release-apple-app','1234567891');
  await expect(page.locator('#release-apple-binding')).toContainText('Saved for prod · com.snapkit.demo');
  await page.locator('[data-release-upload]').click();await expect(page.locator('#release-upload-dialog')).toBeVisible();await expect(page.locator('#release-status')).toHaveText('Build complete');
  await expect(page.locator('#release-upload-summary')).toContainText('1.0.0 · #1');await expect(page.locator('#release-upload-summary')).toContainText('com.snapkit.demo.dev');
  await page.locator('#release-upload-confirm').click();await expect(page.locator('#release-status')).toHaveText('Sent to Apple');await expect(page.locator('#release-monitor-detail')).toContainText('Demo only');
  await choose(page,'release-profile','0');await expect(page.locator('#release-apple-app')).toHaveValue('1234567890');
  await page.screenshot({path:'/tmp/snapkit-apple-teams.png',fullPage:true});
});
test('refresh keeps version edits and the selected profile; reset uses the latest pubspec metadata', async ({page}) => {
  await page.goto('/?lang=en'); await page.locator('[data-app-page="releases"]').click(); await expect(page.locator('#release-profile')).toBeEnabled();
  await choose(page, 'release-profile', '1'); await page.locator('#release-version').fill('1.2.1'); await page.locator('#release-number').fill('42');
  await page.route('**/api/releases/catalog', async route => { const response = await route.fetch(); const data = await response.json(); await route.fulfill({ response, json: { ...data, version: '1.0.1+2', buildName: '1.0.1', buildNumber: '2' } }); });
  await page.locator('#release-refresh').click(); await expect(page.locator('#release-project-version')).toHaveText('1.0.1+2');
  await expect(page.locator('#release-flavor')).toHaveValue('prod'); await expect(page.locator('#release-version')).toHaveValue('1.2.1'); await expect(page.locator('#release-number')).toHaveValue('42');
  await expect(page.locator('#release-command')).toContainText('--build-name 1.2.1 --build-number 42');
  await page.locator('#release-reset-version').click(); await expect(page.locator('#release-version')).toHaveValue('1.0.1'); await expect(page.locator('#release-number')).toHaveValue('2');
  await page.locator('.release-testflight-guide summary').click(); await expect(page.locator('.release-testflight-guide')).toContainText('90 days');
});
test('release job controls cancel active builds and keep project history after navigation',async({page})=>{
  await page.goto('/?lang=en');await page.locator('[data-app-page="releases"]').click();await expect(page.locator('#release-profile')).toBeEnabled();
  await page.locator('#release-submit').click();await page.locator('[data-release-cancel]').click();await expect(page.locator('#release-status')).toHaveText('Cancelled');
  await page.locator('[data-app-page="devices"]').click();await page.locator('[data-app-page="releases"]').click();await expect(page.locator('#release-history article')).not.toHaveCount(0);
});
test('Apple setup explains local discovery, reports key errors and uses custom bilingual selectors', async ({page}) => {
  const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/?lang=en');await page.locator('[data-app-page="releases"]').click();await expect(page.locator('#release-profile')).toBeEnabled();
  await page.locator('[name="release-format"][value="ipa"]').check();await page.locator('#release-use-apple').check();await page.locator('#release-apple-connect').click();
  await expect(page.locator('#release-team-suggestions')).toContainText('Detected on this Mac:');await page.locator('[data-apple-suggest]').click();await expect(page.locator('#release-team-id')).toHaveValue('ABCDE12345');
  await page.locator('#release-key-id').fill('AB12CD34EF');await page.locator('#release-issuer').fill('12345678-1234-1234-1234-123456789012');await page.locator('#release-key-path').fill('/demo/AuthKey_AB12CD34EF.p8');
  await page.route('**/api/apple/teams',route=>route.request().method()==='POST'?route.fulfill({status:400,json:{error:'Apple rejected this API key. Check the Key ID, Issuer ID and private key.'}}):route.continue());
  await page.locator('#release-key-form button[type="submit"]').click();await expect(page.locator('#release-key-error')).toContainText('Apple rejected this API key.');
  await page.evaluate(()=>window.SnapkitI18n.setLanguage('vi'));await expect(page.locator('#release-apple-title')).toHaveText('Ký IPA & TestFlight');await expect(page.locator('#release-key-error')).toContainText('Apple từ chối API key.');
  await page.setViewportSize({width:900,height:720});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.locator('#release-apple-team')).toHaveClass(/choice-source/);await expect(page.locator('#release-apple-app')).toHaveClass(/choice-source/);
  await page.screenshot({path:'/tmp/snapkit-apple-teams-vi.png',fullPage:true});expect(errors).toEqual([]);
});
test('create IPA and prepare TestFlight are separate keyless actions, with connection requested only for upload',async({page})=>{
  await page.route('**/api/apple/teams',route=>route.fulfill({json:{teams:[],selections:{}}}));
  await page.goto('/?lang=en');await page.locator('[data-app-page="releases"]').click();await expect(page.locator('#release-profile')).toBeEnabled();await page.locator('[name="release-format"][value="ipa"]').check();
  await expect(page.locator('#release-use-apple')).not.toBeChecked();await expect(page.locator('#release-submit')).toBeEnabled();await expect(page.locator('#release-testflight-build')).toBeEnabled();await expect(page.locator('#release-connected-options')).toBeHidden();
  let request;page.on('request',r=>{if(r.url().endsWith('/api/releases/build'))request=r.postDataJSON();});
  await page.locator('#release-submit').click();await expect(page.locator('#release-status')).toHaveText('Build complete');expect(request.purpose).toBe('ipa');expect(request.apple).toBeUndefined();
  await page.locator('#release-testflight-build').click();await expect(page.locator('#release-status')).toHaveText('Build complete');expect(request.purpose).toBe('testflight');expect(request.apple).toBeUndefined();
  await page.locator('[data-release-upload]').click();await expect(page.locator('#release-credentials')).toHaveAttribute('open','');await expect(page.locator('#release-upload-dialog')).not.toBeVisible();
  await page.locator('#release-key-path').fill('/local/AuthKey_AB12CD34EF.p8');await expect(page.locator('#release-key-id')).toHaveValue('AB12CD34EF');
});
test('Apple key guide explains both roles, retains form edits and never starts a release action',async({page})=>{
  const errors=[],mutations=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',r=>{if(r.method()==='POST' && /\/api\/(releases|apple)/.test(r.url()))mutations.push(r.url());});
  await page.goto('/?lang=en');await page.locator('[data-app-page="releases"]').click();await expect(page.locator('#release-profile')).toBeEnabled();await page.locator('[name="release-format"][value="ipa"]').check();
  await page.locator('[data-apple-help="keys"]').first().click();await expect(page.locator('#apple-setup-title')).toBeFocused();await expect(page.locator('#apple-route-keys')).toBeVisible();
  await expect(page.locator('#apple-route-keys .apple-guide-steps li')).toHaveCount(4);await expect(page.locator('#apple-route-keys')).toContainText('Account Holder');await expect(page.locator('#apple-issuer-help')).toContainText('Team Keys');await expect(page.locator('#apple-team-help')).toContainText('This is not Issuer ID.');
  await expect(page.locator('#apple-route-keys a').first()).toHaveAttribute('href','https://appstoreconnect.apple.com/');
  await page.locator('#release-issuer').fill('12345678-1234-1234-1234-123456789012');
  await page.locator('[data-apple-route="xcode"]').click();await expect(page.locator('#apple-route-keys')).toBeHidden();await expect(page.locator('#apple-route-xcode')).toBeVisible();await expect(page.locator('#apple-route-xcode')).toContainText('No API key or Issuer ID is needed');await expect(page.locator('#apple-route-xcode')).toContainText('Product → Archive');await expect(page.locator('#apple-route-xcode')).toContainText('Window → Organizer');
  await page.locator('[data-apple-route="keys"]').focus();await page.keyboard.press('Enter');await expect(page.locator('#release-issuer')).toHaveValue('12345678-1234-1234-1234-123456789012');
  const individual=page.locator('.apple-setup-faq details').nth(2);await individual.locator('summary').click();await expect(individual).toContainText('This Snapkit version supports Team API keys');
  await page.evaluate(()=>window.SnapkitI18n.setLanguage('vi'));await expect(page.locator('#apple-setup-title')).toHaveText('Từ bản build trên máy đến người kiểm thử.');await expect(individual).toContainText('đừng nhập Team ID');
  await page.setViewportSize({width:900,height:720});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#release-credentials').screenshot({path:'/tmp/snapkit-apple-guide-vi.png',animations:'disabled'});
  await page.locator('#theme-toggle').click();await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>window.SnapkitI18n.setLanguage('en'));await page.locator('#release-credentials').screenshot({path:'/tmp/snapkit-apple-guide-light.png',animations:'disabled'});
  await page.setViewportSize({width:480,height:800});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(mutations).toEqual([]);expect(errors).toEqual([]);
});
test('Xcode launch is explicit, reports failure and is hidden on Windows',async({page})=>{
  await page.addInitScript(()=>{window.__xcodeCalls=0;window.snapkitDesktop={openXcode:async()=>{window.__xcodeCalls++;throw Error('not installed');}};});
  await page.goto('/?lang=en');await page.locator('[data-app-page="releases"]').click();await expect(page.locator('#release-profile')).toBeEnabled();await page.locator('[name="release-format"][value="ipa"]').check();await page.locator('[data-apple-help="xcode"]').first().click();
  await expect(page.locator('#apple-open-xcode')).toBeVisible();expect(await page.evaluate(()=>window.__xcodeCalls)).toBe(0);await page.locator('#apple-open-xcode').click();await expect(page.locator('#apple-xcode-error')).toContainText('Could not open Xcode');expect(await page.evaluate(()=>window.__xcodeCalls)).toBe(1);
  await page.evaluate(()=>window.SnapkitI18n.setLanguage('vi'));await expect(page.locator('#apple-xcode-error')).toContainText('Không mở được Xcode');
  await page.route('**/api/state',async route=>{const response=await route.fetch();await route.fulfill({response,json:{...await response.json(),platform:'win32'}});});
  await page.reload();await page.locator('[data-app-page="releases"]').click();await expect(page.locator('#release-profile')).toBeEnabled();await page.locator('#release-credentials summary').first().click();await page.locator('[data-apple-route="xcode"]').click();await expect(page.locator('#apple-open-xcode')).toBeHidden();
});

test('Run Release uses the chosen flavor and real phone, displays progress/history and does not offer IPA upload', async ({page}) => {
  await page.goto('/?lang=en'); await page.locator('[data-app-page="releases"]').click();
  await expect(page.locator('#release-profile')).toBeEnabled();
  await expect(page.locator('#release-run-submit')).toBeDisabled();
  await choose(page,'release-profile','1');
  await choose(page,'release-run-device','demo-physical-1');
  await expect(page.locator('#release-run-summary')).toContainText('iPhone 15 · prod · lib/main_prod.dart');
  await expect(page.locator('#release-run-command')).toContainText('--release --no-resident --device-id demo-physical-1 --flavor prod');
  await expect(page.locator('#release-run-command')).not.toContainText('--export-method');
  await page.locator('#release-version').fill('2.0.0');await page.locator('#release-number').fill('42');
  await expect(page.locator('#release-run-command')).not.toContainText('--build-number');
  const request=page.waitForRequest(req=>req.url().endsWith('/api/releases/run'));
  await page.locator('#release-run-submit').click();
  const payload=(await request).postDataJSON();expect(payload.deviceId).toBe('demo-physical-1');expect(payload.flavor).toBe('prod');expect(payload.target).toBe('lib/main_prod.dart');
  await expect(page.locator('#release-status')).toHaveText('Release launch complete');
  await expect(page.locator('#release-monitor-title')).toContainText('Run Release · prod');
  await expect(page.locator('#release-monitor-detail')).toContainText('iPhone 15');
  await expect(page.locator('#release-log')).toContainText('Demo run only');
  await expect(page.locator('[data-release-upload]')).toHaveCount(0);await expect(page.locator('[data-release-download]')).toHaveCount(0);
  await page.evaluate(()=>window.SnapkitI18n.setLanguage('vi'));
  await expect(page.locator('#release-run-title')).toHaveText('Chạy Release trên thiết bị thật');
  await expect(page.locator('#release-status')).toHaveText('Đã hoàn tất chạy Release');
  await page.setViewportSize({width:900,height:680});await page.locator('#theme-toggle').click();
  await page.locator('#release-run-title').scrollIntoViewIfNeeded();
  await page.locator('.release-run').screenshot({path:'/tmp/snapkit-run-release-vi.png',animations:'disabled'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('Run Release explains no connected phone and rejects iPhone launch from Windows UI', async ({page}) => {
  let connected=false;
  await page.route('**/api/state',async route=>{
    const response=await route.fetch(),data=await response.json();
    await route.fulfill({response,json:{...data,devices:data.devices.filter(device=>connected||device.group!=='physical')}});
  });
  await page.route('**/api/releases/catalog',async route=>{
    const response=await route.fetch(),data=await response.json();await route.fulfill({response,json:{...data,platform:'win32'}});
  });
  await page.goto('/?lang=en');await page.locator('[data-app-page="releases"]').click();await expect(page.locator('#release-profile')).toBeEnabled();
  await expect(page.locator('#release-run-submit')).toBeDisabled();await expect(page.locator('#release-run-note')).toContainText('Connect and unlock');
  connected=true;await page.reload();await page.locator('[data-app-page="releases"]').click();await expect(page.locator('#release-profile')).toBeEnabled();
  await choose(page,'release-run-device','demo-physical-1');
  await expect(page.locator('#release-run-submit')).toBeDisabled();await expect(page.locator('#release-run-note')).toHaveText('Running on iPhone requires macOS and Xcode.');
});

test('physical device shortcut opens Run Release with that phone selected without starting installation', async ({page}) => {
  let starts=0;page.on('request',request=>{if(request.url().endsWith('/api/releases/run'))starts++;});
  await page.goto('/?lang=en');
  await page.locator('[data-device="demo-physical-1"] [data-run-release]').click();
  await expect(page.locator('#panel-releases')).toBeVisible();await expect(page.locator('#release-run-submit')).toBeEnabled();
  await expect(page.locator('#release-run-device')).toHaveValue('demo-physical-1');
  await expect(page.locator('#release-run-summary')).toContainText('iPhone 15');expect(starts).toBe(0);
});
