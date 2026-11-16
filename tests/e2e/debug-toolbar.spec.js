import {test,expect} from './fixtures.js';

test('debug toolbar launches the saved Snapkit configuration, reports failures and controls selected sessions',async({page})=>{
 let debugging=false;
 const commands=[];
 await page.route('**/api/state',async route=>{
  const response=await route.fetch(),state=await response.json();
  state.settings.targetIds=['demo-android-1'];state.settings.flavor='dev';state.settings.target='lib/main_dev.dart';
  state.debugSessions=debugging?[{id:'session',deviceId:state.devices.find(d=>d.id==='demo-android-1').flutterId||'demo-android-1',name:'dev'}]:[];
  await route.fulfill({json:state});
 });
 await page.route('**/api/ide/launch',async route=>{commands.push(route.request().postDataJSON());await route.fulfill({json:{id:'launch',status:'queued'}});});
 await page.route('**/api/ide/launch/launch',route=>route.fulfill({json:{id:'launch',status:'started'}}));
 await page.route('**/api/ide/control',async route=>{commands.push(route.request().postDataJSON());await route.fulfill({json:{count:1}});});
 await page.goto('/');await expect(page.locator('body')).toHaveAttribute('data-ui-ready','true');
 await expect(page.locator('#debug-profile-summary')).toContainText('dev · lib/main_dev.dart');
 await expect(page.locator('#debug-reload')).toBeDisabled();
 await page.locator('#debug-run').click();await expect(page.locator('#ide-summary')).toContainText('Starting debug');
 await expect(page.locator('#toast-region')).toContainText('Debug started in your IDE');
 expect(commands[0].expectedWorkspace).toBeTruthy();
 debugging=true;await page.reload();await expect(page.locator('body')).toHaveAttribute('data-ui-ready','true');
 await expect(page.locator('#debug-run')).toBeDisabled();
 for(const [button,command]of [['reload','hotReload'],['restart','hotRestart'],['stop','stop']]){
  await page.locator('#debug-'+button).click();await expect.poll(()=>commands.at(-1).command).toBe(command);
 }
 for(const width of [1440,768,375]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.setViewportSize({width:1440,height:1000});
 await page.screenshot({path:'screenshots/debug-toolbar.png',fullPage:true});
});

test('debug launch errors are shown and the Run button recovers',async({page})=>{
 await page.route('**/api/state',async route=>{const response=await route.fetch(),state=await response.json();state.settings.targetIds=['demo-android-1'];state.debugSessions=[];await route.fulfill({json:state});});
 await page.route('**/api/ide/launch',route=>route.fulfill({status:400,json:{error:'Open this project in your IDE with Snapkit Debug Sync 1.7 or newer, then reload the IDE window.'}}));
 await page.goto('/');await expect(page.locator('body')).toHaveAttribute('data-ui-ready','true');
 await page.locator('#debug-run').click();await expect(page.locator('#toast-region')).toContainText('Snapkit Debug Sync 1.7');
 await expect(page.locator('#debug-run')).toBeEnabled();
});
