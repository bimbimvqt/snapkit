import {test,expect} from './fixtures.js';
test('removed developer lab has no navigation, command or working API; old app links open Kit',async({page})=>{
 await page.addInitScript(()=>{window.snapkitDesktop={ready(){},setLanguage:async()=>{}};});
 await page.goto('/?page=dev-lab&lang=en');await expect(page.locator('body')).toHaveAttribute('data-ui-ready','true');await expect(page.locator('#panel-kit')).toBeVisible();await expect(page.locator('[data-app-page="dev-lab"],#panel-dev-lab')).toHaveCount(0);
 await page.getByRole('button',{name:'Open quick commands',exact:true}).click();await page.getByRole('combobox',{name:'Search commands'}).fill('Dev Lab');await expect(page.getByRole('dialog',{name:'Quick commands'})).toContainText('No matching command');
 for(const endpoint of ['/api/dev-lab','/api/dev-lab/jobs','/api/mcp']){const response=await page.request.get(endpoint);expect(response.status()).toBe(404);}
});
