import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

// Run after build:dashboard. Use the same browser, host and protocol on both refs.
const port = 14329;
const agent = spawn(process.execPath, ['apps/agent/src/main.js', '--demo'], {
  env: { ...process.env, PORT: String(port) }, stdio: 'ignore'
});
let browser;
try {
  let healthy = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { healthy = (await fetch(`http://127.0.0.1:${port}/api/health`)).ok; } catch {}
    if (healthy) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!healthy) throw new Error('Demo agent did not become healthy');
  browser = await chromium.launch();
  const samples = [];
  for (let sample = 0; sample < 3; sample++) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/?lang=en`);
    await expect(page.locator('.device-card')).toHaveCount(6);
    await page.waitForTimeout(100);
    const metrics = await page.evaluate(() => {
      const scripts = performance.getEntriesByType('resource').filter(entry => entry.initiatorType === 'script' || /\.js/.test(entry.name));
      return {
        readyMs: performance.now(),
        scriptBytes: scripts.reduce((sum, entry) => sum + entry.encodedBodySize, 0),
        scriptRequests: scripts.length
      };
    });
    await page.evaluate(() => {
      window.benchmarkMutations = 0;
      window.benchmarkObserver = new MutationObserver(records => { window.benchmarkMutations += records.length; });
      window.benchmarkObserver.observe(document.querySelector('#devices-grid'), {
        subtree: true, childList: true, attributes: true, characterData: true
      });
    });
    for (let refresh = 0; refresh < 5; refresh++) {
      await page.locator('#refresh-button').click();
      await expect(page.locator('#refresh-button')).toBeEnabled();
    }
    metrics.unchangedGridMutations = await page.evaluate(() => {
      window.benchmarkObserver.disconnect();
      return window.benchmarkMutations;
    });
    samples.push(metrics);
    await context.close();
  }
  await mkdir('.snapkit-dev', { recursive: true });
  await writeFile('.snapkit-dev/framework-benchmark.json', JSON.stringify(samples, null, 2) + '\n');
  console.log(JSON.stringify(samples, null, 2));
} finally {
  await browser?.close();
  agent.kill();
}
