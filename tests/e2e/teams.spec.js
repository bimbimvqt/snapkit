import {test,expect} from './fixtures.js';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {createCloud} from '../../apps/cloud/src/index.js';
import {defaultContent} from '../../apps/cloud/src/accounts.js';

async function teamService(page,testInfo){
 const directory=await mkdtemp(path.join(os.tmpdir(),'snapkit-teams-ui-'));
 const users=['owner','qa','lead','viewer'];let token='ui-team-owner';
 await writeFile(path.join(directory,'accounts.json'),JSON.stringify({users:Object.fromEntries(users.map(id=>[id,{id,email:id+'@example.com',name:id==='owner'?'Team Owner':id}])),sessions:Object.fromEntries(users.map(id=>[createHash('sha256').update('ui-team-'+id).digest('hex'),{userId:id,expires:Date.now()+86400000}])),content:defaultContent(),audit:[]}));
 const server=createCloud({env:{SNAPKIT_CLOUD_DATA:directory}}).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
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
  await expect(page.locator('#workspace-switch')).toBeHidden();await expect(page.getByRole('heading',{name:'Your team starts here'})).toBeVisible();
  await page.locator('.teams-empty').getByRole('button',{name:'Create team workspace',exact:true}).click();
  const dialog=page.locator('.teams-dialog');
  await dialog.getByLabel('Team workspace name').fill('Engineering');await dialog.getByRole('button',{name:'Save',exact:true}).click();
  await expect(dialog).toBeHidden();await expect(page.locator('.teams-topbar')).toContainText('Engineering');
  await page.getByRole('button',{name:'Create team project',exact:true}).click();await dialog.getByLabel('Project name',{exact:true}).fill('Merchant Platform');await dialog.getByLabel('Description',{exact:true}).fill('Mobile + APIs');await dialog.getByRole('button',{name:'Save',exact:true}).click();await expect(dialog).toBeHidden();
  await page.getByRole('button',{name:'Projects & services',exact:true}).click();
  await page.locator('.teams-sectionbar').getByRole('button',{name:'Add service',exact:true}).click();
  await dialog.getByLabel('Service name').fill('Orders API');await dialog.getByLabel('Repository URL').fill('https://github.com/example/orders');await dialog.getByLabel('Runtime requirement').fill('Node 22');await dialog.getByRole('button',{name:'Save',exact:true}).click();await expect(dialog).toBeHidden();
  await expect(page.locator('.teams-service')).toContainText('Orders API');
  await page.getByRole('button',{name:'Members & access',exact:true}).click();await page.getByRole('button',{name:'Invite team member',exact:true}).click();await dialog.getByLabel('Google account email').fill('qa@example.com');await dialog.getByLabel('Team role',{exact:true}).selectOption('qa');await dialog.getByRole('button',{name:'Create invitation',exact:true}).click();await expect(dialog).toBeHidden();await expect(page.locator('.teams-events')).toContainText('qa@example.com');
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
  await expect(page.getByRole('heading',{name:'Bắt đầu không gian chung cho team'})).toBeVisible();
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
  cleanup.asUser('qa');await page.addInitScript(()=>localStorage.setItem('snapkit-product-mode','teams'));await page.goto('/');
  await page.getByRole('button',{name:'Handoffs & approvals',exact:true}).click();await page.getByRole('button',{name:'Confirm QA passed',exact:true}).click();await expect(page.locator('.teams-handoff-list')).toContainText('QA confirmed');await expect(page.getByRole('button',{name:'Approve release',exact:true})).toHaveCount(0);
  cleanup.asUser('lead');await page.reload();await page.getByRole('button',{name:'Handoffs & approvals',exact:true}).click();await page.getByRole('button',{name:'Approve release',exact:true}).click();await expect(page.locator('.teams-handoff-list')).toContainText('Approved');
  cleanup.asUser('viewer');await page.reload();await expect(page.getByRole('button',{name:'Prepare local session',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Handoffs & approvals',exact:true}).click();await expect(page.locator('.teams-handoff-list')).toContainText('Approved');await expect(page.getByRole('button',{name:'Create QA handoff',exact:true})).toHaveCount(0);
 }finally{await cleanup();}
});

test('first-run setup can open Teams without creating a personal developer profile',async({page},testInfo)=>{
 const cleanup=await teamService(page,testInfo);
 try{
  await page.route('**/api/product',async route=>{const response=await route.fetch();const result=await response.json();delete result.preferences.developerProfile;await route.fulfill({json:result});});
  await page.goto('/');await expect(page.locator('#developer-onboarding')).toBeVisible();await page.getByRole('button',{name:'Open Snapkit Teams',exact:true}).click();await expect(page.locator('#developer-onboarding')).not.toBeVisible();await expect(page.getByRole('heading',{name:'Your team starts here'})).toBeVisible();
 }finally{await cleanup();}
});
