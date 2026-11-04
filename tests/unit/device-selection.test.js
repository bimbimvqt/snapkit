import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectIDETargets } from '../../apps/agent/src/application/select-ide-targets.js';
const devices = [{ id: 'phone', name: 'Phone', state: 'online', flutterId: 'flutter-phone' }, { id: 'tablet', name: 'Tablet', state: 'offline' }];
test('target use case rejects unavailable devices before touching project configuration or persistence', async () => {
  let touched = false;
  const ports = { devices, validateProject: async () => { touched = true; }, listSets: () => [], saveSelection: async () => { touched = true; } };
  await assert.rejects(selectIDETargets({ ids: ['tablet'] }, ports), /unavailable/);
  assert.equal(touched, false);
});
test('target use case does not save on project validation failure or a mismatched device set', async () => {
  let saved = false;
  const ports = { devices, validateProject: async () => { throw Error('Invalid project'); }, listSets: () => [], saveSelection: async () => { saved = true; } };
  await assert.rejects(selectIDETargets({ ids: ['phone'] }, ports), /Invalid project/);
  ports.validateProject = async () => {};
  await assert.rejects(selectIDETargets({ ids: ['phone'], setId: 'wrong' }, ports), /does not match/);
  assert.equal(saved, false);
});
test('target use case validates and saves partial ready selections while manual selections clear set provenance', async () => {
  const writes = [];
  const ports = { devices, validateProject: async targets => assert.equal(targets.length, 1), listSets: () => [{ id: 'daily', deviceIds: ['phone', 'tablet'] }], saveSelection: async value => writes.push(value) };
  await selectIDETargets({ ids: ['phone'], setId: 'daily' }, ports);
  await selectIDETargets({ ids: ['phone'] }, ports);
  assert.deepEqual(writes, [{ targetIds: ['phone'], selectedSetId: 'daily' }, { targetIds: ['phone'], selectedSetId: '' }]);
});
