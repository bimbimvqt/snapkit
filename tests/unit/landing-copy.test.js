import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultContent, refreshDefaultLanding } from '../../apps/cloud/src/accounts.js';

test('landing copy migration updates historical defaults and preserves administrator edits and controls', () => {
  const old = { ...defaultContent(), revision: 3, registrationOpen: false, recommendedVersion: '0.2.0-beta.45', landing: {
    en: { headline: 'Every device. One place to build.', description: 'My custom description.' },
    vi: { headline: 'Tiêu đề riêng', description: 'Chuẩn bị thiết bị trong vài thao tác. Tập trung làm nên ứng dụng tiếp theo của bạn.' }
  } };
  const next = refreshDefaultLanding(old);
  assert.equal(next.landing.en.headline, defaultContent().landing.en.headline);
  assert.equal(next.landing.vi.description, defaultContent().landing.vi.description);
  assert.equal(next.landing.en.description, 'My custom description.');
  assert.equal(next.landing.vi.headline, 'Tiêu đề riêng');
  assert.equal(next.revision, 4); assert.equal(old.revision, 3);
  assert.equal(next.registrationOpen, false); assert.equal(next.recommendedVersion, old.recommendedVersion);
  assert.deepEqual(refreshDefaultLanding(next), next);
});
