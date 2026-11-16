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


test('new Flutter Run copy upgrades the previous default description without overwriting custom headlines', () => {
 const current={...defaultContent(),revision:9,landing:{en:{headline:'Our team',description:'Select your devices, press F5 and test your app across screens.'},vi:{headline:'Nhóm của tôi',description:'Chọn thiết bị, bấm F5 và kiểm tra ứng dụng trên nhiều màn hình.'}}};
 const next=refreshDefaultLanding(current);
 assert.equal(next.landing.en.description,defaultContent().landing.en.description);
 assert.equal(next.landing.vi.description,defaultContent().landing.vi.description);
 assert.equal(next.landing.en.headline,'Our team');assert.equal(next.landing.vi.headline,'Nhóm của tôi');
 assert.equal(next.revision,10);assert.deepEqual(refreshDefaultLanding(next),next);
});
