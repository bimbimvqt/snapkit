import {test,expect} from '@playwright/test';
test('landing explains IDE versus Snapkit configuration and offers versioned extension with localized widget controls',async({page})=>{
 for(const [route,heading]of [['','Run. Reload. Tiếp tục sáng tạo.'],['en/','Run. Reload. Keep building.']]){
  await page.goto(route);
  const section=page.locator('#debug-controls');await section.scrollIntoViewIfNeeded();
  await expect(section.getByRole('heading')).toHaveText(heading);
  await expect(section).toContainText('Hot restart');await expect(section).toContainText('1.7.2');await expect(section).toContainText('Debug Console');
  await expect(section.locator('#extension-download')).toHaveAttribute('href',/v0\.2\.0-beta\.92\/snapkit-debug-sync\.vsix$/);
  await expect.poll(()=>section.locator('img').evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
  for(const width of [375,768,1440]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await section.screenshot({path:'screenshots/landing-debug-controls-'+(route?'en':'vi')+'.png'});
 }
});
