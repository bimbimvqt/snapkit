import {test, expect} from '@playwright/test';
import {copyFile} from 'node:fs/promises';
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
      await copyFile(file,file.replace('apps/website/','dist/'));
    }
  }
});

test('refresh Teams showcase screenshots from fictional preview data', async ({page})=>{
 test.skip(process.env.SNAPKIT_REFRESH_WEBSITE !== '1', 'Explicit screenshot refresh only.');
 await page.setViewportSize({width:1440,height:1020});
 for(const language of ['en','vi']){
  await page.goto('demo/?product=teams&lang='+language);
  await expect(page.locator('.teams-topbar')).toContainText('Product Studio');
  await expect(page.locator('.teams-module')).toHaveCount(4);
  await expect(page.locator('.teams-main')).toContainText(language==='en'?'fictional data':'dữ liệu minh hoạ');
  await page.mouse.move(1438,2);
  await page.screenshot({path:`apps/website/assets/teams${language==='vi'?'-vi':''}.png`,animations:'disabled'});
 }
});
