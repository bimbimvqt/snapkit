import {test,expect} from './fixtures.js';
test('startup stays passive; opening Devices starts discovery and Setup checks tools',async({page})=>{
 await page.route('**/api/state',async route=>{const response=await route.fetch();await route.fulfill({json:{...await response.json(),scannedAt:null}});});
 const requests=[];
 page.on('request',request=>{const path=new URL(request.url()).pathname;if(['/api/scan','/api/diagnostics'].includes(path))requests.push(path);});
 await page.addInitScript(()=>{window.snapkitDesktop={ready(){},setLanguage:async()=>{}};});
 await page.goto('/?lang=en');await expect(page.locator('body')).toHaveAttribute('data-ui-ready','true');
 await expect(page.locator('#panel-kit')).toBeVisible();expect(requests).toEqual([]);
 await page.locator('[data-app-page="devices"]').click();await expect.poll(()=>requests.filter(p=>p==='/api/scan').length).toBe(1);
 await page.locator('[data-app-page="setup"]').click();await expect.poll(()=>requests.filter(p=>p==='/api/diagnostics').length).toBe(1);
});
test('desktop SDK selection uses native dialog and preserves the value on cancel',async({page})=>{
 let apiCalls=0;await page.route('**/api/folders/pick',route=>{apiCalls++;return route.fulfill({json:{path:'/unexpected'}});});
 await page.addInitScript(()=>{let calls=0;window.snapkitDesktop={ready(){},setLanguage:async()=>{},pickFolder:async()=>({path:++calls===1?'/native/flutter':''})};});
 await page.goto('/?lang=en');await page.locator('[data-app-page="preferences"]').click();await page.locator('#browse-flutter-sdk').click();await expect(page.locator('#pref-flutter')).toHaveValue('/native/flutter');
 await page.locator('#browse-flutter-sdk').click();await expect(page.locator('#browse-flutter-sdk')).toBeEnabled();await expect(page.locator('#pref-flutter')).toHaveValue('/native/flutter');expect(apiCalls).toBe(0);
});
