import {choose} from './choices.js';
import {test, expect} from './fixtures.js';

test('save and activate run profiles and display Doctor retry errors', async ({page}) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const initial = await page.request.get('/api/state').then(r => r.json());
  const headers = {'X-Snapkit-Token': initial.token};
  let profileId;
  const offlineTargets = initial.devices.filter(d => initial.settings.targetIds.includes(d.id) && d.state === 'offline');
  try {
    for (const device of offlineTargets) {
      const boot = await page.request.post('/api/devices/'+encodeURIComponent(device.id)+'/boot', {headers,data:{}});
      expect(boot.status()).toBe(200);
    }
    await page.locator('#run-profiles summary').click();
    await page.getByLabel('Profile name', {exact:true}).fill('Dev ' + Date.now());
    await page.locator('#run-profile-save').click();
    await expect(page.locator('#run-profile-list .run-profile')).toHaveCount(1);
    const profile = (await page.request.get('/api/run-profiles').then(r => r.json())).profiles[0]; profileId = profile.id;
    await page.request.post('/api/workspace', {headers, data:{path:initial.settings.workspace, framework:'flutter', flavor:'staging'}});
    const activation = page.waitForResponse(response=>response.url().endsWith('/api/run-profiles/activate'));
    await page.locator('[data-profile-activate]').click();
    const activated = await activation;
    expect(activated.status(), JSON.stringify(await activated.json())).toBe(200);
    await expect.poll(async () => (await page.request.get('/api/state').then(r => r.json())).settings.flavor).toBe(profile.flavor);
    await page.locator('[data-app-page="setup"]').first().click();
    await page.locator('#doctor-check').click();
    await expect(page.locator('#doctor-results')).toContainText('Project checks passed');
    await page.route('**/api/workspace/doctor', route => route.fulfill({status:400, json:{error:'Project folder is unavailable'}}));
    await page.locator('#doctor-check').click();
    await expect(page.locator('#doctor-error')).toHaveText('Project folder is unavailable');
    await expect(page.locator('#doctor-check')).toBeEnabled();
    await page.unroute('**/api/workspace/doctor');
    await page.setViewportSize({width:375,height:812});
    await page.screenshot({path:'/tmp/snapkit-project-doctor-mobile.png',animations:'disabled'});
    expect(await page.locator('#panel-setup').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    for (const device of offlineTargets) await page.request.post('/api/devices/'+encodeURIComponent(device.id)+'/shutdown',{headers,data:{}});
    if (profileId) await page.request.post('/api/run-profiles/delete', {headers,data:{id:profileId}});
    await page.request.post('/api/workspace',{headers,data:{path:initial.settings.workspace,framework:initial.settings.framework||'flutter',flavor:initial.settings.flavor||''}});
  }
});

test('paused log view keeps export snapshot, classifies severity, and renders messages as text', async ({page}) => {
  await page.goto('/');
  let next = 0;
  await page.route('**/api/tools/logs/*/start', route=>route.fulfill({json:{ok:true}}));
  await page.route(/\/api\/tools\/logs\/[^/]+\?after=/, route=> {
    next++;
    route.fulfill({json:{status:'running',next:next+1,lines:[{id:next,text:next===1?'E/App: <script>literal</script>':'W/App: warning '+next}]}});
  });
  await page.locator('[data-app-page="logs"]').first().click();
  await page.locator('#log-start').click();
  await expect(page.locator('#log-output')).toContainText('<script>literal</script>');
  await expect(page.locator('#log-output script')).toHaveCount(0);
  await expect(page.locator('#log-output .log-error')).toHaveCount(1);
  await page.locator('#log-follow').uncheck();
  const frozen = await page.locator('#log-output').innerText();
  await expect.poll(()=>next).toBeGreaterThan(1);
  expect(await page.locator('#log-output').innerText()).toBe(frozen);
  const download = page.waitForEvent('download');
  await page.locator('#log-export').click();
  const file = await download; const stream = await file.createReadStream();
  const chunks=[]; for await (const chunk of stream) chunks.push(chunk);
  expect(Buffer.concat(chunks).toString()).toBe(frozen.trimEnd());
  await page.locator('#log-follow').check();
  await expect(page.locator('#log-output')).toContainText('warning');
  await choose(page, 'log-level', 'error');
  await expect(page.locator('#log-output')).not.toContainText('warning');
  await page.screenshot({path:'/tmp/snapkit-log-explorer.png',animations:'disabled'});
});

test('developer tools translate, fit a small light window, and expose keyboard actions', async ({page}) => {
  await page.addInitScript(()=>localStorage.setItem('snapkit-theme','light'));
  await page.goto('/?lang=vi');
  await expect(page.locator('body')).toHaveAttribute('data-ui-ready','true');
  await page.setViewportSize({width:375,height:812});
  await page.locator('#run-profiles summary').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#run-profile-name')).toBeVisible();
  await expect(page.locator('#run-profiles summary')).toHaveText('Cấu hình chạy');
  await expect(page.locator('#run-profile-save')).toHaveText('Lưu thiết lập hiện tại');
  expect(await page.locator('#run-profiles').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.locator('#run-profiles').screenshot({path:'/tmp/snapkit-run-profiles-light-vi.png'});
  await page.locator('[data-app-page="setup"]').first().click();
  await page.locator('#doctor-check').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#doctor-results')).toContainText('Dự án đã qua các bước kiểm tra');
  await page.locator('#doctor-title').scrollIntoViewIfNeeded();
  await page.locator('[aria-labelledby="doctor-title"]').screenshot({path:'/tmp/snapkit-project-doctor-light-vi.png'});
  await page.setViewportSize({width:812,height:375});
  expect(await page.locator('#panel-setup').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
});
