import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { userDataDirectory, androidSDKDirectory } from '../../apps/agent/src/infrastructure/storage/paths.js';
import { subscriptionFromCustomer, webhookUsers } from '../../apps/cloud/src/domain/subscription.js';
import { createCloud } from '../../apps/cloud/src/index.js';

test('new installations use OS data directories and discover existing Android SDKs', () => {
  const base = { home: '/people/A Name', env: {} };
  assert.equal(userDataDirectory({ ...base, platform: 'darwin' }), '/people/A Name/Library/Application Support/Snapkit');
  assert.equal(userDataDirectory({ ...base, platform: 'win32', env: { APPDATA: '/profiles/A' } }), '/profiles/A/Snapkit');
  assert.equal(userDataDirectory({ ...base, platform: 'linux', env: { XDG_DATA_HOME: '/data' } }), '/data/snapkit');
  assert.equal(androidSDKDirectory({ ...base, platform: 'darwin', exists: () => true }), '/people/A Name/Library/Android/sdk');
  assert.equal(androidSDKDirectory({ ...base, platform: 'linux', env: { ANDROID_HOME: '/custom SDK' } }), '/custom SDK');
});
const customer = (grant = {}, subscription = {}) => ({ subscriber: { entitlements: { pro: { product_identifier: 'pro_year', expires_date: '2027-01-01T00:00:00Z', ...grant } }, subscriptions: { pro_year: { is_sandbox: false, ...subscription } } } });
const now = Date.parse('2026-11-02T00:00:00Z');
test('RevenueCat entitlements handle cancellation, expiry, grace, lifetime and sandbox', () => {
  assert.equal(subscriptionFromCustomer(customer(), { now }).plan, 'pro');
  const cancelled = subscriptionFromCustomer(customer({}, { unsubscribe_detected_at: '2026-11-01' }), { now });
  assert.equal(cancelled.active, true); assert.equal(cancelled.renews, false);
  assert.equal(subscriptionFromCustomer(customer({ expires_date: '2026-10-01' }), { now }).active, false);
  assert.equal(subscriptionFromCustomer(customer({ expires_date: '2026-10-01' }, { grace_period_expires_date: '2026-11-03', billing_issues_detected_at: '2026-10-01' }), { now }).billingIssue, true);
  assert.equal(subscriptionFromCustomer(customer({ expires_date: null }), { now }).lifetime, true);
  assert.equal(subscriptionFromCustomer(customer({}, { is_sandbox: true }), { now }).active, false);
  assert.equal(subscriptionFromCustomer(customer({ expires_date: 'invalid' }), { now }).active, false);
  assert.equal(subscriptionFromCustomer({ subscriber: { entitlements: {} } }, { now }).active, false);
  assert.deepEqual(webhookUsers({ app_user_id: 'b', transferred_from: ['a'], transferred_to: ['b'] }), ['b', 'a']);
});
async function cloudFixture(fn) {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'snapkit-cloud-'));
  let calls = [], current = customer();
  const env = { SNAPKIT_CLOUD_DATA: folder, REVENUECAT_SECRET_API_KEY: 'test-key', REVENUECAT_WEBHOOK_AUTH: 'test-webhook' };
  const fetcher = async url => { calls.push(url); return { status: 200, ok: true, json: async () => current }; };
  const server = createCloud({ env, fetcher }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn({ base, calls, setCustomer: value => { current = value; } }); }
  finally { await new Promise(resolve => server.close(resolve)); await rm(folder, { recursive: true, force: true }); }
}
test('cloud disables checkout and never exposes local device APIs or unauthenticated entitlements', async () => cloudFixture(async ({ base }) => {
  const config = await fetch(base + '/v1/billing/config').then(r => r.json());
  assert.equal(config.checkoutEnabled, false); assert.equal(config.phase, 'free-beta');
  assert.equal((await fetch(base + '/v1/billing/checkout', { method: 'POST' })).status, 503);
  assert.equal((await fetch(base + '/v1/me/subscription?userId=someone')).status, 503);
  assert.equal((await fetch(base + '/api/devices')).status, 404);
}));
test('only controller pages can connect to a paired loopback agent', async () => cloudFixture(async ({ base }) => {
  for (const route of ['/', '/admin/', '/health', '/controller']) {
    const policy = (await fetch(base + route)).headers.get('content-security-policy');
    assert.ok(!policy.includes('http://127.0.0.1:'));
  }
  for (const route of ['/control/', '/preview/']) {
    const policy = (await fetch(base + route)).headers.get('content-security-policy');
    assert.match(policy, /connect-src 'self' https:\/\/api.github.com http:\/\/127.0.0.1:\* http:\/\/localhost:\*/);
    assert.ok(!policy.includes("script-src 'unsafe-inline'"));
  }
}));
test('RevenueCat webhook is authenticated, deduplicated and reconciles transfers from provider truth', async () => cloudFixture(async ({ base, calls }) => {
  const post = (event, auth = 'test-webhook') => fetch(base + '/v1/webhooks/revenuecat', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: auth }, body: JSON.stringify({ event }) });
  assert.equal((await post({ id: 'one', app_user_id: 'one' }, 'wrong')).status, 401); assert.equal(calls.length, 0);
  assert.equal((await post({ id: 'one', app_user_id: 'one', type: 'RENEWAL' })).status, 200); assert.equal(calls.length, 1);
  assert.equal((await post({ id: 'one', app_user_id: 'one' }).then(r => r.json())).duplicate, true); assert.equal(calls.length, 1);
  assert.equal((await post({ id: 'two', type: 'TRANSFER', transferred_from: ['old'], transferred_to: ['new'] })).status, 200); assert.equal(calls.length, 3);
  assert.ok(calls.every(url => url.startsWith('https://api.revenuecat.com/v1/subscribers/')));
}));
