import {test,expect} from './fixtures.js';
test('startup stays passive; opening Devices starts discovery and Setup checks tools',async({page})=>{
 let releaseProduct;const productGate=new Promise(resolve=>{releaseProduct=resolve;});
 await page.route('**/api/product',async route=>{await productGate;await route.fallback();});
 await page.route('**/api/state',async route=>{const response=await route.fetch(),snapshot=await response.json();await route.fulfill({json:{...snapshot,scannedAt:null,settings:{...snapshot.settings,spaceId:'startup-space',framework:'flutter'}}});});
 const requests=[];
 page.on('request',request=>{const path=new URL(request.url()).pathname;if(['/api/scan','/api/diagnostics'].includes(path))requests.push(path);});
 await page.addInitScript(()=>{window.__startupPages=[];document.addEventListener('snapkit:page',event=>window.__startupPages.push(event.detail));window.snapkitDesktop={ready(){},setLanguage:async()=>{}};});
 try{await page.goto('/?lang=en');await expect(page.locator('body')).toHaveAttribute('data-ui-ready','true');}finally{releaseProduct();}
 await expect(page.locator('#panel-kit')).toBeVisible();

 expect(await page.evaluate(()=>window.__startupPages)).toEqual(expect.arrayContaining(['devices','kit']));
 expect(requests).toEqual([]);
 await page.locator('[data-app-page="devices"]').click();await expect.poll(()=>requests.filter(p=>p==='/api/scan').length).toBe(1);
 await page.locator('[data-app-page="setup"]').click();await expect.poll(()=>requests.filter(p=>p==='/api/diagnostics').length).toBe(1);
});
test('desktop SDK selection uses native dialog and preserves the value on cancel',async({page})=>{
 let apiCalls=0;await page.route('**/api/folders/pick',route=>{apiCalls++;return route.fulfill({json:{path:'/unexpected'}});});
 await page.addInitScript(()=>{let calls=0;window.snapkitDesktop={ready(){},setLanguage:async()=>{},pickFolder:async()=>({path:++calls===1?'/native/flutter':''})};});
 await page.goto('/?lang=en');await page.locator('[data-app-page="preferences"]').click();await page.locator('#browse-flutter-sdk').click();await expect(page.locator('#pref-flutter')).toHaveValue('/native/flutter');
 await page.locator('#browse-flutter-sdk').click();await expect(page.locator('#browse-flutter-sdk')).toBeEnabled();await expect(page.locator('#pref-flutter')).toHaveValue('/native/flutter');expect(apiCalls).toBe(0);
});
