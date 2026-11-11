import {test,expect} from './fixtures.js';
test('Focus Kit sends local timer changes to the floating widget and accepts native changes without an echo',async({page})=>{
 await page.addInitScript(()=>{window.__miniSent=[];window.__miniOpened=0;window.snapkitDesktop={miniOpen:async()=>{window.__miniOpened++;return true;},miniFocus:async value=>window.__miniSent.push(value),onMiniFocus:callback=>{window.__fromMini=callback;return()=>{};}};});
 await page.goto('/?page=kit&tool=focus');await expect(page.locator('.kit-focus')).toBeVisible();await page.locator('.kit-focus').getByRole('button',{name:'Open floating widget',exact:true}).click();expect(await page.evaluate(()=>window.__miniOpened)).toBe(1);
 await page.getByRole('button',{name:'Start focus',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__miniSent.at(-1)?.deadline> Date.now())).toBe(true);
 await page.evaluate(()=>{window.__miniSent=[];window.__fromMini({remaining:712,deadline:null});});await expect(page.locator('.kit-timer')).toHaveText('11:52');expect(await page.evaluate(()=>window.__miniSent.length)).toBe(0);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('snapkit-focus-v1')).remaining)).toBe(712);
 await page.getByRole('button',{name:'Reset',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__miniSent.at(-1)?.remaining)).toBe(1500);
});
test('My day pins the actual assigned task and acceptance criteria to the widget',async({page})=>{
 await page.addInitScript(()=>{window.snapkitDesktop={miniOpen:async()=>true,miniTask:async value=>{window.__miniTask=value;}};});
 await page.route('**/api/teams',route=>route.fulfill({json:{workspaces:[{id:'demo-team',name:'Flutter Team'}]}}));
 await page.route('**/api/teams/demo-team',route=>route.fulfill({json:{membership:{userId:'mobile-dev'},projects:[{id:'flutter',name:'Flutter Shop'}],tasks:[{id:'mobile-42',number:42,projectId:'flutter',environment:'development',title:'Complete checkout',status:'in-progress',assigneeId:'mobile-dev',acceptedAt:'2026-11-11',criteria:[{id:'a',done:true},{id:'b',done:false}]}]}}));
 await page.goto('/?page=kit');await page.getByRole('button',{name:'Pin task in widget: Complete checkout',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__miniTask?.id)).toBe('mobile-42');expect(await page.evaluate(()=>window.__miniTask)).toMatchObject({userId:'mobile-dev',workspaceId:'demo-team',done:1,total:2,title:'Complete checkout',project:'#42 · Flutter Shop'});
});
