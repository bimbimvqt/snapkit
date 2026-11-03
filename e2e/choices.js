import { expect } from '@playwright/test';
export async function choose(page, id, value) {
  let index;
  await expect.poll(async () => index = await page.locator(`#${id}`).evaluate((select, value) => [...select.options].findIndex(option => typeof value === 'object' ? option.label === value.label : option.value === value), value)).toBeGreaterThanOrEqual(0);
  await page.locator(`#${id}-trigger`).click();
  await page.locator(`#${id}-listbox [data-index="${index}"]`).click();
}
