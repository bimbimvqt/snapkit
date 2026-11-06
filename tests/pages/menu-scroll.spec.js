import {test,expect} from '@playwright/test';
const position=page=>page.evaluate(()=>({x:scrollX,y:scrollY}));
async function clickVisible(page,locator){
  const box=await locator.boundingBox();expect(box).not.toBeNull();
  await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
}
async function stableScroll(page,before){
  // Wait through the browser's focus/smooth-scroll window; an immediate read can miss a pending jump.
  await page.waitForTimeout(350);
  expect(await position(page)).toEqual(before);
}
test('sticky language menu keeps page position when opening, choosing and using arrow keys',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.route('**/v1/public/content',route=>route.fulfill({json:{landing:{
    en:{headline:'Every device. One place to build.',description:'Prepare your devices in a few clicks. Focus on your next great app.'},
    vi:{headline:'Mọi thiết bị. Một nơi điều khiển.',description:'Chuẩn bị thiết bị trong vài thao tác. Tập trung làm nên ứng dụng tiếp theo của bạn.'}
  }}}));
  await page.goto('./?lang=en');
  await expect(page.locator('.hero h1')).toHaveText('Every device. One place to build.');
  for(const y of [320,900,1800]){
    await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),y);const before=await position(page);
    await clickVisible(page,page.locator('[data-language-select]'));await expect(page.locator('#language-menu')).toBeVisible();await stableScroll(page,before);
    await page.locator('[data-language=en]').press('ArrowDown');await expect(page.locator('[data-language=vi]')).toBeFocused();await stableScroll(page,before);
    await page.keyboard.press('Escape');await expect(page.locator('[data-language-select]')).toBeFocused();await stableScroll(page,before);
    await clickVisible(page,page.locator('[data-language-select]'));await clickVisible(page,page.locator('[data-language=vi]'));await stableScroll(page,before);
    await clickVisible(page,page.locator('[data-language-select]'));await clickVisible(page,page.locator('[data-language=en]'));await stableScroll(page,before);
  }
});
test('feedback choice menu opens within viewport and keeps page position after choosing',async({page})=>{
  await page.setViewportSize({width:1440,height:900});await page.goto('./?lang=vi#feedback');
  const trigger=page.locator('#feedback-type [role=combobox]');await trigger.scrollIntoViewIfNeeded();
  await page.evaluate(()=>{const target=document.querySelector('#feedback-type').getBoundingClientRect().top+scrollY;scrollTo({top:target-600,behavior:'instant'});});
  const before=await position(page);await trigger.click();await stableScroll(page,before);
  const box=await page.locator('#feedback-type [role=listbox]').boundingBox();expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThanOrEqual(900);
  await page.getByRole('option',{name:'Báo lỗi',exact:true}).click();await expect(trigger).toBeFocused();await stableScroll(page,before);
});
