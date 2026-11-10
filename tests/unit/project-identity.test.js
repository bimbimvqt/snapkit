import test from 'node:test';
import assert from 'node:assert/strict';
import {validProjectIcon} from '../../packages/domain/project-identity.js';
import {createNotificationTracker} from '../../apps/dashboard/src/features/notifications/sound.js';
import {teamPreview} from '../../apps/agent/src/fixtures/team-preview.js';
import {teamCan} from '../../apps/cloud/src/domain/team-access.js';
test('project icons reject remote, SVG, malformed and oversized content',()=>{
 assert.equal(validProjectIcon('smartphone'),true);
 for(const icon of ['https://example.com/icon.png','data:image/svg+xml;base64,PHN2Zy8+','data:image/png;base64,broken','data:image/png;base64,'+'A'.repeat(100000),null])assert.equal(validProjectIcon(icon),false);
 assert.equal(validProjectIcon('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='),true);
});
test('sound tracker only alerts for new unread IDs after the baseline and account changes',()=>{
 const track=createNotificationTracker(),item=id=>({id,read:false}),feed=(items,userId='one')=>({userId,items});
 assert.deepEqual(track(feed([item('old')])),[]);assert.deepEqual(track(feed([item('old'),item('new')])),['new']);
 assert.deepEqual(track(feed([{id:'new',read:true}])),[]);assert.deepEqual(track(feed([item('new'),item('old')])),[]);
 assert.deepEqual(track(feed([item('old')],'two')),[]);assert.deepEqual(track(feed([item('old'),item('new')],'two')),['new']);
});
test('Flutter sample has exactly 11 scoped teammates and no credentials or fake QA approvals',()=>{
 const sample=teamPreview();assert.equal(sample.members.length,11);
 assert.equal(sample.members.filter(m=>m.role==='developer'&&m.serviceLayers.includes('mobile')).length,3);
 assert.equal(sample.members.filter(m=>m.role==='developer'&&m.serviceLayers.includes('backend')).length,6);
 assert.equal(sample.members.filter(m=>m.role==='lead').length,1);assert.equal(sample.members.filter(m=>m.role==='pm').length,1);
 assert.ok(sample.handoffs.every(h=>h.status==='pending'&&!h.qa));
 assert.ok(!JSON.stringify(sample).match(/https?:|@[a-z]+\./));
 const pm=sample.members.find(m=>m.role==='pm');assert.equal(teamCan(pm,'projects.edit','preview-app'),true);assert.equal(teamCan(pm,'release.approve'),false);assert.equal(teamCan(pm,'members.manage'),false);
});
