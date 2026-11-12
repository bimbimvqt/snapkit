import {test,expect} from './fixtures.js';
test('desktop experience uses native state and receives Mini updates while the Focus panel is closed',async({page})=>{
 await page.addInitScript(()=>{
  let state={space:'night',plant:'pine',completed:3,totalSeconds:4500,sessionSeconds:1500,timer:{remaining:712,deadline:null}};
  window.snapkitDesktop={
   focusExperience:async()=>state,
   onFocusExperience:callback=>{window.__gardenUpdate=value=>{state=value;callback(value);};return()=>{};},
   focusAction:async action=>{if(action.type==='space')state={...state,space:action.value};return state;}
  };
 });
 await page.goto('/?page=kit&tool=focus');
 await expect(page.locator('.kit-timer')).toHaveText('11:52');
 await expect(page.locator('.focus-world')).toHaveAttribute('data-space','night');
 await expect(page.locator('.focus-garden-stats strong')).toHaveText(['3','75','0']);
 await page.getByRole('button',{name:'Rainy day',exact:true}).click();
 await expect(page.locator('.focus-world')).toHaveAttribute('data-space','rain');
 await page.getByRole('button',{name:'Text Kit',exact:true}).click();
 await page.evaluate(()=>window.__gardenUpdate({space:'forest',plant:'pine',completed:4,totalSeconds:6000,sessionSeconds:1500,timer:{remaining:0,deadline:null}}));
 await page.getByRole('button',{name:'Focus Kit',exact:true}).click();
 await expect(page.locator('.focus-garden-stats strong')).toHaveText(['4','100','1']);
 await expect(page.locator('.kit-timer')).toHaveText('00:00');
 await expect(page.locator('.focus-world')).toHaveAttribute('data-space','forest');
});
test('spaces and garden styles persist; a completed session grows the garden exactly once',async({page})=>{
 await page.goto('/?page=kit&tool=focus');
 await page.getByRole('button',{name:'Rainy day',exact:true}).click();
 await expect(page.locator('.focus-world')).toHaveAttribute('data-space','rain');
 await page.getByRole('combobox',{name:'Garden style',exact:true}).click();
 await page.getByRole('option',{name:'Cherry blossom',exact:true}).click();
 await page.reload();
 await expect(page.getByRole('button',{name:'Rainy day',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.focus-current')).toHaveAttribute('data-plant','blossom');
 await page.getByRole('combobox',{name:'Session length',exact:true}).click();
 await page.getByRole('option',{name:'5 minutes',exact:true}).click();
 await page.clock.install();await page.getByRole('button',{name:'Start focus',exact:true}).click();
 await page.clock.fastForward(60000);await page.getByRole('button',{name:'Pause focus',exact:true}).click();
 await page.clock.fastForward(600000);await expect(page.locator('.kit-timer')).toHaveText('04:00');
 await page.getByRole('button',{name:'Start focus',exact:true}).click();await page.clock.fastForward(240100);
 await expect(page.locator('.focus-garden-stats strong')).toHaveText(['1','5','0']);
 await page.clock.fastForward(10000);await expect(page.locator('.focus-garden-stats strong')).toHaveText(['1','5','0']);
 await page.clock.resume();await page.reload();await expect(page.locator('.focus-garden-stats strong')).toHaveText(['1','5','0']);
});
test('focus spaces fit small screens and reduced motion in both appearances',async({page})=>{
 await page.goto('/?page=kit&tool=focus');
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const theme of ['light','dark']){
  await page.evaluate(value=>{localStorage.setItem('snapkit-theme',value);window.dispatchEvent(new StorageEvent('storage',{key:'snapkit-theme',newValue:value}));},theme);
  for(const width of [375,768,1440]){
   await page.setViewportSize({width,height:900});
   await expect(page.getByRole('button',{name:'Quiet forest',exact:true})).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await expect(page.locator('html')).toHaveClass(theme==='light'?/light/:/^(?!.*light)/);
   await page.locator('.kit-focus').screenshot({path:`/tmp/snapkit-garden-${theme}-${width}.png`});
  }
 }
 await page.locator('[data-language-select]').click();await page.locator('[data-language=vi]').click();
 await expect(page.getByRole('button',{name:'Rừng yên',exact:true})).toBeVisible();
 await expect(page.getByRole('combobox',{name:'Kiểu cây trong vườn',exact:true})).toBeVisible();
 await page.locator('.kit-focus').screenshot({path:'/tmp/snapkit-garden-vi.png'});
});

test('custom themes apply to the app, persist, support editing and preserve garden on deletion',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?lang=en&page=kit&tool=focus');
 await expect(page.locator('.focus-audio')).toHaveCount(0);
 const original=await page.locator('.sidebar').evaluate(el=>getComputedStyle(el).backgroundColor);
 await page.getByRole('button',{name:'New theme',exact:false}).click();
 const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
 await dialog.getByLabel('Theme name',{exact:true}).fill('Sunset desk');
 await dialog.getByLabel('Background color',{exact:true}).fill('#aa1122');
 await dialog.getByRole('combobox',{name:'Scenery',exact:true}).click();await page.getByRole('option',{name:'Gradient',exact:true}).click();
 await dialog.getByRole('button',{name:'Save and apply',exact:true}).click();
 await expect(dialog).not.toBeVisible();
 await expect(page.getByRole('button',{name:'Sunset desk',exact:true})).toHaveAttribute('aria-pressed','true');
 expect(await page.locator('.sidebar').evaluate(el=>getComputedStyle(el).backgroundColor)).not.toBe(original);
 await expect(page.locator('.focus-world')).toHaveAttribute('data-space','gradient');
 await page.reload();await expect(page.getByRole('button',{name:'Sunset desk',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.setViewportSize({width:375,height:900});
 await page.getByRole('button',{name:'Customize Sunset desk',exact:true}).click();
 await dialog.getByLabel('Theme name',{exact:true}).fill('Evening desk');
 await dialog.getByRole('button',{name:'Save and apply',exact:true}).click();
 await page.getByRole('button',{name:'Customize Evening desk',exact:true}).click();
 expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 await dialog.screenshot({path:'/tmp/snapkit-theme-editor-mobile.png'});
 await dialog.getByRole('button',{name:'Delete theme',exact:true}).click();await dialog.getByRole('button',{name:'Delete theme',exact:true}).click();
 await expect(page.getByRole('button',{name:'Evening desk',exact:true})).toHaveCount(0);
 await expect(page.locator('.focus-garden-stats strong')).toHaveText(['0','0','0']);
 expect(errors).toEqual([]);
});
