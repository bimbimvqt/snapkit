import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pairings } from '../server/pairing.js';
test('pairing codes expire, are single-use, and sessions are bound to one origin', () => {
  let now = 1000;
  const store = new Pairings('https://example.github.io', () => now);
  let pair = store.create();
  assert.throws(() => store.claim(pair.code, 'https://other.example'), /origin/);
  const session = store.claim(pair.code, store.origin);
  assert.equal(store.allows(session.token, store.origin), true);
  assert.equal(store.allows(session.token, 'https://other.example'), false);
  assert.throws(() => store.claim(pair.code, store.origin), /expired/);
  now = session.expiresAt;
  assert.equal(store.allows(session.token, store.origin), false);
  pair = store.create(); now = pair.expiresAt;
  assert.throws(() => store.claim(pair.code, store.origin), /expired/);
});
test('incorrect attempts are capped and local revocation invalidates sessions and pending codes', () => {
  const store = new Pairings('https://example.github.io');
  let pair = store.create();
  for (let i = 0; i < 10; i++) assert.throws(() => store.claim('bad', store.origin), /Invalid/);
  assert.throws(() => store.claim(pair.code, store.origin), /expired/);
  pair = store.create(); const session = store.claim(pair.code, store.origin);
  pair = store.create(); store.revoke();
  assert.equal(store.allows(session.token, store.origin), false);
  assert.throws(() => store.claim(pair.code, store.origin), /expired/);
});
