import {test,expect} from './fixtures.js';

async function localApp(page) {
  await page.route('**/api/state',async route=>{
    const response=await route.fetch(), data=await response.json();
    await route.fulfill({json:{...data,demo:false}});
  });
}
test('in-app review accepts a low rating, keeps failed drafts and retries the same receipt without opting into publication',async({page})=>{
  await localApp(page);let calls=[];
  await page.route('**/api/reviews',route=>{
    calls.push(route.request().postDataJSON());
    return route.fulfill(calls.length===1?{status:503,json:{error:'Offline'}}:{status:201,json:{received:true,id:'review-receipt'}});
  });
  await page.goto('/');await expect(page.locator('body')).toHaveAttribute('data-ui-ready','true');
  await page.locator('#review-open').click();
  const dialog=page.locator('#review-dialog');await expect(dialog).toBeVisible();
  await expect(dialog.locator('input[type=radio]:checked')).toHaveCount(0);
  await dialog.getByRole('radio',{name:'1 stars: Very dissatisfied',exact:true}).check();
  await page.locator('#review-message').fill('Please improve the Android setup experience.');
  await dialog.getByRole('button',{name:'Send review',exact:true}).click();
  await expect(dialog.getByRole('alert')).toContainText('Your review is kept here');
  await expect(page.locator('#review-message')).toHaveValue('Please improve the Android setup experience.');
  await page.screenshot({path:'/tmp/snapkit-in-app-review-dark.png'});
  await dialog.getByRole('button',{name:'Send review',exact:true}).click();
  await expect(dialog).toContainText('Your review has been received');
  expect(calls).toHaveLength(2);expect(calls[0]).toEqual(calls[1]);
  expect(calls[1]).toMatchObject({rating:1,publishConsent:false,name:''});
  expect(Object.keys(calls[1]).sort()).toEqual(['message','name','publishConsent','rating','submissionId'].sort());
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('snapkit-review-v1')).submitted)).toBe(true);
  await expect(dialog.getByRole('button',{name:'Done',exact:true})).toBeFocused();
  await expect(dialog).toContainText('Your review stays private');
  await page.screenshot({path:'/tmp/snapkit-review-success-dark-en.png',animations:'disabled'});
  await page.keyboard.press('Enter');await expect(dialog).not.toBeVisible();
  await expect(page.locator('#review-open')).toBeFocused();
});

test('review dialog supports Vietnamese, keyboard stars, public consent and a small light window',async({page})=>{
  await localApp(page);let sent;
  await page.addInitScript(()=>localStorage.setItem('snapkit-theme','light'));
  await page.route('**/api/reviews',route=>{sent=route.request().postDataJSON();return route.fulfill({status:201,json:{received:true,id:'vi-review'}});});
  await page.goto('/?lang=vi');await expect(page.locator('body')).toHaveAttribute('data-ui-ready','true');
  await page.setViewportSize({width:375,height:812});await page.locator('#review-open').click();
  const dialog=page.locator('#review-dialog');await expect(dialog).toContainText('Đánh giá Snapkit');
  const first=dialog.getByRole('radio',{name:'1 sao: Rất chưa hài lòng',exact:true});await first.check();await first.press('ArrowRight');
  await expect(dialog.getByRole('radio',{name:'2 sao: Chưa hài lòng',exact:true})).toBeChecked();
  await page.locator('#review-message').fill('Snapkit giúp tôi chuẩn bị thiết bị nhanh hơn.');
  await dialog.getByRole('checkbox').check();await page.locator('#review-name').fill('Developer');
  expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await dialog.screenshot({path:'/tmp/snapkit-in-app-review-light-vi.png'});
  await dialog.getByRole('button',{name:'Gửi đánh giá',exact:true}).click();
  await expect(dialog.getByRole('heading',{name:'Cảm ơn bạn đã chia sẻ.',exact:true})).toBeVisible();
  await expect(dialog).toContainText('sau khi được duyệt');expect(sent).toMatchObject({rating:2,publishConsent:true,name:'Developer'});
  await expect(dialog.getByRole('button',{name:'Xong',exact:true})).toBeFocused();
  expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth && el.getBoundingClientRect().bottom<=innerHeight)).toBe(true);
  await page.screenshot({path:'/tmp/snapkit-review-success-light-vi-small.png',animations:'disabled'});
  await page.setViewportSize({width:1200,height:800});
  await page.evaluate(()=>document.documentElement.classList.remove('light'));
  await page.screenshot({path:'/tmp/snapkit-review-success-dark-vi.png',animations:'disabled'});
  await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();
});

test('eligible users receive a nonmodal invitation only in a quiet session, with persistent dismissal',async({page})=>{
  await localApp(page);await page.clock.install();
  await page.addInitScript(()=>{
    const now=Date.now(),day=86400000;
    localStorage.setItem('snapkit-review-v1',JSON.stringify({version:1,firstUsedAt:now-8*day,days:['2026-10-01','2026-10-02','2026-10-03'],successes:5,lastSuccessAt:now-60000,prompts:0,nextPromptAt:0,optedOut:false,submitted:false}));
  });
  await page.goto('/');await expect(page.locator('body')).toHaveAttribute('data-ui-ready','true');
  await expect(page.locator('.review-invite')).toHaveCount(0);
  await page.locator('#ide-setup').click();await page.clock.fastForward(9*60000);
  await expect(page.locator('.review-invite')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.evaluate(()=>document.dispatchEvent(new CustomEvent('snapkit:review-work',{detail:{kind:'recording',busy:true}})));
  await page.clock.fastForward(30000);await expect(page.locator('.review-invite')).toHaveCount(0);
  await page.evaluate(()=>{document.dispatchEvent(new CustomEvent('snapkit:review-work',{detail:{kind:'recording',busy:false}}));document.dispatchEvent(new Event('snapkit:review-error'));});
  await page.clock.fastForward(9*60000);await expect(page.locator('.review-invite')).toHaveCount(0);
  await page.clock.fastForward(2*60000);
  await expect(page.locator('.review-invite')).toBeVisible();await expect(page.locator('#review-dialog')).not.toBeVisible();
  await page.locator('.review-invite').screenshot({path:'/tmp/snapkit-review-invitation.png'});
  await page.locator('.review-invite').getByRole('button',{name:'Don’t ask again',exact:true}).click();
  await expect(page.locator('.review-invite')).toHaveCount(0);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('snapkit-review-v1')).optedOut)).toBe(true);
  await page.clock.fastForward('24:00:00');await expect(page.locator('.review-invite')).toHaveCount(0);
  await page.locator('#review-open').click();await expect(page.locator('#review-dialog')).toBeVisible();
});

test('demo review never posts to the cloud',async({page})=>{
  let posts=0;await page.route('**/api/reviews',route=>{posts++;return route.fulfill({json:{received:true,id:'bad'}});});
  await page.goto('/');await expect(page.locator('body')).toHaveAttribute('data-ui-ready','true');
  await page.locator('#review-open').click();
  await page.getByRole('radio',{name:'3 stars: Neutral',exact:true}).check();await page.locator('#review-message').fill('A sample review in demo.');
  await page.locator('#review-dialog').getByRole('button',{name:'Send review',exact:true}).click();
  await expect(page.locator('#review-dialog [role=alert]')).toContainText('Demo reviews are not submitted');expect(posts).toBe(0);
});
