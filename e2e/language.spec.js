import { test, expect } from '@playwright/test';
async function chooseLanguage(page, language) {
  await page.locator('[data-language-select]').click();
  await page.locator(`[data-language="${language}"]`).click();
}

test('app switches language without losing search, workspace input or cached tool state', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?lang=en');
  await expect(page.locator('.device-card')).toHaveCount(6);
  await page.locator('#device-search').fill('iPhone');
  const names = await page.locator('.card-name').allTextContents();
  await chooseLanguage(page, 'vi');
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(page.locator('#add-device')).toHaveText('Thêm thiết bị');
  await expect(page.locator('#filter-summary')).toContainText('thiết bị');
  await expect(page.locator('#device-search')).toHaveValue('iPhone');
  expect(await page.locator('.card-name').allTextContents()).toEqual(names);
  await page.locator('[data-app-page="setup"]').click();
  await expect(page.locator('#setup-title')).toHaveText('Khởi đầu rõ ràng, từng bước một.');
  await expect(page.locator('#tool-checks')).toContainText('Sẵn sàng');
  await chooseLanguage(page, 'en');
  await expect(page.locator('#tool-checks')).toContainText('Ready');
  await expect(page.locator('#tool-checks')).not.toContainText('Sẵn sàng');
  await page.locator('[data-app-page="preferences"]').click();
  await page.locator('#pref-flutter').fill('/SDKs/My Flutter');
  await chooseLanguage(page, 'vi');
  await expect(page.locator('#pref-flutter')).toHaveValue('/SDKs/My Flutter');
  await expect(page.locator('#save-preferences')).toHaveText('Lưu tùy chọn');
  await page.locator('[data-app-page="plan"]').click();
  await expect(page.locator('#plan-title')).toHaveText('Ưu tiên nhịp làm việc của bạn.');
  await page.reload();
  await expect(page.locator('[data-language-select]')).toHaveAttribute('data-language-current', 'vi');
  await expect(page.locator('#add-device')).toHaveText('Thêm thiết bị');
  await page.locator('#add-device').click();
  await expect(page.locator('#create-title')).toHaveText('Một màn hình mới cho ý tưởng của bạn.');
  await expect(page.locator('#create-model')).toBeVisible();
  await page.locator('#model-search').fill('iPhone');
  await page.locator('#create-name').fill('My test device');
  await page.evaluate(() => window.SnapkitI18n.setLanguage('en'));
  await expect(page.locator('#create-name')).toHaveValue('My test device');
  await expect(page.locator('#model-search')).toHaveValue('iPhone');
  await expect(page.locator('#create-title')).toHaveText('A new screen to build for.');
  expect(errors).toEqual([]);
});

test('language menu supports keyboard and every device fits inside its preview', async ({ page }) => {
  await page.goto('/?lang=en');
  const trigger = page.locator('[data-language-select]');
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(page.locator('[data-language="en"]')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(trigger).toHaveAttribute('data-language-current', 'vi');
  await expect(trigger).toBeFocused();
  await expect(page.getByRole('menu')).toBeHidden();
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click();
  await page.locator('#page-title').click();
  await expect(page.getByRole('menu')).toBeHidden();
  await expect(page.locator('.device-card')).toHaveCount(6);
  for (const width of [1440, 1024, 768, 375]) {
    await page.setViewportSize({ width, height: 900 });
    const clipped = await page.locator('.device-model').evaluateAll(models => models.filter(model => {
      const box = model.getBoundingClientRect(), stage = model.closest('.device-stage').getBoundingClientRect();
      return box.top < stage.top + 8 || box.bottom > stage.bottom - 8 || box.left < stage.left || box.right > stage.right;
    }).map(model => model.closest('.device-card').dataset.device));
    expect(clipped).toEqual([]);
  }
});
