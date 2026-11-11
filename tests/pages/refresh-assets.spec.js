import {test, expect} from '@playwright/test';
import {copyFile,mkdir,unlink} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

test.use({colorScheme:'dark'});
async function visual(page,key,language,locator){
 const directory='apps/website/assets/visual';await mkdir(directory,{recursive:true});
 const file=directory+'/'+key+(language==='vi'?'-vi':'')+'.png';
 await (locator||page).screenshot({path:file,animations:'disabled'});
 execFileSync('python3',['-c',"from PIL import Image; import sys; im=Image.open(sys.argv[1]); im.save(sys.argv[1].replace('.png','.webp'),'WEBP',quality=88,method=6)",file]);
 await unlink(file);
}

test('refresh authored website screenshots from the current sample app', async ({page})=>{
  test.skip(process.env.SNAPKIT_REFRESH_WEBSITE !== '1', 'Set SNAPKIT_REFRESH_WEBSITE=1 to refresh authored screenshots.');
  await page.setViewportSize({width:1440,height:1020});
  for(const language of ['en','vi']) {
    await page.goto('demo/?lang='+language);
    await expect(page.locator('.device-card')).toHaveCount(6);
    if (await page.locator('#hide-welcome').isVisible()) await page.locator('#hide-welcome').click();
    for(const key of ['devices','setup','captures','releases']) {
      await page.locator(`[data-app-page="${key}"]`).click();
      await expect(page.locator('#panel-'+key)).toBeVisible();
      await expect(page.locator('.sidebar [aria-current="page"]')).toHaveAttribute('data-app-page',key);
      await page.mouse.move(1438, 2);
      await expect(page.locator('.toast')).toHaveCount(0);
      if (key === 'setup') {
        await expect(page.locator('#computer-art img')).toBeVisible();
        await expect.poll(() => page.locator('#computer-art img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
      }
      const file=`apps/website/assets/${key}${language==='vi'?'-vi':''}.png`;
      await page.screenshot({path:file, animations:'disabled'});
      await visual(page,key,language);
      await copyFile(`apps/website/assets/visual/${key}${language==='vi'?'-vi':''}.webp`,file.replace('.png','.webp'));
      if(key==='devices')await visual(page,'device-card',language,page.locator('.device-card').first());
      await copyFile(file,file.replace('apps/website/','dist/'));
    }
  }
});

test('refresh Teams showcase screenshots from fictional preview data', async ({page})=>{
 test.skip(process.env.SNAPKIT_REFRESH_WEBSITE !== '1', 'Explicit screenshot refresh only.');
 await page.setViewportSize({width:1440,height:1020});
 for(const language of ['en','vi']){
  await page.goto('demo/?product=teams&lang='+language);
  await expect(page.locator('.teams-topbar')).toContainText('Flutter Delivery Team');
  await expect(page.locator('.teams-module')).toHaveCount(6);
  await expect(page.locator('.teams-main')).toContainText(language==='en'?'fictional teammates':'thành viên minh hoạ');
  await visual(page,'teams-overview',language);
 await page.getByRole('button',{name:language==='en'?'Tasks':'Công việc',exact:true}).click();
  await page.locator('.teams-task-card').filter({hasText:'Flutter checkout'}).click();
  await page.mouse.move(1438,2);
  await page.screenshot({path:`apps/website/assets/teams${language==='vi'?'-vi':''}.png`,animations:'disabled'});
 await visual(page,'teams',language);
 await copyFile(`apps/website/assets/visual/teams${language==='vi'?'-vi':''}.webp`,`apps/website/assets/teams${language==='vi'?'-vi':''}.webp`);
 await visual(page,'task-detail',language,page.locator('.teams-task-detail'));
 }
});
