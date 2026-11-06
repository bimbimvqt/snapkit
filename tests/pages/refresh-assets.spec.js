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
      await page.evaluate(async () => { await Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))); });
      const file=`apps/website/assets/${key}${language==='vi'?'-vi':''}.png`;
      await page.screenshot({path:file});
      await copyFile(file,file.replace('apps/website/','dist/'));
    }
  }
});
