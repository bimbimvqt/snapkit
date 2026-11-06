import { test, expect } from './fixtures.js';
import { choose } from './choices.js';
test('all selects use themed menus, keyboard selection, localized labels and outside dismissal', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await page.goto('/?lang=en');
  await page.locator('[data-app-page="logs"]').click(); await page.locator('#log-level-trigger').click();
  await expect(page.locator('#log-level')).toBeHidden(); await expect(page.locator('#log-level-listbox')).toBeVisible();
  await page.keyboard.press('End'); await page.keyboard.press('Enter'); await expect(page.locator('#log-level')).toHaveValue('error'); await expect(page.locator('#log-level-trigger')).toBeFocused();
  await page.locator('#log-level-trigger').press('ArrowDown'); await expect(page.locator('#log-level-listbox')).toBeVisible(); await page.keyboard.press('Escape'); await expect(page.locator('#log-level-listbox')).toBeHidden();
  await page.locator('#log-level-trigger').click(); await page.locator('#panel-logs h1').click(); await expect(page.locator('#log-level-listbox')).toBeHidden();
  await page.evaluate(() => window.SnapkitI18n.setLanguage('vi')); await expect(page.locator('#log-level-trigger')).toContainText('Lỗi'); await page.locator('#log-level-trigger').click(); await expect(page.locator('#log-level-listbox')).toContainText('Cảnh báo & lỗi');
  await page.screenshot({ path: '/tmp/snapkit-dropdown-dark-beta15.png', animations: 'disabled' }); await page.keyboard.press('Escape');
  await page.locator('#theme-toggle').click(); await page.getByRole('radio', {name:'Sáng',exact:true}).check(); await page.locator('[data-app-page="logs"]').click(); await page.locator('#log-level-trigger').click(); await page.screenshot({ path: '/tmp/snapkit-dropdown-light-beta15.png', animations: 'disabled' });
  await page.keyboard.press('Tab'); await expect(page.locator('#log-level-listbox')).toBeHidden();
  expect(await page.locator('select').evaluateAll(selects => selects.every(s => getComputedStyle(s).display === 'none' && s.tabIndex === -1))).toBe(true);
  expect(errors).toEqual([]);
});
test('menus inside a dialog stay in the viewport, searchable options update and flavor suggestions stay custom', async ({ page }) => {
  await page.goto('/?lang=en'); await page.setViewportSize({ width: 900, height: 680 }); await page.locator('#add-device').click(); await page.locator('#create-model-trigger').click();
  await expect(page.locator('#create-model-listbox')).toBeVisible();
  const box = await page.locator('#create-model-listbox').boundingBox(); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(680);
  await page.keyboard.press('Escape'); await expect(page.locator('#create-dialog')).toBeVisible();
  await choose(page, 'create-model', 'demo:iphone17'); await expect(page.locator('#create-runtime-trigger')).toContainText('iOS 26');
  await page.keyboard.press('Escape');
  await page.route('**/api/workspace/profiles?*', route => route.fulfill({json:{profiles:[],flavors:['development','production']}}));
  await page.locator('#settings-button').click(); await page.locator('#workspace-path').fill('/Demo/project'); await page.locator('#workspace-path').press('Tab'); await expect(page.locator('#workspace-flavors option')).toHaveCount(2);
  const field = page.locator('#workspace-flavor'); await expect(field).not.toHaveAttribute('list'); await field.fill('dev'); await field.press('ArrowDown'); await page.keyboard.press('Enter'); await expect(field).toHaveValue('development');
  await field.fill('custom-flavor'); await expect(field).toHaveValue('custom-flavor'); await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 375, height: 844 }); await page.locator('#workspace-profile-trigger').click(); const popup = await page.locator('#workspace-profile-listbox').boundingBox(); expect(popup.x + popup.width).toBeLessThanOrEqual(375);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('custom menus follow programmatic values, disabled state and long searchable option lists', async ({ page }) => {
  await page.goto('/?lang=en'); await page.locator('[data-app-page="logs"]').click();
  await page.evaluate(() => { const s = document.querySelector('#log-level'); s.innerHTML = Array.from({length:40},(_,i)=>`<option value="${i}" ${i===21?'disabled':''}>Option ${i}</option>`).join(''); s.value = '20'; });
  await expect(page.locator('#log-level-trigger')).toHaveText('Option 20'); await page.locator('#log-level-trigger').click(); const search=page.locator('#log-level-listbox').locator('..').locator('.choice-search'); await search.fill('Option 3'); await expect(page.locator('#log-level-listbox [role="option"]')).toHaveCount(11); await search.press('ArrowDown'); await page.keyboard.press('Enter'); await expect(page.locator('#log-level')).toHaveValue('3');
  await page.evaluate(() => { document.querySelector('#log-level').disabled=true; }); await expect(page.locator('#log-level-trigger')).toBeDisabled();
});
