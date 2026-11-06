import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createCloud } from '../../apps/cloud/src/index.js';
import { notFoundPage } from '../../packages/web/not-found.js';

test('missing website pages return localized 404 while API and asset errors remain JSON', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'snapkit-404-'));
  const server = createCloud({ env: { SNAPKIT_CLOUD_DATA: dir } }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }); });
  const request = (url, options = {}) => fetch(`http://127.0.0.1:${server.address().port}${url}`, { headers: { Accept: 'text/html' }, ...options });
  for (const url of ['/missing', '/nested/missing/', '/404.html', '/en/404.html', '/en/guides/missing/']) {
    const response = await request(url);
    assert.equal(response.status, 404);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, follow');
    const html = await response.text();
    assert.match(html, new RegExp(`<html lang="${url.startsWith('/en/') ? 'en' : 'vi'}"`));
    assert.match(html, /src="\/favicon.svg"/);
    assert.doesNotMatch(html, /rel="canonical"/);
  }
  for (const url of ['/api/missing', '/v1/missing', '/assets/missing.webp', '/missing.js']) {
    const response = await request(url);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'Not found' });
  }
  const json = await request('/missing', { headers: { Accept: 'application/json' } });
  assert.deepEqual(await json.json(), { error: 'Not found' });
  const head = await request('/en/missing', { method: 'HEAD' });
  assert.equal(head.status, 404); assert.equal(await head.text(), '');
  assert.equal((await request('/')).status, 200);
  assert.equal((await request('/site.css')).status, 200);
  assert.equal((await request('/v1/admin/overview')).status, 401);
});

test('static 404 recovery and asset URLs keep the configured base at arbitrary depth', () => {
  const html = notFoundPage({ language: 'en', base: '/snapkit/' });
  assert.match(html, /href="\/snapkit\/en\/guides\/"/);
  assert.match(html, /src="\/snapkit\/favicon.svg"/);
  assert.match(html, /href="#main"/);
  assert.throws(() => notFoundPage({ base: '//evil.test/' }));
});
