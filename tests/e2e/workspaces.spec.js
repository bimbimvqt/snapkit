import {test,expect} from './fixtures.js';

test('create and switch stack workspaces, restore targets, and retain active workspace on reload',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  const initial=await page.request.get('/api/state').then(r=>r.json());
  const headers={'X-Snapkit-Token':initial.token};
  const picker=page.locator('#workspace-picker'), form=page.locator('#create-workspace-dialog');
  async function create(name,kind){
    await page.locator('#workspace-switch').click();
    await picker.getByRole('button',{name:'Create workspace',exact:true}).click();
    await form.getByRole('button',{name:kind}).click();
    await form.getByLabel('Workspace name',{exact:true}).fill(name);
    await form.getByRole('button',{name:'Create workspace',exact:true}).click();
    await expect(form).not.toBeVisible();
    await expect(page.locator('#workspace-name')).toHaveText(name);
  }
  const suffix=Date.now();
  try{
    await create('Flutter '+suffix,'Flutter Dart');
    const flutter=await page.request.get('/api/state').then(r=>r.json());
    await page.request.post('/api/workspace',{headers,data:{path:'/work/flutter-team',framework:'flutter'}});
    const device=initial.devices.find(d=>d.state==='online'&&d.flutterId);
    expect(device).toBeTruthy();
    expect((await page.request.post('/api/targets',{headers,data:{ids:[device.id]}})).ok()).toBe(true);
    await create('Native '+suffix,'React Native JavaScript / TypeScript');
    await expect(page.locator('body')).toHaveAttribute('data-framework','react-native');
    await expect(page.locator('[data-app-page="releases"]').first()).toBeHidden();
    let current=await page.request.get('/api/state').then(r=>r.json());
    expect(current.settings.workspace).toBe('');expect(current.settings.targetIds).toEqual([]);
    await page.reload();await expect(page.locator('#workspace-name')).toHaveText('Native '+suffix);
    await create('API '+suffix,'Backend Coming soon');
    await expect(page.locator('#panel-backend')).toBeVisible();
    await page.getByRole('button',{name:'Switch workspace',exact:true}).filter({visible:true}).click();
    await picker.getByRole('button',{name:new RegExp('Flutter '+suffix)}).click();
    await expect(page.locator('#panel-devices')).toBeVisible();
    await expect(page.locator('body')).toHaveAttribute('data-framework','flutter');
    current=await page.request.get('/api/state').then(r=>r.json());
    expect(current.settings.spaceId).toBe(flutter.settings.spaceId);
    expect(current.settings.workspace).toBe('/work/flutter-team');expect(current.settings.targetIds).toEqual([device.id]);
    await page.locator('#workspace-switch').click();
    await picker.getByRole('button',{name:'Create workspace',exact:true}).click();
    await page.screenshot({path:'/tmp/snapkit-workspace-create.png',animations:'disabled'});
    await form.getByRole('button',{name:'Cancel',exact:true}).click();
    expect(errors).toEqual([]);
  }finally{await page.request.post('/api/workspaces/activate',{headers,data:{id:initial.settings.spaceId||'legacy'}});}
});

test('create workspace fits mobile and light theme, translates copy and displays API errors',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('snapkit-theme','light'));
  await page.goto('/?lang=vi');await page.setViewportSize({width:375,height:812});
  await page.locator('#workspace-switch').click();
  await page.locator('#workspace-picker').getByRole('button',{name:'Tạo không gian làm việc',exact:true}).click();
  const form=page.locator('#create-workspace-dialog');
  await expect(form).toContainText('Loại không gian làm việc');
  expect(await form.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await form.getByRole('button',{name:'React Native JavaScript / TypeScript'}).focus();await page.keyboard.press('Enter');
  await expect(form.getByRole('button',{name:'React Native JavaScript / TypeScript'})).toHaveAttribute('aria-pressed','true');
  await form.getByLabel('Tên không gian làm việc',{exact:true}).fill('Mobile');
  await page.route('**/api/workspaces/create',route=>route.fulfill({status:409,json:{error:'Stop active debug sessions, builds and recordings before switching workspaces'}}));
  await form.getByRole('button',{name:'Tạo không gian làm việc',exact:true}).click();
  await expect(form.getByRole('alert')).toContainText('Dừng các phiên debug');
  await expect(form.getByRole('button',{name:'Tạo không gian làm việc',exact:true})).toBeEnabled();
  await page.screenshot({path:'/tmp/snapkit-workspace-mobile.png',animations:'disabled'});
  await page.keyboard.press('Escape');await expect(form).not.toBeVisible();
});
