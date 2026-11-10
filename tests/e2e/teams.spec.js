import {test,expect} from './fixtures.js';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {createCloud} from '../../apps/cloud/src/index.js';
import {defaultContent} from '../../apps/cloud/src/accounts.js';

async function teamService(page,testInfo,mail=false){
 const directory=await mkdtemp(path.join(os.tmpdir(),'snapkit-teams-ui-'));
 const users=['owner','qa','lead','viewer'];let token='ui-team-owner';
 await writeFile(path.join(directory,'accounts.json'),JSON.stringify({users:Object.fromEntries(users.map(id=>[id,{id,email:id+'@example.com',name:id==='owner'?'Team Owner':id}])),sessions:Object.fromEntries(users.map(id=>[createHash('sha256').update('ui-team-'+id).digest('hex'),{userId:id,expires:Date.now()+86400000}])),content:defaultContent(),audit:[]}));
 const server=createCloud({env:{SNAPKIT_CLOUD_DATA:directory,...(mail?{RESEND_API_KEY:'fixture-key',SNAPKIT_MAIL_FROM:'teams@example.com'}:{})},...(mail?{fetcher:async()=>Response.json({id:'fixture-mail'})}:{})}).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 await page.route('**/api/teams**',async route=>{
  const url=new URL(route.request().url()),suffix=url.pathname.slice('/api/teams'.length);
  if(suffix==='/local-session'){return route.fulfill({json:{session:null}});}
  const response=await fetch(base+'/v1/teams'+suffix,{method:route.request().method(),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(route.request().postData()?{body:route.request().postData()}: {})});
  await route.fulfill({status:response.status,json:await response.json()});
 });
 const cleanup=async()=>{await page.unrouteAll({behavior:'wait'}).catch(()=>{});await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});};
 cleanup.asUser=id=>{token='ui-team-'+id;};
 cleanup.api=async(user,route,data)=>{const response=await fetch(base+'/v1/teams'+route,{method:data===undefined?'GET':'POST',headers:{Authorization:'Bearer ui-team-'+user,'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})});const result=await response.json();expect(response.ok,JSON.stringify(result)).toBe(true);return result;};
 return cleanup;
}

test('Personal and Teams stay separate while real cloud project, service, membership and bookings persist',async({page},testInfo)=>{
 const cleanup=await teamService(page,testInfo);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('/');await expect(page.locator('#workspace-switch')).toBeVisible();
  const personal=(await page.request.get('/api/state').then(r=>r.json())).settings;
  await page.getByRole('button',{name:'Teams',exact:true}).click();
  await expect(page.locator('body')).toHaveAttribute('data-product-mode','teams');
  await expect(page.locator('#workspace-switch')).toBeHidden();await expect(page.getByRole('heading',{name:'Set up your team workspace'})).toBeVisible();
  await page.locator('.teams-empty').getByRole('button',{name:'Create team workspace',exact:true}).click();
  const dialog=page.locator('.teams-dialog');
  await dialog.getByLabel('Team workspace name').fill('Engineering');await dialog.getByRole('button',{name:'Save',exact:true}).click();
  await expect(dialog).toBeHidden();await expect(page.locator('.teams-topbar')).toContainText('Engineering');
  await page.getByRole('button',{name:'Create team project',exact:true}).click();await dialog.getByLabel('Project name',{exact:true}).fill('Merchant Platform');await dialog.getByLabel('Description',{exact:true}).fill('Mobile + APIs');await dialog.getByRole('button',{name:'Save',exact:true}).click();await expect(dialog).toBeHidden();
  await page.getByRole('button',{name:'Projects & services',exact:true}).click();
  await page.locator('.teams-sectionbar').getByRole('button',{name:'Add service',exact:true}).click();
  await dialog.getByLabel('Service name').fill('Orders API');await dialog.getByLabel('Repository URL').fill('https://github.com/example/orders');await dialog.getByLabel('Runtime requirement').fill('Node 22');await dialog.getByRole('button',{name:'Save',exact:true}).click();await expect(dialog).toBeHidden();
  await expect(page.locator('.teams-service')).toContainText('Orders API');
  await page.getByRole('button',{name:'Members & access',exact:true}).click();await page.getByRole('button',{name:'Invite team member',exact:true}).click();await dialog.getByLabel('Google account email').fill('qa@example.com');await dialog.getByRole('combobox',{name:'Team role',exact:true}).click();await dialog.getByRole('option',{name:'QA',exact:true}).click();await dialog.getByRole('button',{name:'Create invitation',exact:true}).click();await expect(dialog).toBeHidden();await expect(page.locator('.teams-events')).toContainText('qa@example.com');
  await page.getByRole('button',{name:'Device Lab',exact:true}).click();await page.getByRole('button',{name:'Register team device',exact:true}).click();await dialog.getByLabel('Device name').fill('Pixel QA');await dialog.getByLabel('Host label').fill('Lab Mac');await dialog.getByRole('button',{name:'Save',exact:true}).click();await expect(dialog).toBeHidden();
  await page.getByRole('button',{name:'Book 30 minutes',exact:true}).click();await expect(page.getByRole('button',{name:'Release booking',exact:true})).toBeVisible();await page.getByRole('button',{name:'Release booking',exact:true}).click();
  await page.getByRole('button',{name:'Handoffs & approvals',exact:true}).click();await page.getByRole('button',{name:'Create QA handoff',exact:true}).click();await dialog.getByLabel('Handoff title').fill('Checkout timeout');await dialog.getByLabel('Commit hash').fill('abc1234');await dialog.getByLabel('Build artifact URL').fill('https://builds.example.com/142');await dialog.getByLabel('Build SHA-256').fill('a'.repeat(64));await dialog.getByLabel('Test steps').fill('Open checkout');await dialog.getByRole('button',{name:'Save',exact:true}).click();await expect(dialog).toBeHidden();await expect(page.locator('.teams-handoff-list')).toContainText('Checkout timeout');await expect(page.getByRole('button',{name:'Approve release',exact:true})).toHaveCount(0);
  await page.reload();await expect(page.locator('.teams-topbar')).toContainText('Engineering');
  await page.getByRole('button',{name:'Projects & services',exact:true}).click();await expect(page.locator('.teams-service')).toContainText('Orders API');
  await expect(page.getByRole('button',{name:'Projects & services',exact:true})).toHaveAttribute('aria-current','page');await page.screenshot({path:testInfo.outputPath('teams-projects.png'),fullPage:true,animations:'disabled'});
  await page.getByRole('button',{name:'Personal',exact:true}).click();await expect(page.locator('#workspace-switch')).toBeVisible();await expect(page.locator('.teams-application')).toBeHidden();
  expect((await page.request.get('/api/state').then(r=>r.json())).settings).toEqual(personal);
  await page.reload();await expect(page.locator('body')).toHaveAttribute('data-product-mode','personal');expect(errors).toEqual([]);
 }finally{await cleanup();}
});

test('Teams empty state, translated creation and scoped controls fit mobile light theme',async({page},testInfo)=>{
 const cleanup=await teamService(page,testInfo);
 try{
  await page.addInitScript(()=>{localStorage.setItem('snapkit-theme','light');localStorage.setItem('snapkit-product-mode','teams');});
  await page.setViewportSize({width:375,height:812});await page.goto('/?lang=vi');
  await expect(page.getByRole('heading',{name:'Thiết lập workspace cho team'})).toBeVisible();
  await page.locator('.teams-empty').getByRole('button',{name:'Tạo workspace cho team',exact:true}).click();
  const dialog=page.locator('.teams-dialog');await expect(dialog.getByLabel('Tên workspace của team')).toBeVisible();
  expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await dialog.getByLabel('Tên workspace của team').fill('Team Việt');await dialog.getByRole('button',{name:'Lưu',exact:true}).click();await expect(dialog).toBeHidden();
  await expect(page.locator('.teams-topbar')).toContainText('Team Việt');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Thành viên & quyền',exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('teams-mobile-light.png'),fullPage:true});
 }finally{await cleanup();}
});

test('Teams handles unavailable cloud service without inventing collaboration data',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Teams',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Teams requires a signed-in local app.');
 await expect(page.locator('.teams-topbar')).toContainText('Your team');
 await expect(page.locator('.teams-main')).not.toContainText('Villship Engineering');
 await page.getByRole('button',{name:'Personal',exact:true}).click();await expect(page.locator('#workspace-switch')).toBeVisible();
});

