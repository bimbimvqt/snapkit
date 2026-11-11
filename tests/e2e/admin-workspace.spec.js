import {kitCatalog} from '../../packages/domain/product-kit.js';
import {test,expect} from './fixtures.js';
import {createCloud} from '../../apps/cloud/src/index.js';
import {defaultContent} from '../../apps/cloud/src/accounts.js';
import {adminRoles,permissionsFor} from '../../apps/cloud/src/domain/admin-access.js';

async function workspace(page,role='admin') {
  const server=createCloud({env:{}}).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const state={content:defaultContent(),roleWrites:[],accessWrites:[],requests:[],failOverview:false};
  await page.route('**/v1/**',async route=>{
    const request=route.request(),url=new URL(request.url()),pathname=url.pathname;state.requests.push(pathname);
    const reply=data=>route.fulfill({json:data});
    if(pathname==='/v1/product/kit')return reply(kitCatalog);
    if(pathname==='/v1/releases/latest')return reply({available:true,version:'0.2.0-beta.58'});
    if(pathname==='/v1/auth/config')return reply({configured:true});
    if(pathname==='/v1/account')return reply({user:{id:'self',name:'Tuan Vuong',email:'tuan@example.com',role,isOwner:role==='admin'},permissions:permissionsFor(role)});
    if(pathname==='/v1/admin/overview')return state.failOverview?route.fulfill({status:503,json:{error:'Máy chủ tạm thời không phản hồi.'}}):reply({users:24,activeUsers:21,sessions:8,content:state.content,feedback:{total:12,open:7,pending:3,published:2},audit:[]});
    if(pathname==='/v1/admin/content'){
      if(request.method()==='POST'){state.content={...request.postDataJSON(),revision:state.content.revision+1};}return reply({content:state.content});
    }
    if(pathname==='/v1/admin/teams')return reply({totals:{workspaces:1,memberships:7,projects:3,devices:2,handoffs:4},total:1,entries:[{id:'team',name:'Engineering <script>',members:7,projects:3,devices:2,reservations:1,handoffs:4,updatedAt:'2026-11-10T02:00:00Z'}]});
    if(pathname==='/v1/admin/users')return reply({total:3,users:[{id:'self',name:'Tuan Vuong',email:'tuan@example.com',role,isOwner:role==='admin',lastLoginAt:'2026-11-06T02:00:00Z'},{id:'teammate',name:'Nguyễn Minh',email:'minh@example.com',role:'moderator',disabled:false,lastLoginAt:'2026-11-06T02:00:00Z'},{id:'member',name:'<script>alert(1)</script>',email:'member@example.com',role:'user',disabled:false}]});
    if(pathname==='/v1/admin/users/role'){state.roleWrites.push(request.postDataJSON());return reply({saved:true});}
    if(pathname==='/v1/admin/users/access'){state.accessWrites.push(request.postDataJSON());return reply({saved:true});}
    if(pathname==='/v1/admin/roles')return reply({roles:adminRoles});
    if(pathname==='/v1/admin/audit')return reply({entries:[{actor:'self',actorName:'Tuan Vuong',action:'assign-role:moderator',target:'teammate',at:'2026-11-06T02:00:00Z'}]});
    if(pathname==='/v1/admin/feedback')return reply({total:1,entries:[{id:'review',name:'Developer',email:'private@example.com',message:'Snapkit helps our Flutter workflow.',type:'review',rating:5,status:'new',moderation:'pending',publishConsent:true,createdAt:'2026-11-06T02:00:00Z'}]});
    return route.fulfill({status:404,json:{error:'Not found'}});
  });
  return {base:'http://127.0.0.1:'+server.address().port,state,close:()=>server.close()};
}

