import { test, expect } from '@playwright/test';
import { createCloud } from '../../apps/cloud/src/index.js';
import { defaultContent } from '../../apps/cloud/src/accounts.js';

test('login gate hides local dashboard, supports Vietnamese and opens Google flow without exposing poll credentials', async ({page}) => {
  await page.route('**/api/auth/status', route => route.fulfill({json:{required:true,authenticated:false,localToken:'local'}}));
  await page.route('**/api/auth/start', route => route.fulfill({json:{browserUrl:'https://snapkit.45.119.214.94.sslip.io/auth/google/start?desktop=test',expiresIn:600}}));
  await page.route('**/api/auth/poll', route => route.fulfill({json:{pending:true}}));
  await page.addInitScript(() => { window.snapkitDesktop = {openExternal:async url => { window.openedLogin = url; }}; });
  await page.goto('/');
  await expect(page.locator('.account-gate')).toBeVisible();
  await expect(page.locator('.app-shell')).toBeHidden();
  await page.getByRole('button',{name:'Tiếng Việt',exact:true}).click();
  await page.getByRole('button',{name:'Tiếp tục với Google',exact:true}).click();
  await expect(page.locator('#account-message')).toContainText('trình duyệt');
  expect(await page.evaluate(() => window.openedLogin)).toContain('/auth/google/start');
});

test('login retry reports unavailable cloud and does not open an untrusted URL', async ({page}) => {
  await page.route('**/api/auth/status', route => route.fulfill({json:{required:true,authenticated:false,localToken:'local'}}));
  await page.route('**/api/auth/start', route => route.fulfill({json:{browserUrl:'https://example.com/steal',expiresIn:600}}));
  await page.goto('/');
  await page.locator('#google-signin').click();
  await expect(page.locator('#account-message')).toContainText('Invalid sign-in URL');
  await expect(page.locator('#google-signin')).toBeEnabled();
});

test('admin edits bilingual content with optimistic revision and renders account text safely', async ({page}) => {
  const server = createCloud({env:{}}).listen(0,'127.0.0.1'); await new Promise(r => server.once('listening',r));
  try {
    let saved;
    await page.route('**/v1/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/v1/auth/config') return route.fulfill({json:{configured:true}});
      if (path === '/v1/account') return route.fulfill({json:{user:{email:'admin@example.com',role:'admin'}}});
      if (path === '/v1/admin/overview') return route.fulfill({json:{users:1,activeUsers:1,sessions:1,content:defaultContent(),audit:[]}});
      if (path === '/v1/admin/users') return route.fulfill({json:{total:1,users:[{id:'a',name:'<img src=x onerror=alert(1)>',email:'user@example.com',role:'user',disabled:false}]}});
      if (path === '/v1/admin/content') { saved = route.request().postDataJSON(); return route.fulfill({json:{content:{...saved,revision:1}}}); }
      return route.fulfill({status:404,json:{error:'Not found'}});
    });
    await page.goto('http://127.0.0.1:' + server.address().port + '/admin/');
    await expect(page.locator('#dashboard')).toBeVisible();
    await page.locator('[name="headline-vi"]').fill('Snapkit dành cho bạn');
    await page.getByRole('button',{name:'Lưu và xuất bản'}).click();
    await expect(page.locator('#save-message')).toContainText('Đã xuất bản');
    expect(saved.landing.vi.headline).toBe('Snapkit dành cho bạn'); expect(saved.revision).toBe(0);
    await expect(page.locator('#users img')).toHaveCount(0);
    await page.screenshot({path:'/tmp/snapkit-admin-beta10.png',fullPage:true});
  } finally { server.close(); }
});

