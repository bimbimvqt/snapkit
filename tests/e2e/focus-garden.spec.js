import {test,expect} from './fixtures.js';
test('uploaded audio loops only during an opted-in focus session and follows pause and volume',async({page})=>{
 const wav=Buffer.alloc(16044);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(16000,40);
 await page.route('**/api/kit/focus-audio',route=>route.fulfill({json:{tracks:{forest:{title:'Forest sample',url:'/audio-fixture.wav'}}}}));
 await page.route('**/audio-fixture.wav',route=>route.fulfill({contentType:'audio/wav',body:wav}));
 await page.addInitScript(()=>{const NativeAudio=window.Audio;window.Audio=function(){const audio=new NativeAudio();window.__focusAudio=audio;return audio;};});
 await page.goto('/?page=kit&tool=focus');
 await expect(page.locator('.focus-audio')).toContainText('Forest sample');
 await page.getByRole('button',{name:'Focus sound off',exact:true}).click();
 await page.getByRole('button',{name:'Start focus',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.__focusAudio?.paused)).toBe(false);
 expect(await page.evaluate(()=>window.__focusAudio.loop)).toBe(true);
 await page.getByRole('slider',{name:'Volume',exact:true}).fill('65');
 await expect.poll(()=>page.evaluate(()=>window.__focusAudio.volume)).toBe(0.65);
 await page.getByRole('button',{name:'Pause focus',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.__focusAudio.paused)).toBe(true);
 await page.getByRole('button',{name:'Start focus',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.__focusAudio.paused)).toBe(false);
 await page.clock.install();await page.clock.fastForward(1500100);
 await expect.poll(()=>page.evaluate(()=>window.__focusAudio.paused)).toBe(true);
 await page.clock.resume();
});
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