test('QA, Lead and Viewer see their real permissions and move the same immutable handoff through approval',async({page},testInfo)=>{
 const cleanup=await teamService(page,testInfo);
 try{
  let workspace=await cleanup.api('owner','',{name:'Release team'});const base='/'+workspace.id;
  workspace=await cleanup.api('owner',base+'/projects',{name:'Shared API'});const projectId=workspace.projects[0].id;
  for(const role of ['qa','lead','viewer']){
   workspace=await cleanup.api('owner',base+'/invitations',{email:role+'@example.com',role,projectIds:[projectId],environments:['development','staging'],serviceLayers:['backend']});
   const invitation=workspace.invitations.find(i=>i.email===role+'@example.com');await cleanup.api(role,'/invitations/'+invitation.id+'/accept',{});
  }
  await cleanup.api('owner',base+'/handoffs',{projectId,title:'API release candidate',environment:'development',commit:'abc1234',buildUrl:'https://builds.example.com/api/1',artifactSha256:'a'.repeat(64),blueprintVersion:1});
  cleanup.asUser('qa');await page.route('**/api/state',async route=>{const response=await route.fetch(),result=await response.json();result.demo=false;await route.fulfill({json:result});});await page.addInitScript(()=>localStorage.setItem('snapkit-product-mode','teams'));await page.goto('/');
  await page.getByRole('button',{name:'Handoffs & approvals',exact:true}).click();await page.getByRole('button',{name:'Confirm QA passed',exact:true}).click();await expect(page.locator('.teams-handoff-list')).toContainText('QA confirmed');await expect(page.getByRole('button',{name:'Approve release',exact:true})).toHaveCount(0);
  cleanup.asUser('lead');await page.reload();await page.getByRole('button',{name:'Handoffs & approvals',exact:true}).click();await page.getByRole('button',{name:'Approve release',exact:true}).click();await expect(page.locator('.teams-handoff-list')).toContainText('Approved');
  cleanup.asUser('viewer');await page.reload();await expect(page.getByRole('button',{name:'Prepare local session',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Handoffs & approvals',exact:true}).click();await expect(page.locator('.teams-handoff-list')).toContainText('Approved');await expect(page.getByRole('button',{name:'Create QA handoff',exact:true})).toHaveCount(0);
 }finally{await cleanup();}
});

test('first-run setup can open Teams without creating a personal developer profile',async({page},testInfo)=>{
 const cleanup=await teamService(page,testInfo);
 try{
  await page.route('**/api/product',async route=>{const response=await route.fetch();const result=await response.json();delete result.preferences.developerProfile;await route.fulfill({json:result});});
  await page.goto('/');await expect(page.locator('#developer-onboarding')).toBeVisible();await page.getByRole('button',{name:'Open Snapkit Teams',exact:true}).click();await expect(page.locator('#developer-onboarding')).not.toBeVisible();await expect(page.getByRole('heading',{name:'Set up your team workspace'})).toBeVisible();
 }finally{await cleanup();}
});

test('setup journey follows saved data and invitation acceptance; every Teams menu uses themed options',async({page},testInfo)=>{
 const cleanup=await teamService(page,testInfo);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const dialog=page.locator('.teams-dialog'),journey=page.locator('.teams-setup');
 async function choose(name,option){const trigger=page.getByRole('combobox',{name,exact:true});await trigger.click();await expect(trigger).toHaveAttribute('aria-expanded','true');const item=page.getByRole('option',{name:option,exact:true});await expect(item).toBeVisible();const bounds=await item.boundingBox();expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.y).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(1440);await item.click();await expect(trigger).toHaveAttribute('aria-expanded','false');}
 try{
  await page.goto('/?product=teams');await page.locator('.teams-empty').getByRole('button',{name:'Create team workspace',exact:true}).click();
  await expect(dialog).toContainText('Step 1 of 4');await dialog.getByLabel('Team workspace name').fill('Guided team');await dialog.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Team project',exact:true})).toBeDisabled();await expect(journey).toContainText('Completed 1 of 4 steps');await expect(journey.locator('[aria-current=step]')).toContainText('Project');
  await choose('Team workspace','Guided team');await choose('Language','EN');
  await journey.getByRole('button',{name:'Create team project',exact:true}).click();await expect(dialog).toContainText('Step 2 of 4');await dialog.getByLabel('Project name',{exact:true}).fill('Web portal');await dialog.getByRole('button',{name:'Save',exact:true}).click();
  await expect(journey).toContainText('Completed 2 of 4 steps');await choose('Team project','Web portal');await choose('Team environment','Staging');await choose('Team environment','Development');
  await journey.getByRole('button',{name:'Add service',exact:true}).click();await expect(dialog).toContainText('Step 3 of 4');await dialog.getByLabel('Service name').fill('Portal UI');
  await choose('Project layer','frontend');await choose('Service owner','Team Owner');
  const layer=dialog.getByRole('combobox',{name:'Project layer',exact:true});await layer.focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Escape');await expect(dialog).toBeVisible();await expect(layer).toHaveAttribute('aria-expanded','false');await expect(layer).toBeFocused();
  await dialog.getByRole('button',{name:'Save',exact:true}).click();await expect(journey).toContainText('Completed 3 of 4 steps');
  await journey.getByRole('button',{name:'Invite team member',exact:true}).click();await expect(dialog).toContainText('Step 4 of 4');await dialog.getByLabel('Google account email').fill('qa@example.com');
  const role=dialog.getByRole('combobox',{name:'Team role',exact:true});await role.focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('End');await page.keyboard.press('Enter');await expect(role).toContainText('Viewer');
  await dialog.getByRole('button',{name:'Create invitation',exact:true}).click();await expect(journey).toContainText('Completed 3 of 4 steps');await expect(journey).toContainText('Waiting for your teammate to accept');
  await page.reload();await expect(journey).toContainText('Completed 3 of 4 steps');
  const listing=await cleanup.api('qa','');await cleanup.api('qa','/invitations/'+listing.invitations[0].id+'/accept',{});
  await page.getByRole('button',{name:'Refresh',exact:true}).click();await expect(journey).toHaveCount(0);await expect(page.locator('.teams-workspace-summary')).toContainText('Workspace ready');
  const teams=await cleanup.api('owner','');const workspace=await cleanup.api('owner','/'+teams.workspaces[0].id);expect(workspace.members.find(m=>m.userId==='qa').role).toBe('viewer');expect(workspace.projects[0].blueprint.services[0]).toMatchObject({kind:'frontend',ownerId:'owner'});
  await page.getByRole('button',{name:'Device Lab',exact:true}).click();await page.getByRole('button',{name:'Register team device',exact:true}).click();await choose('Platform','iOS');await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('button',{name:'Overview',exact:true}).click();await page.getByRole('combobox',{name:'Language',exact:true}).click();await page.getByRole('heading',{name:'Overview',exact:true}).click();await expect(page.getByRole('combobox',{name:'Language',exact:true})).toHaveAttribute('aria-expanded','false');
  expect(await page.locator('.teams-application select,.teams-dialog select').count()).toBe(0);
  await page.screenshot({path:testInfo.outputPath('teams-setup-complete.png'),fullPage:true});
  await page.setViewportSize({width:375,height:812});await choose('Switch team workspace','Guided team');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
 }finally{await cleanup();}
});

test('invitation email status is visible and resend reports its cooldown without losing the invitation',async({page},testInfo)=>{
 const cleanup=await teamService(page,testInfo,true);
 try{
  let workspace=await cleanup.api('owner','',{name:'Email team'});workspace=await cleanup.api('owner','/'+workspace.id+'/invitations',{email:'qa@example.com',role:'qa',projectIds:null,environments:['development']});
  await page.goto('/?product=teams');await page.getByRole('button',{name:'Members & access',exact:true}).click();await expect(page.locator('.teams-events')).toContainText('Invitation email sent');
  await page.getByRole('button',{name:'Resend email',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Wait one minute');await expect(page.locator('.teams-events')).toContainText('qa@example.com');
 }finally{await cleanup();}
});

test('notification bell shows invitations, persists reads and navigates from Personal to Teams',async({page},testInfo)=>{
 const cleanup=await teamService(page,testInfo);
 try{
  const w=await cleanup.api('owner','',{name:'Bell team'});
  await cleanup.api('owner','/'+w.id+'/invitations',{email:'qa@example.com',role:'qa',projectIds:null,environments:['development']});
  cleanup.asUser('qa');
  await page.route('**/api/state',async route=>{const response=await route.fetch(),result=await response.json();result.demo=false;await route.fulfill({json:result});});
  await page.goto('/');
  const bell=page.locator('.notification-trigger:visible'),panel=page.locator('.notification-panel');
  await bell.click();await expect(panel).toBeVisible();await expect(bell).toContainText('1');
  await expect(panel.getByText('You have a team invitation',{exact:true})).toBeVisible();
  await page.keyboard.press('Escape');await expect(panel).toBeHidden();await expect(bell).toBeFocused();
  await bell.click();await panel.getByRole('button',{name:'Mark all as read',exact:true}).click();await expect(bell.locator('.notification-count')).toHaveCount(0);
  await panel.getByRole('button',{name:'Unread',exact:true}).click();await expect(panel).toContainText('You are all caught up.');
  await page.reload();await page.locator('.notification-trigger:visible').click();await expect(panel).toContainText('You have a team invitation');await expect(page.locator('.notification-count')).toHaveCount(0);
  await panel.getByRole('button',{name:/You have a team invitation/}).click();
  await expect(page.locator('body')).toHaveAttribute('data-product-mode','teams');await expect(page.getByRole('button',{name:'Accept invitation',exact:true})).toBeVisible();
  await page.locator('.notification-trigger:visible').click();await expect(panel).toBeVisible();await page.locator('.teams-sidebar').click();await expect(panel).toBeHidden();
  await page.setViewportSize({width:375,height:812});await page.locator('.notification-trigger:visible').click();
  await expect(panel).toBeVisible();const box=await panel.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(375);
  await page.screenshot({path:testInfo.outputPath('notifications-mobile.png'),animations:'disabled'});
 }finally{await cleanup();}
});

test('QA notification opens the referenced project and environment',async({page},testInfo)=>{
 const cleanup=await teamService(page,testInfo);
 try{
  const w=await cleanup.api('owner','',{name:'Build team'}),base='/'+w.id;
  await cleanup.api('owner',base+'/projects',{name:'First project'});
  const p2=await cleanup.api('owner',base+'/projects',{name:'Target project'}),project=p2.projects[1];
  const invited=await cleanup.api('owner',base+'/invitations',{email:'qa@example.com',role:'qa',projectIds:null,environments:['development','staging']});
  await cleanup.api('qa','/invitations/'+invited.invitations[0].id+'/accept',{});
  await cleanup.api('owner',base+'/handoffs',{title:'Staging checkout',projectId:project.id,environment:'staging',commit:'abc1234',artifactSha256:'a'.repeat(64),blueprintVersion:project.blueprint.version,buildUrl:'https://example.com/build.zip',steps:'Check checkout'});
  cleanup.asUser('qa');await page.route('**/api/state',async route=>{const response=await route.fetch(),result=await response.json();result.demo=false;await route.fulfill({json:result});});await page.addInitScript(()=>localStorage.setItem('snapkit-product-mode','teams'));await page.goto('/');
  await expect(page.locator('.teams-topbar')).toContainText('Build team');await page.getByRole('button',{name:'Personal',exact:true}).click();await page.locator('.notification-trigger:visible').click();
  await page.locator('.notification-panel').getByRole('button',{name:/QA review needed/}).click();
  await expect(page.locator('.teams-handoff-list')).toContainText('Staging checkout');await expect(page.getByRole('button',{name:'Confirm QA passed',exact:true})).toBeVisible();
  await page.locator('.notification-trigger:visible').click();await page.screenshot({path:testInfo.outputPath('notifications-desktop.png'),animations:'disabled'});
 }finally{await cleanup();}
});

test('project icon presets and image upload persist with the project name',async({page},testInfo)=>{
 const cleanup=await teamService(page,testInfo);
 try{
  const w=await cleanup.api('owner','',{name:'Icon team'});await cleanup.api('owner','/'+w.id+'/projects',{name:'Flutter app'});
  await page.goto('/?product=teams');await page.getByRole('button',{name:'Projects & services',exact:true}).click();await page.getByRole('button',{name:'Edit project',exact:true}).click();
  const dialog=page.locator('.teams-dialog');await dialog.getByRole('button',{name:'Mobile app',exact:true}).click();await dialog.getByLabel('Project name',{exact:true}).fill('Flutter Delivery');await dialog.getByRole('button',{name:'Save',exact:true}).click();await expect(dialog).toBeHidden();
  await page.reload();await page.getByRole('button',{name:'Projects & services',exact:true}).click();await expect(page.locator('.teams-project')).toContainText('Flutter Delivery');await page.getByRole('button',{name:'Edit project',exact:true}).click();await expect(dialog.getByRole('button',{name:'Mobile app',exact:true})).toHaveAttribute('aria-pressed','true');
  const png=Buffer.from(await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=32;const ctx=canvas.getContext('2d');ctx.fillStyle='#7654bb';ctx.fillRect(0,0,32,32);return canvas.toDataURL('image/png').split(',')[1];}),'base64');
  await dialog.getByLabel('Upload project icon').setInputFiles({name:'logo.png',mimeType:'image/png',buffer:png});await expect(dialog.locator('.teams-icon-preview img')).toBeVisible();await dialog.getByRole('button',{name:'Save',exact:true}).click();await expect(dialog).toBeHidden();await page.reload();await page.getByRole('button',{name:'Projects & services',exact:true}).click();await expect(page.locator('.teams-project .project-icon img')).toBeVisible();
  await page.getByRole('button',{name:'Edit project',exact:true}).click();await dialog.getByLabel('Upload project icon').setInputFiles({name:'unsafe.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});await expect(dialog.getByRole('alert')).toContainText('Choose a PNG');
  await page.screenshot({path:testInfo.outputPath('project-icon-editor.png'),animations:'disabled'});
 }finally{await cleanup();}
});

test('notification chime sounds for new items once and respects persisted mute',async({page})=>{
 const cleanup=await teamService(page);
 try{
  const w=await cleanup.api('owner','',{name:'Sound team'}),base='/'+w.id,p=await cleanup.api('owner',base+'/projects',{name:'Flutter'}),project=p.projects[0];
  const invited=await cleanup.api('owner',base+'/invitations',{email:'qa@example.com',role:'qa',projectIds:null,environments:['development']});await cleanup.api('qa','/invitations/'+invited.invitations[0].id+'/accept',{});cleanup.asUser('qa');
  await page.addInitScript(()=>{window.__tones=0;const original=AudioContext.prototype.createOscillator;AudioContext.prototype.createOscillator=function(){window.__tones++;return original.call(this);};});
  const handoff=title=>cleanup.api('owner',base+'/handoffs',{title,projectId:project.id,environment:'development',commit:'abc1234',artifactSha256:'a'.repeat(64),blueprintVersion:project.blueprint.version,buildUrl:'https://example.com/build.zip'});
  await page.goto('/?product=teams');await page.locator('.notification-trigger:visible').click();const panel=page.locator('.notification-panel');await panel.getByRole('button',{name:'Test sound',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__tones)).toBe(2);await page.evaluate(()=>window.__tones=0);
  await handoff('First build');await page.evaluate(()=>document.dispatchEvent(new Event('snapkit:teams-updated')));await expect.poll(()=>page.evaluate(()=>window.__tones)).toBe(2);
  await page.evaluate(()=>document.dispatchEvent(new Event('snapkit:teams-updated')));await expect(panel).toContainText('First build');expect(await page.evaluate(()=>window.__tones)).toBe(2);
  await panel.getByRole('button',{name:'Notification sound',exact:true}).click();await page.reload();await page.locator('.notification-trigger:visible').click();await expect(panel.getByRole('button',{name:'Notification sound',exact:true})).toHaveAttribute('aria-pressed','false');expect(await page.evaluate(()=>window.__tones)).toBe(0);
  await handoff('Muted build');await page.evaluate(()=>document.dispatchEvent(new Event('snapkit:teams-updated')));await expect(panel).toContainText('Muted build');expect(await page.evaluate(()=>window.__tones)).toBe(0);
 }finally{await cleanup();}
});

test('local Teams transport accepts normalized icons while keeping other request limits small',async({page})=>{
 const state=await page.request.get('/api/state').then(r=>r.json()),headers={'X-Snapkit-Token':state.token};
 const data={name:'Icon',icon:'data:image/png;base64,'+'A'.repeat(90000)};
 const accepted=await page.request.post('/api/teams/example/projects',{headers,data});expect(accepted.status()).toBe(503);expect(await accepted.json()).toMatchObject({error:expect.stringContaining('signed-in local app')});
 const standardLimit=await page.request.post('/api/settings',{headers,data});expect(standardLimit.status()).toBe(400);expect((await standardLimit.json()).error).toContain('too large');
 const teamsLimit=await page.request.post('/api/teams/example/projects',{headers,data:{...data,icon:'A'.repeat(140000)}});expect(teamsLimit.status()).toBe(400);expect((await teamsLimit.json()).error).toContain('too large');
});

test('Lead assigns a task through themed controls and assignee follows acceptance, checklist, review and final approval',async({page},testInfo)=>{
 const cleanup=await teamService(page,testInfo);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  let w=await cleanup.api('owner','',{name:'Delivery team'});const base='/'+w.id;w=await cleanup.api('owner',base+'/projects',{name:'Flutter project'});const projectId=w.projects[0].id;
  for(const [user,role] of [['qa','qa'],['lead','lead']]){w=await cleanup.api('owner',base+'/invitations',{email:user+'@example.com',role,projectIds:[projectId],environments:['development'],serviceLayers:['mobile']});await cleanup.api(user,'/invitations/'+w.invitations.find(x=>x.email===user+'@example.com').id+'/accept',{});}
  await page.goto('/?product=teams');await page.getByRole('button',{name:'Tasks',exact:true}).click();await page.getByRole('button',{name:'Create task',exact:true}).click();const dialog=page.locator('.teams-dialog');await dialog.getByLabel('Task title',{exact:true}).fill('Flutter recovery');await dialog.getByLabel('Acceptance criteria',{exact:true}).fill('Retry succeeds\nError is visible');
  await dialog.getByRole('combobox',{name:'Assignee',exact:true}).click();await dialog.getByRole('option',{name:'Team Owner',exact:true}).click();await dialog.getByText('Review, testing & dependencies',{exact:true}).click();
  for(const name of ['Reviewer','Tester','Approver']){await dialog.getByRole('combobox',{name,exact:true}).click();await dialog.getByRole('option',{name:name==='Approver'?'lead':'qa',exact:true}).click();}
  await dialog.getByRole('button',{name:'Save',exact:true}).click();await expect(dialog).toBeHidden();await page.locator('.teams-task-card').click();const detail=page.getByRole('region',{name:'Task details'});await expect(detail).toContainText('Next step: Accept task');await detail.getByRole('button',{name:'Accept task',exact:true}).click();await detail.getByRole('button',{name:'In progress',exact:true}).click();await detail.getByLabel('Retry succeeds',{exact:true}).check();await detail.getByLabel('Error is visible',{exact:true}).check();await detail.getByRole('button',{name:'Code review',exact:true}).click();await expect(detail).toContainText('Waiting for reviewer');
  cleanup.asUser('qa');await page.reload();await page.getByRole('button',{name:'Tasks',exact:true}).click();await page.locator('.teams-task-card').click();await detail.getByRole('button',{name:'Testing',exact:true}).click();await detail.getByRole('button',{name:'Final approval',exact:true}).click();await expect(detail.getByRole('button',{name:'Done',exact:true})).toHaveCount(0);
  cleanup.asUser('lead');await page.reload();await page.getByRole('button',{name:'Tasks',exact:true}).click();await page.locator('.teams-task-card').click();await detail.getByRole('button',{name:'Done',exact:true}).click();await expect(detail).toContainText('Next step: Done');await expect(page.locator('.teams-application select:visible')).toHaveCount(0);expect(errors).toEqual([]);
 }finally{await cleanup();}
});

test('push notification permission is explicit and denial provides actionable recovery',async({page},testInfo)=>{const cleanup=await teamService(page,testInfo);try{await page.addInitScript(()=>{Object.defineProperty(Notification,'requestPermission',{value:async()=> 'denied'});});await page.goto('/?product=teams');await page.locator('.notification-trigger:visible').click();const panel=page.locator('.notification-panel');await panel.getByRole('button',{name:'Enable push notifications',exact:true}).click();await expect(panel.getByRole('alert')).toContainText('Allow notifications in your browser settings');await expect(panel.getByRole('button',{name:'Enable push notifications',exact:true})).toHaveAttribute('aria-pressed','false');}finally{await cleanup();}});

test('task updates preserve navigation, draft text, open details and DOM nodes; a transient refresh keeps the current workspace',async({page},testInfo)=>{
 const cleanup=await teamService(page,testInfo);try{
 let w=await cleanup.api('owner','',{name:'Stable workspace'});const base='/'+w.id;w=await cleanup.api('owner',base+'/projects',{name:'Stable project'});w=await cleanup.api('owner',base+'/tasks',{projectId:w.projects[0].id,environment:'development',layer:'mobile',title:'Stable task',assigneeId:'owner',criteria:['Verify result'],dependencies:[]});
 await page.goto('/?product=teams');await page.getByRole('button',{name:'Tasks',exact:true}).click();await page.locator('.teams-task-card').click();
 const detail=page.getByRole('region',{name:'Task details'});await detail.getByLabel('Comment',{exact:true}).fill('Unsaved discussion draft');await detail.getByText('Blockers & cancellation',{exact:true}).click();await detail.getByLabel('Blocker reason').fill('Draft reason');const node=await detail.elementHandle();
 await page.route('**/api/teams/**/tasks/**/accept',async route=>{await new Promise(r=>setTimeout(r,250));await route.fallback();});
 await detail.getByRole('button',{name:'Accept task',exact:true}).click();await expect(page.getByRole('button',{name:'Projects & services',exact:true})).toBeEnabled();await expect(page.getByRole('combobox',{name:'Team environment',exact:true})).toBeEnabled();await expect(page.locator('.teams-main')).toHaveAttribute('aria-busy','false');await expect(detail.getByRole('button',{name:'In progress',exact:true})).toBeEnabled();
 expect(await node.evaluate(n=>n.isConnected)).toBe(true);await expect(detail.getByLabel('Comment',{exact:true})).toHaveValue('Unsaved discussion draft');await expect(detail.getByLabel('Blocker reason')).toHaveValue('Draft reason');
 await page.route('**/api/teams',route=>route.fulfill({status:503,json:{error:'Temporary network failure'}}));await page.getByRole('button',{name:'Refresh',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Temporary network failure');await expect(detail).toBeVisible();expect(await node.evaluate(n=>n.isConnected)).toBe(true);await expect(detail.getByLabel('Comment',{exact:true})).toHaveValue('Unsaved discussion draft');
 }finally{await cleanup();}
});

test('workspace synchronization and device polling keep the Teams Debug Sync form mounted and preserve selected targets',async({page},testInfo)=>{
 const cleanup=await teamService(page,testInfo);try{
 let w=await cleanup.api('owner','',{name:'Stable debug'});const base='/'+w.id;w=await cleanup.api('owner',base+'/projects',{name:'Mobile'});const projectId=w.projects[0].id;w=await cleanup.api('owner',base+'/tasks',{projectId,environment:'development',layer:'mobile',title:'Debug task',assigneeId:'owner',criteria:['Ready'],dependencies:[]});let task=w.tasks[0];w=await cleanup.api('owner',base+'/tasks/'+task.id+'/accept',{version:task.version});task=w.tasks[0];await cleanup.api('owner',base+'/tasks/'+task.id+'/transition',{version:task.version,status:'in-progress'});
 await page.route('**/api/teams/local-debug?**',async route=>{await new Promise(r=>setTimeout(r,120));await route.fulfill({json:{binding:{path:'/local/mobile',framework:'flutter'},devices:[{id:'device',name:'Local Android',platform:'android',state:'online'}],active:null,extensionConnected:false}});});
 await page.goto('/?product=teams');await page.getByRole('button',{name:'Tasks',exact:true}).click();await page.locator('.teams-task-card').click();await page.getByRole('button',{name:'Debug Sync',exact:true}).click();await page.getByLabel('Local Android · android · online').check();await page.getByText('Build options',{exact:true}).click();await page.getByRole('textbox',{name:'Flavor',exact:true}).fill('staging');const field=await page.getByRole('textbox',{name:'Flavor',exact:true}).elementHandle();
 await cleanup.api('owner',base+'/projects/'+projectId+'/identity',{name:'Mobile updated',description:'',icon:'smartphone'});await page.getByRole('button',{name:'Refresh',exact:true}).click();await expect(page.getByRole('combobox',{name:'Team project',exact:true})).toContainText('Mobile updated');await expect(page.locator('.teams-main')).toHaveAttribute('aria-busy','false');await expect(page.getByRole('textbox',{name:'Flavor',exact:true})).toHaveValue('staging');await expect(page.getByLabel('Local Android · android · online')).toBeChecked();expect(await field.evaluate(n=>n.isConnected)).toBe(true);
 await page.clock.install();const polled=page.waitForResponse(response=>response.url().includes('/api/teams/local-debug?'));await page.clock.fastForward(15000);await polled;await expect(page.getByRole('textbox',{name:'Flavor',exact:true})).toHaveValue('staging');expect(await field.evaluate(n=>n.isConnected)).toBe(true);
 }finally{await cleanup();}
});

test('notification background refresh preserves visible items and focus on temporary errors, but clears unauthorized data',async({page},testInfo)=>{
 const cleanup=await teamService(page,testInfo);try{
  const w=await cleanup.api('owner','',{name:'Invitation team'});await cleanup.api('owner','/'+w.id+'/invitations',{email:'qa@example.com',role:'qa',projectIds:null,environments:['development']});cleanup.asUser('qa');
  await page.goto('/?product=teams');await page.locator('.notification-trigger:visible').click();const panel=page.locator('.notification-panel'),item=panel.locator('.notification-item').first();await expect(item).toContainText('You have a team invitation');await item.focus();const node=await item.elementHandle();
  await page.route('**/api/teams/notifications',async route=>{await new Promise(r=>setTimeout(r,100));await route.fulfill({status:503,json:{error:'Temporary network failure'}});});
  const failed=page.waitForResponse(response=>response.url().endsWith('/api/teams/notifications')&&response.status()===503);await page.evaluate(()=>document.dispatchEvent(new Event('snapkit:teams-updated')));await expect(panel.locator('.notification-content')).toHaveAttribute('aria-busy','false');await failed;await expect(item).toBeVisible();await expect(item).toBeFocused();expect(await node.evaluate(n=>n.isConnected)).toBe(true);
  await page.route('**/api/teams/notifications',route=>route.fulfill({status:401,json:{error:'Sign in required'}}));await page.evaluate(()=>document.dispatchEvent(new Event('snapkit:teams-updated')));await expect(panel.locator('.notification-item')).toHaveCount(0);await expect(panel.getByRole('alert')).toContainText('Could not update notifications.');
 }finally{await cleanup();}
});

test('workspace overview separates team cards from actions and keeps local connection status concise',async({page},testInfo)=>{
 const cleanup=await teamService(page,testInfo);try{
  let w=await cleanup.api('owner','',{name:'Layout team'});const base='/'+w.id;w=await cleanup.api('owner',base+'/projects',{name:'Mobile'});const projectId=w.projects[0].id;
  w=await cleanup.api('owner',base+'/projects/'+projectId+'/blueprint',{version:1,services:[{name:'Mobile',kind:'mobile',runtime:'Flutter'}]});w=await cleanup.api('owner',base+'/invitations',{email:'qa@example.com',role:'qa',projectIds:null,environments:['development']});await cleanup.api('qa','/invitations/'+w.invitations[0].id+'/accept',{});
  await page.route('**/api/teams/local-session?**',route=>route.fulfill({json:{session:{path:'/local/mobile',framework:'flutter',blueprintVersion:2,preparedAt:new Date().toISOString(),status:'prepared'}}}));await page.goto('/?product=teams');
  await expect(page.locator('.teams-session strong')).toHaveText('Local project prepared');await expect(page.locator('.teams-session')).not.toContainText('Blueprint');
  for(const width of [1440,1024,768,375]){await page.setViewportSize({width,height:1000});const groups=await page.locator('.teams-team-groups').boundingBox(),actions=await page.locator('.teams-overview-actions').boundingBox();expect(actions.y-(groups.y+groups.height)).toBeGreaterThanOrEqual(24);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 }finally{await cleanup();}
});

test('Personal and Teams share fixed brand and mode-switch geometry on desktop and mobile',async({page},testInfo)=>{
 const cleanup=await teamService(page,testInfo);try{
  await page.goto('/?product=personal');await expect(page.locator('body')).toHaveAttribute('data-ui-ready','true');
  for(const width of [1440,1024,768,375]){await page.setViewportSize({width,height:1000});const brand=await page.locator('.sidebar .brand-mark').boundingBox(),toggle=await page.locator('.personal-product-switch .product-mode-switch').boundingBox();await page.getByRole('button',{name:'Teams',exact:true}).click();await expect(page.locator('body')).toHaveAttribute('data-product-mode','teams');const teamBrand=await page.locator('.teams-brand>span').boundingBox(),teamToggle=await page.locator('.teams-sidebar>.product-mode-switch').boundingBox();for(const key of ['x','y','width','height']){expect(teamBrand[key],JSON.stringify({width,key,brand,teamBrand})).toBeCloseTo(brand[key],1);expect(teamToggle[key],JSON.stringify({width,key,toggle,teamToggle})).toBeCloseTo(toggle[key],1);}await page.getByRole('button',{name:'Personal',exact:true}).click();await expect(page.locator('body')).toHaveAttribute('data-product-mode','personal');}
 }finally{await cleanup();}
});

test('Owner creates a reusable custom layer and assigns a task with a themed calendar date',async({page},testInfo)=>{
 const cleanup=await teamService(page,testInfo);try{
  let w=await cleanup.api('owner','',{name:'Custom team'});w=await cleanup.api('owner','/'+w.id+'/projects',{name:'AI platform'});await page.goto('/?product=teams');await page.getByRole('button',{name:'Projects & services',exact:true}).click();await page.locator('.teams-sectionbar').getByRole('button',{name:'Add service',exact:true}).click();const dialog=page.locator('.teams-dialog');await dialog.getByLabel('Service name',{exact:true}).fill('Ranking');await dialog.getByRole('combobox',{name:'Project layer',exact:true}).click();await dialog.getByRole('option',{name:'Custom layer…',exact:true}).click();await dialog.getByLabel('Custom layer name',{exact:true}).fill('AI & ML');await dialog.getByRole('button',{name:'Save',exact:true}).click();await expect(dialog).toBeHidden();await expect(page.locator('.teams-service')).toContainText('AI & ML');
  await page.getByRole('button',{name:'Tasks',exact:true}).click();await page.getByRole('button',{name:'Create task',exact:true}).click();await dialog.getByLabel('Task title',{exact:true}).fill('Tune ranking');await dialog.getByLabel('Acceptance criteria',{exact:true}).fill('Rank results');await dialog.getByRole('combobox',{name:'Project layer',exact:true}).click();await dialog.getByRole('option',{name:'AI & ML',exact:true}).click();await dialog.getByRole('combobox',{name:'Assignee',exact:true}).click();await dialog.getByRole('option',{name:'Team Owner',exact:true}).click();await dialog.getByRole('button',{name:'Due date',exact:true}).click();await expect(page.locator('.snapkit-date-popup')).toBeVisible();await page.locator('.snapkit-date-popup').getByRole('button',{name:'Today',exact:true}).click();await expect(page.locator('.snapkit-date-popup')).toBeHidden();const due=await dialog.locator('input[name=dueAt]').inputValue();expect(due).toMatch(/^\d{4}-\d{2}-\d{2}$/);await dialog.getByRole('button',{name:'Save',exact:true}).click();await expect(dialog).toBeHidden();await expect(page.locator('.teams-task-card')).toContainText('AI & ML');await expect(page.locator('.teams-task-card')).toContainText(due);
  await page.reload();await page.getByRole('button',{name:'Tasks',exact:true}).click();await expect(page.locator('.teams-task-card')).toContainText('Tune ranking');
 }finally{await cleanup();}
});