test('admin login adapts to mobile, exposes recovery and lets an unauthorized account switch Google account', async ({ page }) => {
  const server = createCloud({env:{}}).listen(0,'127.0.0.1'); await new Promise(r => server.once('listening',r));
  const base = 'http://127.0.0.1:' + server.address().port;
  let mode = 'ready', logoutCount = 0;
  try {
    await page.route('**/v1/**', async route => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname === '/v1/auth/config') {
        if (mode === 'network') return route.abort();
        return route.fulfill({json:{configured:true}});
      }
      if (pathname === '/v1/account') return mode === 'denied' ? route.fulfill({json:{user:{email:'member@example.com',role:'user'}}}) : route.fulfill({status:401,json:{error:'Sign in'}});
      if (pathname === '/v1/auth/logout') { logoutCount++; return route.fulfill({json:{signedOut:true}}); }
      return route.fulfill({status:404,json:{error:'Not found'}});
    });
    await page.goto(base + '/admin/');
    await expect(page.getByRole('link',{name:'Tiếp tục với Google'})).toBeVisible();
    await expect(page.locator('#auth-status')).toBeHidden();
    await expect(page.locator('.admin-brand img')).toHaveJSProperty('naturalWidth',40);
    await page.screenshot({path:'/tmp/snapkit-admin-login-desktop.png',fullPage:true});
    for (const viewport of [{width:375,height:812},{width:812,height:375}]) {
      await page.setViewportSize(viewport);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const button = await page.locator('#google-login').boundingBox(); expect(button.height).toBeGreaterThanOrEqual(44);
      await page.locator('#google-login').focus(); await expect(page.locator('#google-login')).toBeFocused();
    }
    await page.setViewportSize({width:375,height:812});
    await page.screenshot({path:'/tmp/snapkit-admin-login-mobile.png',fullPage:true});
    mode = 'network'; await page.reload();
    await expect(page.locator('#auth-status')).toContainText('Chưa thể kết nối');
    await expect(page.locator('#google-login')).toBeHidden();
    mode = 'ready'; await page.getByRole('button',{name:'Thử lại',exact:true}).click();
    await expect(page.locator('#google-login')).toBeVisible();
    mode = 'denied'; await page.reload();
    await expect(page.locator('#auth-status')).toContainText('member@example.com');
    await expect(page.locator('#dashboard')).toBeHidden();
    await page.route('**/auth/google/start', route => route.fulfill({body:'Google sign-in redirect'}));
    await page.getByRole('button',{name:'Đổi tài khoản Google'}).click();
    await expect(page).toHaveURL(base + '/auth/google/start'); expect(logoutCount).toBe(1);
  } finally { server.close(); }
});

test('desktop login hides retry when healthy, keeps Google icon in both languages, and retries failed status with feedback', async ({page}) => {
  let recover, initialFailure = true, freshChecks = 0;
  await page.route('**/api/auth/status*', async route => {
    if (route.request().url().includes('fresh=1')) {
      freshChecks++;
      await new Promise(resolve => { recover = resolve; });
      return route.fulfill({json:{required:true,authenticated:false,localToken:'local'}});
    }
    if (initialFailure) return route.abort();
    return route.fulfill({json:{required:true,authenticated:false,localToken:'local'}});
  });
  await page.goto('/');
  await expect(page.locator('#account-retry')).toBeVisible();
  await expect(page.locator('#google-signin')).toBeDisabled();
  await page.locator('#account-retry').click();
  await expect(page.locator('#account-retry')).toBeDisabled();
  await expect(page.locator('#account-retry')).toHaveText('Checking connection…');
  expect(freshChecks).toBe(1); recover();
  await expect(page.locator('#account-retry')).toBeHidden();
  await expect(page.locator('#google-signin')).toBeEnabled();
  await expect(page.locator('#google-signin svg')).toBeVisible();
  await page.getByRole('button',{name:'Tiếng Việt',exact:true}).click();
  await expect(page.locator('#google-signin')).toHaveText('Tiếp tục với Google');
  await expect(page.locator('#google-signin svg')).toBeVisible();
  await expect(page.locator('.account-card small')).toHaveCount(0);
  await page.screenshot({path:'/tmp/snapkit-login-beta12-vi.png'});
  initialFailure = false; await page.reload();
  await expect(page.locator('#google-signin')).toBeEnabled();
  await expect(page.locator('#account-retry')).toBeHidden();
});

test('admin announcement is absent for blank localized content and returns only for the language with text', async ({page}) => {
  await page.route('**/api/auth/status*',route=>route.fulfill({json:{required:true,authenticated:true,localToken:'local',user:{name:'Tester',email:'test@example.com',role:'user'}}}));
  await page.route('**/api/account/content',route=>route.fulfill({json:{announcement:{en:'  ',vi:'  Thông báo thử nghiệm  '}}}));
  await page.goto('/?lang=en');
  await expect(page.locator('.account-gate')).toHaveCount(0);
  await expect(page.locator('#admin-announcement')).toHaveCount(0);
  await page.locator('[data-language-select]').click();
  await page.getByRole('menuitemradio',{name:/Tiếng Việt/}).click();
  await expect(page.locator('#admin-announcement')).toBeVisible();
  await expect(page.locator('#admin-announcement')).toHaveText('Thông báo thử nghiệm');
  await page.locator('[data-language-select]').click();
  await page.getByRole('menuitemradio',{name:/English/}).click();
  await expect(page.locator('#admin-announcement')).toHaveCount(0);
});
