import {test,expect} from './fixtures.js';
test('completion is announced in Vietnamese while another tool is open, without repeating',async({page})=>{
 await page.goto('/?lang=vi&page=kit&tool=focus');
 await page.clock.install();
 await page.getByRole('button',{name:'Bắt đầu tập trung',exact:true}).click();
 await page.getByRole('button',{name:'Tiện ích văn bản',exact:true}).click();
 await page.clock.fastForward(1500100);
 await expect(page.locator('#toast-region')).toContainText('Bạn đã hoàn thành 25 phút tập trung. Nghỉ một chút nhé.');
 await expect(page.locator('#toast-region .toast')).toHaveCount(1);
 await page.clock.fastForward(10000);await expect(page.locator('#toast-region .toast')).toHaveCount(0);
 await page.clock.resume();await page.reload();await expect(page.locator('#toast-region .toast')).toHaveCount(0);
});
