import {test,expect} from '@playwright/test';
const id='12345678-1234-1234-1234-123456789abc';
test('email invitation requires login and explicit acceptance, keeps the link through auth and fits mobile',async({page})=>{
 let loggedIn=false,accepted=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/v1/account',route=>route.fulfill({status:loggedIn?200:401,json:loggedIn?{user:{email:'invitee@example.com'}}:{error:'Sign in'}}));
 await page.route('**/v1/teams',route=>route.fulfill({json:{invitations:[{id,workspaceName:'Studio <script>alert(1)</script>'}]}}));
 await page.route('**/v1/teams/invitations/'+id+'/accept',async route=>{expect(route.request().method()).toBe('POST');expect(route.request().headers()['x-snapkit-request']).toBe('1');accepted++;await route.fulfill({json:{id:'workspace'}});});
 await page.goto('join/#'+id);await expect(page.locator('#join-signin')).toBeVisible();expect(accepted).toBe(0);await expect(page.locator('#join-signin')).toHaveAttribute('href','/auth/google/start?returnTo=%2Fjoin%2F');
 expect(new URL(page.url()).hash).toBe('');loggedIn=true;await page.reload();await expect(page.locator('#join-status')).toContainText('Studio <script>');await expect(page.locator('#join-accept')).toBeVisible();expect(accepted).toBe(0);
 await page.setViewportSize({width:375,height:812});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'/tmp/snapkit-invitation-mobile.png',fullPage:true});
 await page.locator('#join-accept').click();await expect(page.locator('#join-status')).toContainText('Đã tham gia');expect(accepted).toBe(1);await expect(page.locator('#join-download')).toBeVisible();expect(errors).toEqual([]);
});
test('wrong-account or expired invitation gives no workspace details or accept action',async({page})=>{
 await page.route('**/v1/account',route=>route.fulfill({json:{user:{email:'wrong@example.com'}}}));await page.route('**/v1/teams',route=>route.fulfill({json:{invitations:[]}}));
 await page.goto('join/#'+id);await expect(page.locator('#join-status')).toContainText('Không có lời mời');await expect(page.locator('#join-accept')).toBeHidden();await expect(page.locator('#join-switch')).toBeVisible();
});
