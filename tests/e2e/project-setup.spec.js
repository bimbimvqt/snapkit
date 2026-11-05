import {test,expect} from './fixtures.js';

test('project mismatch is explained before saving and matching workspace creation preserves the draft',async({page})=>{
  await page.goto('/?lang=vi');
  const initial=await page.request.get('/api/state').then(r=>r.json());
  const headers={'X-Snapkit-Token':initial.token}, suffix=Date.now();
  const native=await page.request.post('/api/workspaces/create',{headers,data:{name:'Native '+suffix,type:'react-native'}}).then(r=>r.json());
  await page.reload();
  await page.route('**/api/workspace/profiles?*',route=>route.fulfill({json:{framework:'flutter',profiles:[],flavors:[],savedSetup:{flavor:'old',target:'lib/old.dart',defineFile:'old.json'}}}));
  const project=page.locator('#workspace-dialog'),create=page.locator('#create-workspace-dialog');
  const folder='/work/flutter-'+suffix;
  try{
    await page.locator('#settings-button').click();
    await expect(page.locator('#workspace-context')).toContainText('React Native');
    await page.locator('#workspace-path').fill(folder);
    await expect(page.locator('#workspace-detection')).toHaveText('Đã nhận diện: Flutter');
    await expect(page.locator('#workspace-mismatch')).toContainText('Đây là dự án Flutter. Không gian hiện tại dùng React Native.');
    await expect(project.getByRole('button',{name:'Lưu thiết lập IDE'})).toBeDisabled();
    await page.locator('#workspace-flavor').fill('staging');await page.locator('#workspace-target').fill('lib/staging.dart');await page.locator('#workspace-defines').fill('env/staging.json');
    await page.screenshot({path:'/tmp/snapkit-project-mismatch.png',animations:'disabled'});
    for(const width of [375,768]) {
      await page.setViewportSize({width,height:812});
      expect(await project.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
      const box=await project.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);
      await expect(project.getByRole('button',{name:'Lưu thiết lập IDE'})).toBeInViewport();
    }
    await page.setViewportSize({width:1440,height:1000});
    await page.getByRole('button',{name:'Tạo không gian phù hợp'}).click();
    await expect(create.getByRole('button',{name:'Flutter Dart'})).toHaveAttribute('aria-pressed','true');
    await expect(create.getByLabel('Tên không gian làm việc',{exact:true})).toHaveValue('flutter-'+suffix);
    await create.getByRole('button',{name:'Hủy',exact:true}).click();
    await expect(project).toBeVisible();await expect(page.locator('#workspace-target')).toHaveValue('lib/staging.dart');
    await expect(page.locator('#create-matching-workspace')).toBeVisible();await page.locator('#create-matching-workspace').click();
    await create.getByRole('button',{name:'Tạo không gian làm việc',exact:true}).click();
    await expect(create).not.toBeVisible();await expect(project).toBeVisible();
    await expect(page.locator('#workspace-context')).toContainText('Flutter');
    await expect(page.locator('#workspace-path')).toHaveValue(folder);await expect(page.locator('#workspace-flavor')).toHaveValue('staging');
    await expect(page.locator('#workspace-target')).toHaveValue('lib/staging.dart');await expect(page.locator('#workspace-defines')).toHaveValue('env/staging.json');
    await expect(page.locator('#workspace-mismatch')).toBeHidden();
    await project.getByRole('button',{name:'Lưu thiết lập IDE'}).click();await expect(project).not.toBeVisible();
    const saved=await page.request.get('/api/state').then(r=>r.json());expect(saved.settings.workspace).toBe(folder);expect(saved.settings.framework).toBe('flutter');
    const spaces=await page.request.get('/api/workspaces').then(r=>r.json());expect(spaces.workspaces.find(s=>s.id===native.settings.spaceId).project).toBe('');
  }finally{await page.request.post('/api/workspaces/activate',{headers,data:{id:initial.settings.spaceId||'legacy'}});}
});

test('late framework detection cannot overwrite a newer folder selection',async({page})=>{
  await page.goto('/');
  const initial=await page.request.get('/api/state').then(r=>r.json()),headers={'X-Snapkit-Token':initial.token};
  await page.request.post('/api/workspaces/create',{headers,data:{name:'Race '+Date.now(),type:'react-native'}});await page.reload();
  let releaseOld;const old=new Promise(resolve=>releaseOld=resolve);
  await page.route('**/api/workspace/profiles?*',async route=>{
    if(route.request().url().includes('old')){await old;await route.fulfill({json:{framework:'flutter',profiles:[],flavors:[]}});}
    else await route.fulfill({json:{framework:'react-native',profiles:[],flavors:[]}});
  });
  try{
    await page.locator('#settings-button').click();await page.locator('#workspace-path').fill('/work/old');
    await page.locator('#workspace-path').dispatchEvent('change');
    await expect(page.locator('#workspace-detection')).toHaveText('Detecting project framework…');
    await expect(page.locator('#workspace-form button[type=submit]')).toBeDisabled();
    await page.locator('#workspace-path').fill('/work/new');await page.locator('#workspace-path').dispatchEvent('change');
    await expect(page.locator('#workspace-detection')).toHaveText('Detected: React Native');releaseOld();
    await page.unrouteAll({behavior:'wait'});
    await expect(page.locator('#workspace-detection')).toHaveText('Detected: React Native');
    await expect(page.locator('#workspace-mismatch')).toBeHidden();await expect(page.locator('#flutter-project-fields')).toBeHidden();
    await expect(page.locator('#workspace-form button[type=submit]')).toBeEnabled();
  }finally{releaseOld();await page.request.post('/api/workspaces/activate',{headers,data:{id:initial.settings.spaceId||'legacy'}});}
});
