import { test, expect } from '@playwright/test';

test('desktop splash loads the shared logo, localizes status and respects reduced motion', async ({page}) => {
  const file = new URL('../desktop/splash.html',import.meta.url);
  file.searchParams.set('lang','vi');
  await page.setViewportSize({width:420,height:340});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(file.href);
  await expect(page.locator('.logo')).toHaveJSProperty('naturalWidth',40);
  await expect(page.locator('[role="status"]')).toContainText('Đang mở không gian làm việc');
  expect(await page.locator('.brand').evaluate(node=>getComputedStyle(node).animationName)).toBe('none');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth && document.documentElement.scrollHeight<=innerHeight)).toBe(true);
  await page.screenshot({path:'/tmp/snapkit-splash-vi.png'});
  await page.emulateMedia({reducedMotion:'no-preference'});
  file.searchParams.set('lang','en'); await page.goto(file.href);
  await expect(page.locator('[role="status"]')).toContainText('Opening your workspace');
  await page.waitForTimeout(600);
  await page.screenshot({path:'/tmp/snapkit-splash-en.png'});
});