for(const [role,visible]of Object.entries({admin:['overview','feedback','users','content','kit','roles','audit','teams'],editor:['overview','content','kit'],moderator:['overview','feedback'],viewer:['overview','feedback','users','content','kit','audit','teams']})) {
  test(`admin workspace shows permitted navigation and operations for ${role}`,async({page})=>{
    const app=await workspace(page,role);const errors=[];page.on('pageerror',error=>errors.push(error.message));
    try {
      await page.goto(app.base+'/admin/');await expect(page.locator('#dashboard')).toBeVisible();await expect(page.locator('#stats .stat-card strong')).toHaveCount(4);
      for(const key of ['overview','feedback','users','content','kit','roles','audit','teams']){
        const button=page.locator(`.admin-sidebar [data-admin-page=${key}]`);
        if(visible.includes(key))await expect(button).toBeVisible();else await expect(button).toBeHidden();
      }
      if(visible.includes('teams')){
        await page.locator('.admin-sidebar [data-admin-page=teams]').click();
        await expect(page.locator('#teams-list')).toContainText('Engineering <script>');
        await expect(page.locator('#teams-summary')).toContainText('7 thành viên');
        await expect(page.locator('#teams-list script')).toHaveCount(0);
        await page.screenshot({path:'/tmp/snapkit-admin-teams.png'});
      }
      if(visible.includes('kit')){await page.locator('.admin-sidebar [data-admin-page=kit]').click();await expect(page.locator('#kit-catalog article')).toHaveCount(8);await expect(page.locator('#kit-release-status')).toContainText('Có Daily Kit mới');}
      if(visible.includes('content')){
        await page.locator('.admin-sidebar [data-admin-page=content]').click();await expect(page.locator('[name=headline-vi]')).toHaveValue(defaultContent().landing.vi.headline);
        if(role==='viewer'){await expect(page.locator('#content button[type=submit]')).toBeHidden();await expect(page.locator('[name=headline-vi]')).toBeDisabled();}
        if(role==='editor'){await expect(page.locator('[name=registration]')).toBeDisabled();await expect(page.locator('[name=headline-vi]')).toBeEditable();}
      }
      if(visible.includes('feedback')){
        await page.locator('.admin-sidebar [data-admin-page=feedback]').click();await expect(page.locator('#feedback-inbox')).toContainText('Flutter workflow');
        if(role==='viewer'){await expect(page.getByRole('button',{name:'Duyệt & hiển thị'})).toHaveCount(0);await expect(page.locator('#feedback-inbox [role=combobox]')).toHaveCount(0);}
        if(role==='moderator')await expect(page.getByRole('button',{name:'Duyệt & hiển thị'})).toBeVisible();
      }
      if(role==='admin'){
        await page.locator('.admin-sidebar [data-admin-page=overview]').click();await expect(page.locator('#panel-loading')).toBeHidden();await page.mouse.move(1400,70);await page.evaluate(async()=>Promise.all(document.getAnimations().map(animation=>animation.finished.catch(()=>{}))));await page.screenshot({path:'/tmp/snapkit-admin-overview-desktop.png'});
        await page.locator('.admin-sidebar [data-admin-page=roles]').click();await expect(page.locator('.role-card')).toHaveCount(4);await expect(page.locator('#panel-loading')).toBeHidden();await page.mouse.move(1400,70);await page.evaluate(async()=>Promise.all(document.getAnimations().map(animation=>animation.finished.catch(()=>{}))));await page.screenshot({path:'/tmp/snapkit-admin-roles-desktop.png'});
      }
      await page.setViewportSize({width:390,height:900});
      await expect(page.locator('#admin-menu')).toBeVisible();await page.locator('#admin-menu').click();await expect(page.locator('#admin-menu')).toHaveAttribute('aria-expanded','true');
      await page.locator('.admin-sidebar [data-admin-page=overview]').click();await expect(page.locator('#admin-menu')).toHaveAttribute('aria-expanded','false');
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      if(role==='admin')await page.screenshot({path:'/tmp/snapkit-admin-overview-mobile.png'});
      if(role==='editor'){expect(app.state.requests).not.toContain('/v1/admin/feedback');expect(app.state.requests).not.toContain('/v1/admin/users');}
      expect(errors).toEqual([]);
    }finally{app.close();}
  });
}

test('admin grants a selected role explicitly, protects owner controls and confirms access changes in a styled dialog',async({page})=>{
  const app=await workspace(page);
  try {
    await page.goto(app.base+'/admin/#users');await expect(page.locator('#users tr')).toHaveCount(3);
    const row=page.locator('#users tr').filter({hasText:'minh@example.com'});
    await row.getByRole('combobox').click();await page.getByRole('option',{name:'Biên tập viên',exact:true}).click();
    expect(app.state.roleWrites).toHaveLength(0);await row.getByRole('button',{name:'Lưu quyền'}).click();
    await expect(row.getByRole('button',{name:'Lưu quyền'})).toBeHidden();expect(app.state.roleWrites).toEqual([{id:'teammate',role:'editor'}]);
    await expect(page.locator('#users tr').filter({hasText:'tuan@example.com'}).getByRole('combobox')).toHaveCount(0);
    await expect(page.locator('#users script')).toHaveCount(0);await page.screenshot({path:'/tmp/snapkit-admin-users-desktop.png'});
    await row.getByRole('button',{name:'Khóa truy cập'}).click();await expect(page.locator('#action-dialog')).toBeVisible();await page.getByRole('button',{name:'Hủy',exact:true}).click();expect(app.state.accessWrites).toHaveLength(0);
    await row.getByRole('button',{name:'Khóa truy cập'}).click();await page.locator('#action-confirm').click();await expect.poll(()=>app.state.accessWrites.length).toBe(1);
    await page.locator('.admin-sidebar [data-admin-page=content]').click();await page.locator('[name=headline-vi]').fill('Bản nháp chưa lưu');
    await page.locator('.admin-sidebar [data-admin-page=overview]').click();await page.locator('.admin-sidebar [data-admin-page=content]').click();await expect(page.locator('[name=headline-vi]')).toHaveValue('Bản nháp chưa lưu');
    await page.setViewportSize({width:390,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }finally{app.close();}
});

test('admin overview recovers from failed loading without hiding navigation',async({page})=>{
  const app=await workspace(page);app.state.failOverview=true;
  try{await page.goto(app.base+'/admin/');await expect(page.locator('#panel-error')).toBeVisible();await expect(page.locator('.admin-sidebar')).toBeVisible();app.state.failOverview=false;await page.locator('#panel-retry').click();await expect(page.locator('#panel-error')).toBeHidden();await expect(page.locator('#stats .stat-card strong')).toHaveCount(4);}finally{app.close();}
});
